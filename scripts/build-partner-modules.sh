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

# ---------------- Motorista ----------------
export APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-motorista-field-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-direct-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-payment-wait.mjs"

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
grep -R -Fq 'Conectar Mercado Pago' dist/client
grep -R -Fq 'mercadopago-oauth-start' dist/client
grep -R -Fq 'Recebimento direto' dist/client
grep -R -Fq 'Aguardando pagamento do passageiro' dist/client
if grep -R -Fq 'Solicitar saque' dist/client; then
  echo '[FAIL] fluxo antigo de saque ainda presente no bundle Motorista'
  exit 1
fi

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
