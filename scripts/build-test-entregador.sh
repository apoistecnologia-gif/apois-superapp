#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
WORK="$ROOT/.work/entregador-test"
OUT="$ROOT/build/APOIS-Entregador.apk"

rm -rf "$WORK"
mkdir -p "$ROOT/.work" "$ROOT/build"
cp -R "$ROOT/sources/apois-entregas" "$WORK"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
export APOIS_MOBILE_PRODUCT="courier"
export APOIS_MOBILE_BUILD="1"
export VITE_APOIS_PRODUCT_MODE="courier"
export VITE_APOIS_NATIVE_SCHEME="br.com.apois.entregador"
export APP_ROUTE="/courier"
export APP_PACKAGE="br.com.apois.entregador"
export APP_LABEL="APOIS Entregador"
export APOIS_ENTREGAS_WORKSPACE=".work/entregador-test"
export APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.entregador"
export APOIS_ENTREGAS_AUTH_HOME="/courier"

cd "$ROOT"
node "$ROOT/scripts/harden-entregas-auth-entry.mjs"
cd "$WORK"

bun install
bun run build

grep -R -Fq 'Continuar com Google' .output
grep -R -Fq 'Esqueci minha senha' .output

HOST=127.0.0.1 PORT=4173 node .output/server/index.mjs >/tmp/apois-entregador-mobile-server.log 2>&1 &
SERVER_PID=$!
cleanup_server() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --location "http://127.0.0.1:4173${APP_ROUTE}" -o .output/public/index.html; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    cat /tmp/apois-entregador-mobile-server.log
    exit 1
  fi
  sleep 1
done
test -s .output/public/index.html
cleanup_server
trap - EXIT

rm -rf android
npm install --no-save \
  @capacitor/core@8.4.2 \
  @capacitor/cli@8.4.2 \
  @capacitor/android@8.4.2 \
  @capacitor/geolocation@8.2.0 \
  @capacitor/push-notifications@8.1.2 \
  @capacitor/app@8.0.0 \
  @capacitor/browser@8.0.0
npx cap add android
printf 'sdk.dir=%s\n' "$ANDROID_SDK_ROOT" > android/local.properties

# O google-services.json unificado que já alimenta o Superapp contém também
# br.com.apois.entregador. Se existir uma variável específica do Courier,
# ela tem prioridade; caso contrário reutilizamos a configuração unificada.
FIREBASE_B64="${FIREBASE_COURIER_GOOGLE_SERVICES_JSON_BASE64:-${FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64:-}}"
if [ -z "$FIREBASE_B64" ]; then
  echo '[FAIL] Firebase ausente: configure FIREBASE_COURIER_GOOGLE_SERVICES_JSON_BASE64 ou mantenha FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64 no grupo apois_android.'
  exit 1
fi
printf '%s' "$FIREBASE_B64" | base64 --decode > android/app/google-services.json
grep -Fq '"package_name": "br.com.apois.entregador"' android/app/google-services.json

npx cap sync android
bun run android:configure
node scripts/apply-android-branding.mjs

grep -Fq 'android.permission.ACCESS_FINE_LOCATION' android/app/src/main/AndroidManifest.xml
grep -Fq 'android.permission.ACCESS_COARSE_LOCATION' android/app/src/main/AndroidManifest.xml
grep -Fq 'android:scheme="br.com.apois.entregador"' android/app/src/main/AndroidManifest.xml
grep -Fq '@drawable/apois_launcher' android/app/src/main/AndroidManifest.xml

cd android
./gradlew clean assembleRelease --no-daemon --stacktrace
cd "$ROOT"

UNSIGNED="$WORK/android/app/build/outputs/apk/release/app-release-unsigned.apk"
if [ ! -s "$UNSIGNED" ]; then
  UNSIGNED="$(find "$WORK/android/app/build/outputs/apk/release" -name '*.apk' | head -n 1)"
fi
test -n "$UNSIGNED"
test -s "$UNSIGNED"

BUILD_TOOLS="$(find "$ANDROID_SDK_ROOT/build-tools" -maxdepth 1 -mindepth 1 -type d | sort -V | tail -n 1)"
test -x "$BUILD_TOOLS/zipalign"
test -x "$BUILD_TOOLS/apksigner"
ALIGNED="$ROOT/build/APOIS-Entregador-aligned.apk"

"$BUILD_TOOLS/zipalign" -f -P 16 4 "$UNSIGNED" "$ALIGNED"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$CM_KEYSTORE_PATH" \
  --ks-key-alias "$CM_KEY_ALIAS" \
  --ks-pass "pass:$CM_KEYSTORE_PASSWORD" \
  --key-pass "pass:$CM_KEY_PASSWORD" \
  --out "$OUT" \
  "$ALIGNED"
"$BUILD_TOOLS/zipalign" -v -c -P 16 4 "$OUT"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$OUT"
rm -f "$ALIGNED"
test -s "$OUT"

echo "[OK] APOIS Entregador gerado em $OUT com Google + recuperação de senha"
