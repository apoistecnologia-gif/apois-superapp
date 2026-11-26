#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="$RUNNER_TEMP/apois-embedded"
mkdir -p "$H/app/src/main/assets" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded"
cp "$ROOT/android/settings.gradle" "$H/settings.gradle"
sed -i "s/include ':probe'/include ':app'/" "$H/settings.gradle"
cp "$ROOT/android/gradle.properties" "$H/gradle.properties"
if [[ -n "${APOIS_PIAUI_GRAPH_DIR:-}" ]]; then
    # Pin the exact graph artifact approved in run 45742837044, not a mutable download.
    G="$APOIS_PIAUI_GRAPH_DIR"
    (cd "$G" && printf '%s\n' '3d8ddee2d42886b1846d86477b44ca7fabc050227e48c767836699050b23dd31  graph-manifest.json' 'b0f3de3041ec8994c77eb678e416db86f93e9dc3d95a7416114b55059a393344  valhalla_tiles.tar' | sha256sum -c -)
    cp "$G/valhalla_tiles.tar" "$H/app/src/main/assets/"
    cp "$G/graph-manifest.json" "$H/app/src/main/assets/"
    cp "$G/OSM-NOTICE.txt" "$H/app/src/main/assets/"
    cp "$ROOT/embedded-piaui/EmbeddedPiauiRouteTest.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
else
    cp "$ROOT/embedded-probe/EmbeddedRouteTest.kt" "$H/app/src/androidTest/java/br/com/apois/navigation/embedded/"
    # Upstream fixture, public OSM data, pinned Git blob. Never downloads real user locations.
    git -C "$GITHUB_WORKSPACE/.valhalla-mobile-source" show b47ad5a9aa5d907df329bd2a0bfcc9080220c9d8:android/valhalla/src/androidTest/assets/valhalla_tiles.tar > "$H/app/src/main/assets/valhalla_tiles.tar"
    test "$(git hash-object "$H/app/src/main/assets/valhalla_tiles.tar")" = 774d4cc66470fe825476f4441fb5964d36650cf9
fi
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
! grep -E "android.permission.(INTERNET|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|ACCESS_BACKGROUND_LOCATION)" "$OUT/badging.txt"
unzip -l "$APK" > "$OUT/apk-files.txt"
for abi in arm64-v8a x86_64; do
 grep -F "lib/$abi/libvalhalla-wrapper.so" "$OUT/apk-files.txt"
done
stat -c '%s bytes (test APK)' "$APK" > "$OUT/size.txt"
sha256sum "$H/app/src/main/assets/valhalla_tiles.tar" > "$OUT/fixture.sha256"
gradle -p "$H" :app:dependencies --configuration debugRuntimeClasspath --no-daemon > "$OUT/dependencies.txt"
