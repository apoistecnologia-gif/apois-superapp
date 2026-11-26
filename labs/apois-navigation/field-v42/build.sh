#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/apk-assertions.sh"
H="$RUNNER_TEMP/apois-field-host"
P="$RUNNER_TEMP/apois-field-data"
mkdir -p "$H"
cp -a "$ROOT/android/"{probe,settings.gradle,gradle.properties} "$H/"
printf '\ninclude ":app"\n' >> "$H/settings.gradle"
N="$H/probe/src/main"
mkdir -p "$N/assets/apois-field-pilot"
python "$ROOT/field-apk/prepare.py" "$P" "$N/assets/apois-field-pilot" "$N/java/br/com/apois/navigation/lab/FieldManifest.kt"
cp "$ROOT/field-apk/FieldStartPolicy.kt" "$N/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-v3/FieldV3Policy.kt" "$N/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-v4/FieldOfflineRouteResolver.kt" "$N/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-v42/"{FieldSearchPilotActivity,PilotSearchCatalog,PilotSearchAsset,PilotSearchPanel}.kt "$N/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-v42/PilotSearchCatalogTest.kt" "$H/probe/src/test/java/br/com/apois/navigation/lab/"
S="$RUNNER_TEMP/apois-search-candidates"
(cd "$S" && echo '6e7b3aa0b05eda46c078ad0ed97ffeaa12609bbe0d74ab59ca636ec2efda9ccf  search-candidates.json' | sha256sum -c -)
mkdir -p "$N/assets/apois-field-search"
cp "$S/search-candidates.json" "$N/assets/apois-field-search/"
G="$RUNNER_TEMP/apois-piaui-graph"
(cd "$G" && printf '%s\n' '3d8ddee2d42886b1846d86477b44ca7fabc050227e48c767836699050b23dd31  graph-manifest.json' 'b0f3de3041ec8994c77eb678e416db86f93e9dc3d95a7416114b55059a393344  valhalla_tiles.tar' | sha256sum -c -)
mkdir -p "$N/assets/apois-field-graph"
cp "$G/"{graph-manifest.json,valhalla_tiles.tar,OSM-NOTICE.txt} "$N/assets/apois-field-graph/"
# Modify only the disposable CI copy of the probe.
sed -i 's/JavaVersion.VERSION_17/JavaVersion.VERSION_21/g' "$H/probe/build.gradle"
cat >> "$H/probe/build.gradle" <<'DEPS'
dependencies {
 implementation 'io.github.rallista:valhalla-mobile:0.6.3'
 implementation 'io.github.rallista:valhalla-models:0.5.2'
 implementation 'io.github.rallista:valhalla-models-config:0.5.2'
 implementation 'com.stadiamaps:osrm-openapi:0.0.10'
}
DEPS
cp "$ROOT/field-v3/FieldV3PolicyTest.kt" "$H/probe/src/test/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-apk/FieldStartPolicyTest.kt" "$H/probe/src/test/java/br/com/apois/navigation/lab/"
# Activity is deliberately exported only through this disposable APK's launcher.
mkdir -p "$H/app/src/main"
cat > "$H/app/build.gradle" <<'EOF'
plugins { id 'com.android.application' version '9.0.1' }
android {
 namespace 'br.com.apois.navigation.field'
 compileSdk 36
 defaultConfig {
  applicationId 'br.com.apois.navigation.field.v42.lab'
  minSdk 25
  targetSdk 36
  versionCode 6
  versionName '4.2-search-pilot'
 }
 compileOptions { sourceCompatibility JavaVersion.VERSION_21; targetCompatibility JavaVersion.VERSION_21; coreLibraryDesugaringEnabled true }
}
dependencies {
 implementation project(':probe')
 coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'
}
EOF
cat > "$H/app/src/main/AndroidManifest.xml" <<'EOF'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
 <uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
 <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
 <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
 <queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>
 <application android:label="APOIS GPS PI V4.2" android:fullBackupContent="false" android:allowBackup="false" android:usesCleartextTraffic="false" android:theme="@android:style/Theme.Material.Light.NoActionBar">
  <activity android:name="br.com.apois.navigation.lab.FieldSearchPilotActivity" android:exported="true">
   <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
  </activity>
 </application>
</manifest>
EOF
gradle -p "$H" :probe:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace
APK="$H/app/build/outputs/apk/debug/app-debug.apk"
TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
OUT="$RUNNER_TEMP/apois-field-apk"
mkdir -p "$OUT"
"$TOOLS/apksigner" verify --verbose --print-certs "$APK"
"$TOOLS/aapt" dump badging "$APK" > "$OUT/badging.txt"
grep -F "package: name='br.com.apois.navigation.field.v42.lab'" "$OUT/badging.txt"
lab_assert_absent 'android\.permission\.(INTERNET|ACCESS_WIFI_STATE|ACCESS_BACKGROUND_LOCATION)' "$OUT/badging.txt" || exit 1
grep -F 'android.permission.ACCESS_FINE_LOCATION' "$OUT/badging.txt"
grep -F 'android.permission.ACCESS_NETWORK_STATE' "$OUT/badging.txt"
unzip -l "$APK" > "$OUT/apk-files.txt"
grep -F 'assets/apois-field-pilot/pilot.pmtiles' "$OUT/apk-files.txt"
grep -F 'assets/apois-field-graph/valhalla_tiles.tar' "$OUT/apk-files.txt"
grep -F 'assets/apois-field-search/search-candidates.json' "$OUT/apk-files.txt"
for ABI in arm64-v8a x86_64;do grep -F "lib/$ABI/libvalhalla-wrapper.so" "$OUT/apk-files.txt";done
cp "$G/graph-manifest.json" "$OUT/"
cp "$APK" "$OUT/APOIS-GPS-Piaui-Piloto-V42.apk"
cp "$P/route-report.json" "$OUT/"
(cd "$OUT" && sha256sum APOIS-GPS-Piaui-Piloto-V42.apk > SHA256SUMS.txt)
