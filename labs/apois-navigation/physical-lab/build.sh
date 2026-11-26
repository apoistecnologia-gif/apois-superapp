#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/apk-assertions.sh"
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
node "$ROOT/physical-lab/prepare.mjs" "$H" "$RUNNER_TEMP/apois-map-assets/apois-regional" "$RUNNER_TEMP/apois-route-assets"
cd "$H/android"
gradle :navigation-probe:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace
APK="$H/android/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
"$TOOLS/apksigner" verify --verbose --print-certs "$APK"
"$TOOLS/aapt" dump badging "$APK" > "$RUNNER_TEMP/apois-apk-badging.txt"
grep -F "package: name='br.com.apois.navigation.compat.lab'" "$RUNNER_TEMP/apois-apk-badging.txt"
grep -F "sdkVersion:'25'" "$RUNNER_TEMP/apois-apk-badging.txt"
lab_assert_absent 'android\.permission\.INTERNET' "$RUNNER_TEMP/apois-apk-badging.txt" || exit 1
lab_assert_absent 'android\.permission\.ACCESS_BACKGROUND_LOCATION' "$RUNNER_TEMP/apois-apk-badging.txt" || exit 1
grep -F "android.permission.ACCESS_FINE_LOCATION" "$RUNNER_TEMP/apois-apk-badging.txt"
unzip -Z1 "$APK" > "$RUNNER_TEMP/apois-physical-apk-files.txt"
for F in apois-regional/vale.pmtiles apois-regional/manifest.json apois-physical-pickup.json apois-physical-trip.json;do
 grep -Fx "assets/$F" "$RUNNER_TEMP/apois-physical-apk-files.txt"
done
test "$(unzip -p "$APK" assets/apois-regional/vale.pmtiles | sha256sum | cut -d ' ' -f1)" = 18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe
test "$(unzip -p "$APK" assets/apois-regional/manifest.json | sha256sum | cut -d ' ' -f1)" = 367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb
for phase in pickup trip;do
 expected=$(sha256sum "$RUNNER_TEMP/apois-route-assets/v21_$phase.json" | cut -d ' ' -f1)
 actual=$(unzip -p "$APK" "assets/apois-physical-$phase.json" | sha256sum | cut -d ' ' -f1)
 test "$expected" = "$actual"
done
OUT="$RUNNER_TEMP/apois-physical-apk"
mkdir -p "$OUT"
cp "$APK" "$OUT/APOIS-GPS-Teste-Fisico.apk"
cp "$RUNNER_TEMP/apois-apk-badging.txt" "$OUT/"
cp "$ROOT/physical-lab/TESTES.md" "$RUNNER_TEMP/apois-physical-apk-files.txt" "$OUT/"
printf '%s\n' "${GITHUB_SHA:?CI commit required}" > "$OUT/BUILD-COMMIT.txt"
cd "$OUT"
sha256sum APOIS-GPS-Teste-Fisico.apk > SHA256SUMS.txt
cat SHA256SUMS.txt
echo APOIS_PHYSICAL_APK_OK
