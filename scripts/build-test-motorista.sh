#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
WORK="$ROOT/.work/motorista-test"
OUT="$ROOT/build/APOIS-Motorista.apk"

rm -rf "$WORK"
mkdir -p "$ROOT/.work" "$ROOT/build"
cp -R "$ROOT/sources/apois-corridas-motorista-admin" "$WORK"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
export APOIS_VERSION_CODE="${APOIS_MOTORISTA_VERSION_CODE:-1}"
export APOIS_VERSION_NAME="${APOIS_MOTORISTA_VERSION_NAME:-1.0.0}"
export APOIS_MOTORISTA_WORKSPACE=".work/motorista-test"

# Todo hardening acontece somente na cópia .work. Os repositórios-fonte
# permanecem protegidos e intocados.
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-motorista-field-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-direct-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-payment-wait.mjs"
node "$ROOT/scripts/harden-motorista-ride-flow-ui.mjs"
node "$ROOT/scripts/harden-motorista-voice-navigation-flow.mjs"
node "$ROOT/scripts/harden-motorista-map-branding.mjs"

cd "$WORK"

# O build mobile lê .env.mobile/.env.mobile.local. Sobrescrevemos somente
# dados browser-safe vindos do grupo Codemagic do APOIS.
{
  if [ -n "${CORRIDAS_VITE_SUPABASE_URL:-}" ]; then
    printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_VITE_SUPABASE_URL"
  fi
  if [ -n "${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
    printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY"
  fi
  if [ -n "${CORRIDAS_WEB_MAPS_API_KEY:-}" ]; then
    printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
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

# Falhar cedo se o bundle final não contém o fluxo completo homologado.
grep -R -Fq 'Conectar Mercado Pago' dist/client
grep -R -Fq 'mercadopago-oauth-start' dist/client
grep -R -Fq 'Recebimento direto' dist/client
grep -R -Fq 'VITE_GOOGLE_MAPS_API_KEY' src/lib/googleMaps.ts
grep -R -Fq 'Aguardando pagamento do passageiro' dist/client
grep -R -Fq 'Siga a rota até o ponto de embarque' dist/client
grep -R -Fq 'Nova corrida. Embarque em' dist/client
grep -R -Fq 'Pagamento efetuado. Siga até o embarque' dist/client
grep -R -Fq 'Chegada informada. Aguarde o passageiro e solicite o PIN' dist/client
grep -R -Fq 'Corrida iniciada. Siga a rota até' dist/client
grep -R -Fq 'toque em finalizar corrida' dist/client
grep -R -Fq 'Como foi o passageiro?' dist/client
grep -R -Fq 'Pular avaliação' dist/client
grep -Fq 'VOICE_PREF_MIGRATION_KEY' src/lib/voiceNav.ts
grep -Fq 'migrateVoicePreferenceOnce();' src/lib/voiceNav.ts
grep -Fq 'cleanVoiceInstruction(step.instruction)' src/lib/voiceNav.ts
grep -Fq 'Em ${meters} metros' src/lib/voiceNav.ts
grep -Fq 'APOIS_DRIVER_LOCATION_A_PATH' src/components/mapMarkers.tsx
grep -Fq 'strokeColor: "#F6BE1C"' src/routes/motorista.app.tsx
grep -Fq 'tickNavigation' src/routes/motorista.app.tsx
grep -Fq 'registerPlugin(DriverVoicePlugin.class)' android/app/src/main/java/com/apois/motorista/MainActivity.java
grep -Fq '@CapacitorPlugin(name = "DriverVoice")' android/app/src/main/java/com/apois/motorista/DriverVoicePlugin.java
if grep -R -Fq 'Solicitar saque' dist/client; then
  echo '[FAIL] fluxo antigo de solicitar saque ainda presente no bundle Motorista'
  exit 1
fi

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

echo "[OK] APOIS Motorista gerado em $OUT com voz nativa + navegação guiada + avaliação + recebimento direto"
