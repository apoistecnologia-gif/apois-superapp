#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="$RUNNER_TEMP/apois-field-host"
P="$RUNNER_TEMP/apois-field-data"
mkdir -p "$H"
cp -a "$ROOT/android/"{probe,settings.gradle,gradle.properties} "$H/"
printf '\ninclude ":app"\n' >> "$H/settings.gradle"
N="$H/probe/src/main"
mkdir -p "$N/assets/apois-field-pilot"
python "$ROOT/field-apk/prepare.py" "$P" "$N/assets/apois-field-pilot" "$N/java/br/com/apois/navigation/lab/FieldManifest.kt"
cp "$ROOT/field-apk/FieldStartPolicy.kt" "$N/java/br/com/apois/navigation/lab/"
cp "$ROOT/field-v3/"{FieldDynamicPilotActivity,FieldV3Policy}.kt "$N/java/br/com/apois/navigation/lab/"
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
  applicationId 'br.com.apois.navigation.field.v3.lab'
  minSdk 25
  targetSdk 36
  versionCode 3
  versionName '3.0-pilot'
 }
 compileOptions { sourceCompatibility JavaVersion.VERSION_17; targetCompatibility JavaVersion.VERSION_17; coreLibraryDesugaringEnabled true }
}
dependencies {
 implementation project(':probe')
 coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'
}
EOF
cat > "$H/app/src/main/AndroidManifest.xml" <<'EOF'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
 <uses-permission android:name="android.permission.INTERNET"/>
 <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
 <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
 <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
 <queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>
 <application android:label="APOIS GPS PI V3" android:fullBackupContent="false" android:allowBackup="false" android:usesCleartextTraffic="false" android:theme="@android:style/Theme.Material.Light.NoActionBar">
  <activity android:name="br.com.apois.navigation.lab.FieldDynamicPilotActivity" android:exported="true">
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
grep -F "package: name='br.com.apois.navigation.field.v3.lab'" "$OUT/badging.txt"
grep -F 'android.permission.INTERNET' "$OUT/badging.txt"
! grep -F 'android.permission.ACCESS_BACKGROUND_LOCATION' "$OUT/badging.txt"
grep -F 'android.permission.ACCESS_FINE_LOCATION' "$OUT/badging.txt"
unzip -l "$APK" | grep -F 'assets/apois-field-pilot/pilot.pmtiles'
cp "$APK" "$OUT/APOIS-GPS-Piaui-Piloto-V3.apk"
cp "$P/route-report.json" "$OUT/"
(cd "$OUT" && sha256sum APOIS-GPS-Piaui-Piloto-V3.apk > SHA256SUMS.txt)
