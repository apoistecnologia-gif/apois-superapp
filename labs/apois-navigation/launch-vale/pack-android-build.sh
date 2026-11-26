#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/apk-assertions.sh"
H="$RUNNER_TEMP/apois-embedded"
mkdir -p "$H/app/src/main/assets" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded"
cp "$ROOT/android/settings.gradle" "$H/settings.gradle"
sed -i "s/include ':probe'/include ':app'/" "$H/settings.gradle"
cp "$ROOT/android/gradle.properties" "$H/gradle.properties"
G="$RUNNER_TEMP/apois-vale-runtime-assets"
(cd "$G" && printf '%s\n' '38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433  apois-vale-data/graph.tar' '18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe  apois-regional/vale.pmtiles' '9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa  apois-vale-data/search.json' | sha256sum -c -)
cp -a "$G/." "$H/app/src/main/assets/"
cp "$ROOT/launch-vale/ValeRuntimePack.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
cp "$ROOT/launch-vale/InstalledValePackTest.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
cp "$ROOT/pack-store/OfflinePackStore.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
cp "$ROOT/field-v42/PilotSearchCatalog.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
cat > "$H/app/build.gradle" <<'EOF'
plugins { id 'com.android.application' version '9.0.1' }
android {
 namespace 'br.com.apois.navigation.embedded'
 compileSdk 36
 defaultConfig {
  applicationId 'br.com.apois.navigation.embedded.lab'
  minSdk 25
  targetSdk 36
  versionCode 1
  versionName '1.0-offline-probe'
  testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'
 }
 compileOptions { sourceCompatibility JavaVersion.VERSION_21; targetCompatibility JavaVersion.VERSION_21; coreLibraryDesugaringEnabled true }
}
dependencies {
 implementation 'io.github.rallista:valhalla-mobile:0.6.3'
 implementation 'io.github.rallista:valhalla-models:0.5.2'
 implementation 'io.github.rallista:valhalla-models-config:0.5.2'
 implementation 'com.stadiamaps:osrm-openapi:0.0.10'
 implementation 'com.stadiamaps.ferrostar:core:0.59.0'
 coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'
 androidTestImplementation 'androidx.test:runner:1.6.2'
 androidTestImplementation 'androidx.test.ext:junit:1.2.1'
}
EOF
cat > "$H/app/src/main/AndroidManifest.xml" <<'EOF'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
 <uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove"/>
 <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove"/>
 <application android:label="APOIS Embedded Probe" android:allowBackup="false" android:usesCleartextTraffic="false"/>
</manifest>
EOF
gradle -p "$H" :app:assembleDebug :app:assembleDebugAndroidTest --no-daemon --stacktrace
APK="$H/app/build/outputs/apk/debug/app-debug.apk"
TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
OUT="$RUNNER_TEMP/apois-embedded-report"
mkdir -p "$OUT"
"$TOOLS/aapt" dump badging "$APK" > "$OUT/badging.txt"
lab_assert_absent 'android\.permission\.(INTERNET|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|ACCESS_BACKGROUND_LOCATION)' "$OUT/badging.txt" || exit 1
unzip -l "$APK" > "$OUT/apk-files.txt"
for abi in arm64-v8a x86_64; do
 grep -F "lib/$abi/libvalhalla-wrapper.so" "$OUT/apk-files.txt"
done
stat -c '%s bytes (test APK)' "$APK" > "$OUT/size.txt"
(cd "$G" && sha256sum apois-vale-data/graph.tar apois-regional/vale.pmtiles apois-vale-data/search.json) > "$OUT/fixture.sha256"
gradle -p "$H" :app:dependencies --configuration debugRuntimeClasspath --no-daemon > "$OUT/dependencies.txt"
