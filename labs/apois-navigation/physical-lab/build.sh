#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="$RUNNER_TEMP/apois-physical-host"
test ! -e "$H"
mkdir -p "$H/www"
cd "$H"
npm init -y >/dev/null
npm install --save-exact --no-audit --no-fund @capacitor/core@8.5.0 @capacitor/cli@8.5.0 @capacitor/android@8.5.0
cp "$ROOT/physical-lab/"{index.html,main.mjs} www/
cp "$ROOT/host-compat/demo/scenario.mjs" www/
printf '{"appId":"br.com.apois.navigation.compat.lab","appName":"APOIS GPS Teste","webDir":"www"}' > capacitor.config.json
npx cap add android
node "$ROOT/host-compat/prepare-host.mjs" "$H" "$ROOT"
node "$ROOT/physical-lab/prepare.mjs" "$H" "$RUNNER_TEMP/apois-map-assets/android-assets/apois-regional" "$RUNNER_TEMP/apois-route-assets"
cd "$H/android"
gradle :navigation-probe:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace
APK="$H/android/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
"$TOOLS/apksigner" verify --verbose --print-certs "$APK"
"$TOOLS/aapt" dump badging "$APK" > "$RUNNER_TEMP/apois-apk-badging.txt"
grep -F "package: name='br.com.apois.navigation.compat.lab'" "$RUNNER_TEMP/apois-apk-badging.txt"
grep -F "sdkVersion:'25'" "$RUNNER_TEMP/apois-apk-badging.txt"
! grep -F "android.permission.INTERNET" "$RUNNER_TEMP/apois-apk-badging.txt"
! grep -F "android.permission.ACCESS_BACKGROUND_LOCATION" "$RUNNER_TEMP/apois-apk-badging.txt"
grep -F "android.permission.ACCESS_FINE_LOCATION" "$RUNNER_TEMP/apois-apk-badging.txt"
unzip -l "$APK" | grep -F 'assets/apois-regional/vale.pmtiles'
unzip -l "$APK" | grep -F 'assets/apois-physical-trip.json'
OUT="$RUNNER_TEMP/apois-physical-apk"
mkdir -p "$OUT"
cp "$APK" "$OUT/APOIS-GPS-Teste-Fisico.apk"
cp "$RUNNER_TEMP/apois-apk-badging.txt" "$OUT/"
cp "$ROOT/physical-lab/TESTES.md" "$OUT/"
cd "$OUT"
sha256sum APOIS-GPS-Teste-Fisico.apk > SHA256SUMS.txt
cat SHA256SUMS.txt
echo APOIS_PHYSICAL_APK_OK
