#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/emulator-common/apk-assertions.sh"
H="$RUNNER_TEMP/apois-passenger-physical"
test ! -e "$H"
mkdir -p "$H/www"
cd "$H"
npm init -y >/dev/null
npm install --save-exact --no-audit --no-fund @capacitor/core@8.5.0 @capacitor/cli@8.5.0 @capacitor/android@8.5.0 maplibre-gl@4.7.1 pmtiles@3.2.0 esbuild@0.25.0
cp "$ROOT/physical-passenger/entry.mjs" .
cp "$ROOT/physical-passenger/index.html" www/
cp -a "$ROOT/passenger-provenance-snapshot" snapshot
node "$ROOT/physical-passenger/prepare.mjs" "$H" "$RUNNER_TEMP/apois-map-assets/apois-regional" "$RUNNER_TEMP/apois-route-assets"
./node_modules/.bin/esbuild entry.mjs --bundle --format=esm --outfile=www/bundle.js
printf '{"appId":"br.com.apois.navigation.passenger.lab","appName":"APOIS Passageiro Teste","webDir":"www"}' > capacitor.config.json
npx cap add android
node --input-type=module -e 'import fs from "node:fs";const p="android/app/src/main/AndroidManifest.xml";let s=fs.readFileSync(p,"utf8");s=s.replace("xmlns:android=\"http://schemas.android.com/apk/res/android\"","xmlns:android=\"http://schemas.android.com/apk/res/android\" xmlns:tools=\"http://schemas.android.com/tools\"").replace(/<uses-permission\s+android:name="android.permission.INTERNET"\s*\/>/g,"").replace("</manifest>","<uses-permission android:name=\"android.permission.INTERNET\" tools:node=\"remove\" /></manifest>");fs.writeFileSync(p,s)'
cd android
gradle :app:assembleDebug --no-daemon --stacktrace
APK="$H/android/app/build/outputs/apk/debug/app-debug.apk"
TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
"$TOOLS/apksigner" verify --verbose "$APK"
"$TOOLS/aapt" dump badging "$APK" > "$RUNNER_TEMP/apois-passenger-badging.txt"
grep -F "package: name='br.com.apois.navigation.passenger.lab'" "$RUNNER_TEMP/apois-passenger-badging.txt"
lab_assert_absent 'android\.permission\.INTERNET' "$RUNNER_TEMP/apois-passenger-badging.txt" || exit 1
lab_assert_absent 'android\.permission\.(ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|ACCESS_BACKGROUND_LOCATION)' "$RUNNER_TEMP/apois-passenger-badging.txt" || exit 1
unzip -Z1 "$APK" > "$RUNNER_TEMP/apois-passenger-apk-files.txt"
grep -Fx 'assets/public/apois-regional/vale.pmtiles' "$RUNNER_TEMP/apois-passenger-apk-files.txt"
test "$(unzip -p "$APK" assets/public/apois-regional/vale.pmtiles | sha256sum | cut -d ' ' -f 1)" = 18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe
test "$(unzip -p "$APK" assets/public/apois-regional/manifest.json | sha256sum | cut -d ' ' -f 1)" = 367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb
OUT="$RUNNER_TEMP/apois-passenger-apk"
mkdir -p "$OUT"
cp "$APK" "$OUT/APOIS-Passageiro-Teste-Fisico.apk"
cp "$RUNNER_TEMP/apois-passenger-badging.txt" "$OUT/"
cp "$ROOT/physical-passenger/TESTES.md" "$OUT/"
cp "$H/fixture-provenance.json" "$RUNNER_TEMP/apois-passenger-apk-files.txt" "$OUT/"
printf '%s\n' "${GITHUB_SHA:?CI commit required}" > "$OUT/BUILD-COMMIT.txt"
cd "$OUT"
sha256sum APOIS-Passageiro-Teste-Fisico.apk > SHA256SUMS.txt
cat SHA256SUMS.txt
echo APOIS_PASSENGER_PHYSICAL_APK_OK
