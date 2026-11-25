#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="$RUNNER_TEMP/apois-passenger-physical"
test ! -e "$H"
mkdir -p "$H/www"
cd "$H"
npm init -y >/dev/null
npm install --save-exact --no-audit --no-fund @capacitor/core@8.5.0 @capacitor/cli@8.5.0 @capacitor/android@8.5.0 maplibre-gl@4.7.1 pmtiles@3.2.0 esbuild@0.25.0
cp "$ROOT/physical-passenger/entry.mjs" .
cp "$ROOT/physical-passenger/index.html" www/
cp -a "$ROOT/passenger-provenance-snapshot" snapshot
node "$ROOT/physical-passenger/prepare.mjs" "$H" "$RUNNER_TEMP/apois-map-assets/android-assets/apois-regional" "$RUNNER_TEMP/apois-route-assets"
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
! grep -F "android.permission.INTERNET" "$RUNNER_TEMP/apois-passenger-badging.txt"
! grep -F "android.permission.ACCESS_FINE_LOCATION" "$RUNNER_TEMP/apois-passenger-badging.txt"
unzip -l "$APK" | grep -F 'assets/public/apois-regional/vale.pmtiles'
OUT="$RUNNER_TEMP/apois-passenger-apk"
mkdir -p "$OUT"
cp "$APK" "$OUT/APOIS-Passageiro-Teste-Fisico.apk"
cp "$RUNNER_TEMP/apois-passenger-badging.txt" "$OUT/"
cp "$ROOT/physical-passenger/TESTES.md" "$OUT/"
cd "$OUT"
sha256sum APOIS-Passageiro-Teste-Fisico.apk > SHA256SUMS.txt
cat SHA256SUMS.txt
echo APOIS_PASSENGER_PHYSICAL_APK_OK
