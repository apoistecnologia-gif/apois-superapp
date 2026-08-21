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
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-motorista-field-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-direct-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-payment-wait.mjs"
node "$ROOT/scripts/harden-motorista-ride-flow-ui.mjs"
node "$ROOT/scripts/harden-motorista-map-branding.mjs"

cd "$MOTORISTA"
{
  printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_VITE_SUPABASE_URL"
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY"
  printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
  printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_WEB_MAPS_API_KEY"
} > .env.mobile.local
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
bun install
npm run build:motorista

require_contains 'Conectar Mercado Pago' dist/client 'conexão Mercado Pago presente'
require_contains 'mercadopago-oauth-start' dist/client 'OAuth Mercado Pago presente'
require_contains 'Recebimento direto' dist/client 'recebimento direto presente'
require_contains 'Aguardando pagamento do passageiro' dist/client 'espera de pagamento presente'
require_contains 'Siga a rota até o ponto de embarque' dist/client 'orientação até embarque presente'
require_contains 'Pagamento confirmado. Siga até o ponto de embarque.' dist/client 'transição pós-Pix presente'
require_contains 'Como foi o passageiro?' dist/client 'avaliação final presente'
require_contains 'Pular avaliação' dist/client 'saída segura da avaliação presente'
require_contains 'Nova corrida' dist/client 'voz de nova corrida presente'
require_contains 'Viagem iniciada. Boa viagem.' dist/client 'voz de início da viagem presente'

# voiceNav.ts não usa uma variável chamada voiceEnabled. O comportamento real é:
# sem preferência salva => true; depois a preferência do motorista é respeitada.
require_contains 'let enabled = readStoredVoicePreference();' src/lib/voiceNav.ts 'estado de voz carregado no início'
require_contains 'return stored === null ? true : stored !== "false";' src/lib/voiceNav.ts 'voz ativa por padrão na primeira execução'
require_contains 'APOIS_DRIVER_LOCATION_A_PATH' src/components/mapMarkers.tsx 'marcador APOIS com A presente'
require_contains 'strokeColor: "#F6BE1C"' src/routes/motorista.app.tsx 'rota dourada APOIS presente'

if grep -R -Fq 'Solicitar saque' dist/client; then
  echo '[FAIL] fluxo antigo de saque ainda presente no bundle Motorista'
  exit 1
fi
echo '[OK] validação Motorista: opção Solicitar saque ausente'

# ---------------- Entregador ----------------
cd "$ENTREGADOR"
export APOIS_MOBILE_PRODUCT="courier"
export APOIS_MOBILE_BUILD="1"
export VITE_APOIS_PRODUCT_MODE="courier"
export APP_ROUTE="/courier"
export APP_PACKAGE="br.com.apois.parceiro"
export APP_LABEL="APOIS Parceiro"
bun install
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

# O HTML renderizado pelo servidor usa URLs absolutas. Dentro do shell Parceiro
# ele vive em modules/entregador, então os assets precisam ser relativos.
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
