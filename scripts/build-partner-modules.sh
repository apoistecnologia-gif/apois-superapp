#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
MOTORISTA="$ROOT/.work/partner-motorista"
ENTREGADOR="$ROOT/.work/partner-entregador"

rm -rf "$MOTORISTA" "$ENTREGADOR"
mkdir -p "$ROOT/.work"
cp -R "$ROOT/sources/apois-corridas-motorista-admin" "$MOTORISTA"
cp -R "$ROOT/sources/apois-entregas" "$ENTREGADOR"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

require_contains() {
  local needle="$1"
  local target="$2"
  local label="$3"
  if ! grep -R -Fq "$needle" "$target"; then
    echo "[FAIL] validação Motorista: $label"
    echo "       esperado: $needle"
    echo "       em: $target"
    exit 1
  fi
  echo "[OK] validação Motorista: $label"
}

# ---------------- Motorista ----------------
export APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"
node "$ROOT/scripts/harden-motorista-auth.mjs"
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-motorista-field-mercadopago.mjs"
node "$ROOT/scripts/harden-partner-mercadopago-callback.mjs"
node "$ROOT/scripts/harden-motorista-mercadopago-disconnect.mjs"
node "$ROOT/scripts/harden-motorista-direct-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-payment-wait.mjs"
node "$ROOT/scripts/harden-motorista-ride-flow-ui.mjs"
node "$ROOT/scripts/harden-motorista-voice-navigation-flow.mjs"
node "$ROOT/scripts/harden-motorista-finalize-feedback.mjs"
node "$ROOT/scripts/harden-motorista-self-rating.mjs"
node "$ROOT/scripts/harden-motorista-voice-dedup.mjs"
node "$ROOT/scripts/harden-motorista-map-branding.mjs"

cd "$MOTORISTA"
require_contains 'appTarget: "partner"' src/components/payments/MercadoPagoSellerCard.tsx 'OAuth Mercado Pago usa callback exclusivo do APOIS Parceiro'
require_contains 'Desconectar Mercado Pago' src/components/payments/MercadoPagoSellerCard.tsx 'desconexão segura do Mercado Pago presente'
{
  printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_VITE_SUPABASE_URL"
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY"
  printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
  printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
} > .env.mobile.local
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
bun install --frozen-lockfile
npm run build:motorista

require_contains 'Continuar com Google' dist/client 'login Google presente'
require_contains 'Esqueci minha senha' dist/client 'recuperação de senha presente'
require_contains 'Conectar Mercado Pago' dist/client 'conexão Mercado Pago presente'
require_contains 'mercadopago-oauth-start' dist/client 'OAuth Mercado Pago presente'
require_contains 'Recebimento direto' dist/client 'recebimento direto presente'
require_contains 'Aguardando pagamento do passageiro' dist/client 'espera de pagamento presente'
require_contains 'Siga a rota até o ponto de embarque' dist/client 'orientação visual até embarque presente'
require_contains 'Nova corrida. Embarque em' dist/client 'voz de nova corrida presente'
require_contains 'Pagamento efetuado. Siga até o embarque' dist/client 'voz pós-Pix presente'
require_contains 'Chegada informada. Aguarde o passageiro e solicite o PIN' dist/client 'voz de chegada e PIN presente'
require_contains 'Corrida iniciada. Siga a rota até' dist/client 'voz de início com destino presente'
require_contains 'toque em finalizar corrida' dist/client 'voz de chegada ao destino presente'
require_contains 'Como foi o passageiro?' dist/client 'avaliação final presente'
require_contains 'Pular avaliação' dist/client 'saída segura da avaliação presente'
require_contains 'Avaliação de teste concluída' dist/client 'autoavaliação de homologação não quebra o fluxo'
require_contains 'VOICE_PREF_MIGRATION_KEY' src/lib/voiceNav.ts 'migração de voz presente'
require_contains 'migrateVoicePreferenceOnce();' src/lib/voiceNav.ts 'voz reativada na migração'
require_contains 'cleanVoiceInstruction(step.instruction)' src/lib/voiceNav.ts 'instruções de rua normalizadas para TTS'
require_contains 'instructionKey = cleanVoiceInstruction(step.instruction)' src/lib/voiceNav.ts 'falas por rua/manobra são deduplicadas'
require_contains 'Em ${meters} metros' src/lib/voiceNav.ts 'navegação curva a curva presente'
require_contains 'APOIS_DRIVER_LOCATION_A_PATH' src/components/mapMarkers.tsx 'marcador APOIS com A presente'
require_contains 'strokeColor: "#F6BE1C"' src/routes/motorista.app.tsx 'rota dourada APOIS presente'
require_contains 'tickNavigation' src/routes/motorista.app.tsx 'motorista recebe orientação por voz durante deslocamento'
require_contains 'readableFunctionInvokeError' src/lib/driverRideLifecycle.mobile.ts 'erro real da Edge Function é traduzido'
require_contains 'Não foi possível finalizar a corrida.' src/routes/motorista.app.tsx 'falha de finalização é visível ao motorista'

if grep -R -Fq 'Solicitar saque' dist/client; then
  echo '[FAIL] fluxo antigo de saque ainda presente no bundle Motorista'
  exit 1
fi
echo '[OK] validação Motorista: opção Solicitar saque ausente'

# ---------------- Entregador ----------------
cd "$ROOT"
export APOIS_ENTREGAS_WORKSPACE=".work/partner-entregador"
export APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.parceiro"
export APOIS_ENTREGAS_AUTH_HOME="/courier"
node "$ROOT/scripts/harden-entregas-auth-entry.mjs"
node "$ROOT/scripts/harden-partner-entregador-push.mjs"

cd "$ENTREGADOR"
require_contains 'register_courier_push_device_v2' src/lib/courier-push.ts 'registro Push v2 do Entregador presente'
require_contains '_app_package: "br.com.apois.parceiro"' src/lib/courier-push.ts 'token Push vinculado ao package do Parceiro'
if grep -Fq 'window.location.assign("/courier")' src/lib/courier-push.ts; then
  echo '[FAIL] Entregador ainda tenta abrir rota absoluta /courier dentro do bundle aninhado'
  exit 1
fi
export APOIS_MOBILE_PRODUCT="courier"
export APOIS_MOBILE_BUILD="1"
export VITE_APOIS_PRODUCT_MODE="courier"
export VITE_APOIS_NATIVE_SCHEME="br.com.apois.parceiro"
export APP_ROUTE="/courier"
export APP_PACKAGE="br.com.apois.parceiro"
export APP_LABEL="APOIS Parceiro"
bun install --frozen-lockfile
bun run build

HOST=127.0.0.1 PORT=4173 node .output/server/index.mjs >/tmp/apois-parceiro-entregador.log 2>&1 &
SERVER_PID=$!
cleanup_server() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --location "http://127.0.0.1:4173${APP_ROUTE}" -o .output/public/index.html; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    cat /tmp/apois-parceiro-entregador.log
    exit 1
  fi
  sleep 1
done
cleanup_server
trap - EXIT
test -s .output/public/index.html

node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const path = '.output/public/index.html';
let html = readFileSync(path, 'utf8');
html = html
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace(/(src|href)='\/(?!\/)/g, "$1='./");
writeFileSync(path, html, 'utf8');
NODE

cd "$ROOT"
node superapp/partner-shell/build.mjs
test -s superapp/partner-shell/dist/index.html
test -s superapp/partner-shell/dist/modules/motorista/index.html
test -s superapp/partner-shell/dist/modules/entregador/index.html

echo '[OK] módulos do APOIS Parceiro compilados: Motorista + Entregador'
