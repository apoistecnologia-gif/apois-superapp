#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
WORK="$ROOT/.work/motorista-test"
OUT="$ROOT/build/APOIS-Motorista.apk"

rm -rf "$WORK"
mkdir -p "$ROOT/.work" "$ROOT/build"
cp -R "$ROOT/sources/apois-corridas-motorista-admin" "$WORK"
cd "$WORK"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
export APOIS_VERSION_CODE="${APOIS_MOTORISTA_VERSION_CODE:-1}"
export APOIS_VERSION_NAME="${APOIS_MOTORISTA_VERSION_NAME:-1.0.0}"

# O build mobile lê .env.mobile/.env.mobile.local. Sobrescrevemos apenas dados
# browser-safe vindos do mesmo grupo Codemagic usado pelo Superapp.
{
  if [ -n "${CORRIDAS_VITE_SUPABASE_URL:-}" ]; then
    printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_VITE_SUPABASE_URL"
  fi
  if [ -n "${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
    printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY"
  fi
  if [ -n "${CORRIDAS_WEB_MAPS_API_KEY:-}" ]; then
    printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
  fi
} > .env.mobile.local

bun install
npm run build:motorista
npm run sync:motorista
printf 'sdk.dir=%s\n' "$ANDROID_SDK_ROOT" > android/local.properties

# O snapshot protegido já contém google-services.json para com.apois.motorista.
test -s android/app/google-services.json
grep -Fq 'com.apois.motorista' android/app/google-services.json
node scripts/verify-mobile-native.mjs motorista --live

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
ALIGNED="$ROOT/build/APOIS-Motorista-aligned.apk"

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

echo "[OK] APOIS Motorista gerado em $OUT"
