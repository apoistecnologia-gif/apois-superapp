#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
MOTORISTA="$ROOT/.work/partner-motorista"
ENTREGADOR="$ROOT/.work/partner-entregador"

rm -rf "$MOTORISTA" "$ENTREGADOR"
mkdir -p "$MOTORISTA" "$ENTREGADOR"
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-corridas-motorista-admin" -cf - . | tar -C "$MOTORISTA" -xf -
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-entregas" -cf - . | tar -C "$ENTREGADOR" -xf -
node "$ROOT/scripts/normalize-partner-workspaces.mjs" "$MOTORISTA" "$ENTREGADOR"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

require_contains() {
  local needle="$1" target="$2" label="$3"
  if ! grep -R -Fq "$needle" "$target"; then
    echo "[FAIL] $label: marcador ausente: $needle"
    exit 1
  fi
  echo "[OK] $label"
}

forbid_bundle() {
  local needle="$1" target="$2" label="$3"
  if grep -R -Fiq "$needle" "$target"; then
    echo "[FAIL] $label: marcador proibido: $needle"
    exit 1
  fi
  echo "[OK] $label"
}

# ---------------- Motorista ----------------
export APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"
node "$ROOT/scripts/harden-motorista-auth.mjs"
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-partner-motorista-onboarding.mjs"
node "$ROOT/scripts/harden-motorista-document-boundary.mjs"
node "$ROOT/scripts/harden-motorista-provider-boundary.mjs"
node "$ROOT/scripts/harden-motorista-finance-boundary.mjs"
node "$ROOT/scripts/harden-motorista-ride-flow-ui.mjs"
node "$ROOT/scripts/harden-motorista-voice-navigation-flow.mjs"
node "$ROOT/scripts/harden-motorista-direct-ride-copy.mjs"
node "$ROOT/scripts/harden-motorista-finalize-feedback.mjs"
node "$ROOT/scripts/harden-partner-motorista-finish-authority.mjs"
node "$ROOT/scripts/harden-motorista-self-rating.mjs"
node "$ROOT/scripts/harden-partner-motorista-post-finish.mjs"
node "$ROOT/scripts/harden-partner-motorista-cancel-ux.mjs"
node "$ROOT/scripts/harden-partner-motorista-passenger-avatar.mjs"
node "$ROOT/scripts/harden-partner-motorista-pin-ui.mjs"
node "$ROOT/scripts/harden-partner-motorista-rating-handoff.mjs"
node "$ROOT/scripts/harden-motorista-voice-dedup.mjs"
node "$ROOT/scripts/harden-motorista-map-branding.mjs"
node "$ROOT/scripts/harden-partner-motorista-map-polish.mjs"
node "$ROOT/scripts/harden-partner-motorista-payment-policy.mjs"
node "$ROOT/scripts/harden-partner-motorista-push.mjs"
node "$ROOT/scripts/harden-partner-motorista-push-runtime.mjs"
node "$ROOT/scripts/harden-partner-motorista-active-resume.mjs"
node "$ROOT/scripts/harden-partner-motorista-offer-poll.mjs"
node "$ROOT/scripts/harden-partner-motorista-native-gps.mjs"
node "$ROOT/scripts/harden-partner-motorista-native-watch.mjs"
node "$ROOT/scripts/harden-partner-motorista-mobile-base.mjs"

cd "$MOTORISTA"
require_contains 'PARTNER_PENDING_PUSH_KEY' src/lib/nativeBridge.ts 'Motorista encaminha push cruzado ao shell'
require_contains 'window.location.hash = "#/motorista/app"' src/lib/nativeBridge.ts 'Push do Motorista usa rota hash interna'
require_contains 'Geolocation.watchPosition(' src/routes/motorista.app.tsx 'Motorista acompanha GPS nativo'
require_contains 'stopDriverWatch();' src/routes/motorista.app.tsx 'Motorista encerra watcher GPS'
require_contains 'driver-finish-redispatch' src/lib/driverRideLifecycle.mobile.ts 'Finalização usa lifecycle canônico'
require_contains 'settlement?.driver_earning ?? settlement?.passenger_charge' 'src/routes/motorista.corridas.$id.tsx' 'Histórico usa ganho autorizado'
require_contains 'Pagamento eletrônico temporariamente indisponível' src/routes/motorista.assinatura.tsx 'Mensalidade informa indisponibilidade sem CTA morto'
require_contains 'Corrida aceita. Siga até o embarque' src/routes/motorista.app.tsx 'Motorista segue diretamente ao embarque após aceitar corrida'

CORRIDAS_URL_VALUE="${CORRIDAS_VITE_SUPABASE_URL:-}"
CORRIDAS_KEY_VALUE="${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}"
CORRIDAS_MAPS_KEY_VALUE="${CORRIDAS_WEB_MAPS_API_KEY:-}"
if [ -z "$CORRIDAS_URL_VALUE" ] || [ -z "$CORRIDAS_KEY_VALUE" ] || [ -z "$CORRIDAS_MAPS_KEY_VALUE" ]; then
  echo '[FAIL] Motorista: env Corridas URL/key/Maps é obrigatório para build release.'
  exit 1
fi
case "$CORRIDAS_URL_VALUE" in
  *tbbzkrfupmqdywnzgnms.supabase.co) ;;
  *) echo '[FAIL] Motorista: Supabase não é o projeto Corridas canônico.'; exit 1 ;;
esac
{
  printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_URL_VALUE"
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_KEY_VALUE"
  printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
  printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
} > .env.mobile.local

AUTH_SETTINGS_STATUS="$(curl --silent --show-error --output /tmp/apois-corridas-auth-settings.json --write-out '%{http_code}' \
  -H "apikey: $CORRIDAS_KEY_VALUE" \
  "$CORRIDAS_URL_VALUE/auth/v1/settings")"
if [ "$AUTH_SETTINGS_STATUS" != "200" ]; then
  echo "[FAIL] Motorista: publishable key não foi aceita pelo projeto Corridas atual (HTTP $AUTH_SETTINGS_STATUS)."
  rm -f /tmp/apois-corridas-auth-settings.json
  exit 1
fi
rm -f /tmp/apois-corridas-auth-settings.json
echo '[OK] Motorista: publishable key validada diretamente no Supabase Corridas atual'
unset VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_PUBLISHABLE_KEY
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
cd "$ROOT"
node "$ROOT/scripts/reconcile-partner-motorista-lockfile.mjs"
cd "$MOTORISTA"
bun install --frozen-lockfile
bun run typecheck
npm run build:motorista
cd "$ROOT"
node "$ROOT/scripts/audit-motorista-release-surface.mjs"
cd "$MOTORISTA"

require_contains 'tbbzkrfupmqdywnzgnms.supabase.co' dist/client 'Bundle Motorista usa Supabase Corridas'
forbid_bundle 'sbvhdgyuuperszlsllji.supabase.co' dist/client 'Bundle Motorista isolado de Entregas'
require_contains 'Continuar com Google' dist/client 'Google login do Motorista presente'
require_contains 'Esqueci minha senha' dist/client 'Recovery do Motorista presente'
require_contains 'Pagamento eletrônico temporariamente indisponível' dist/client 'Mensalidade sem gateway presente'
require_contains 'Recebimento direto' dist/client 'Política de recebimento direto presente'
require_contains 'Nova corrida. Embarque em' dist/client 'Voz de oferta presente'
require_contains 'Corrida aceita. Siga até o embarque' dist/client 'Motorista não depende de hold de gateway para iniciar deslocamento'
require_contains 'Chegada informada. Aguarde o passageiro e solicite o PIN' dist/client 'Chegada/PIN presente'
require_contains 'Corrida iniciada. Siga a rota até' dist/client 'Início da corrida presente'
require_contains 'toque em finalizar corrida' dist/client 'Finalização orientada presente'
forbid_bundle 'Mercado Pago' dist/client 'Motorista sem Mercado Pago ativo'
forbid_bundle 'mercadopago-' dist/client 'Motorista sem endpoint Mercado Pago ativo'
forbid_bundle 'asaas-create-driver' dist/client 'Motorista sem provisionamento Asaas'
forbid_bundle 'Solicitar saque' dist/client 'Motorista sem saque custodial legado'

# ---------------- Entregador ----------------
cd "$ROOT"
export APOIS_ENTREGAS_WORKSPACE=".work/partner-entregador"
export APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.parceiro"
export APOIS_ENTREGAS_AUTH_HOME="/courier"
node "$ROOT/scripts/harden-entregas-auth-entry.mjs"
node "$ROOT/scripts/harden-partner-entregador-router.mjs"
node "$ROOT/scripts/harden-partner-entregador-hash-boundary.mjs"
node "$ROOT/scripts/harden-partner-entregador-push.mjs"
# Umbrella: aplica jornada, concorrência, GPS/background, sessão, financeiro manual, privacidade e UI.
node "$ROOT/scripts/harden-partner-entregador-map.mjs"

cd "$ENTREGADOR"
require_contains 'register_courier_push_device_v2' src/lib/courier-push.ts 'Push do Entregador registrado'
require_contains 'const COURIER_ACTION_TIMEOUT_MS = 20_000;' src/routes/courier.tsx 'Ações do Entregador têm timeout'
require_contains 'const transitionJobId = activeJob.id;' src/routes/courier.tsx 'Transição captura delivery correta'
require_contains 'setCompletedJob({ ...deliveredJob, status: "delivered" });' src/routes/courier.tsx 'Conclusão operacional separada do financeiro'
require_contains 'Recebimento direto ainda está em homologação.' src/routes/courier.tsx 'Settlement manual permanece explícito'
require_contains 'Saque manual está desativado.' src/routes/courier.tsx 'Saque legado desativado'
require_contains 'Recebimento direto ainda está em homologação.' src/routes/courier.tsx 'Repasse direto permanece bloqueado até homologação'
require_contains 'Saque manual está desativado.' src/routes/courier.tsx 'Runtime do Entregador não expõe saque manual'

export APOIS_MOBILE_PRODUCT="courier"
export APOIS_MOBILE_BUILD="1"
export VITE_APOIS_PRODUCT_MODE="courier"
export VITE_APOIS_NATIVE_SCHEME="br.com.apois.parceiro"
export APP_ROUTE="/"
export APP_PACKAGE="br.com.apois.parceiro"
export APP_LABEL="APOIS Parceiro"
export VITE_GOOGLE_MAPS_BROWSER_KEY="$CORRIDAS_MAPS_KEY_VALUE"
export VITE_GOOGLE_MAPS_API_KEY="$CORRIDAS_MAPS_KEY_VALUE"
export VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY="$CORRIDAS_MAPS_KEY_VALUE"
export VITE_GOOGLE_MAPS_MAP_ID="${ENTREGAS_GOOGLE_MAPS_MAP_ID:-DEMO_MAP_ID}"
bun install --frozen-lockfile
bun run typecheck
bun run build

HOST=127.0.0.1 PORT=4173 TSS_SHELL=true node .output/server/index.mjs >/tmp/apois-parceiro-entregador.log 2>&1 &
SERVER_PID=$!
cleanup_server() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --location "http://127.0.0.1:4173${APP_ROUTE}" -o .output/public/index.html; then break; fi
  if [ "$attempt" -eq 30 ]; then cat /tmp/apois-parceiro-entregador.log; exit 1; fi
  sleep 1
done
cleanup_server
trap - EXIT
test -s .output/public/index.html
node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const path = '.output/public/index.html';
let html = readFileSync(path, 'utf8')
  .replace(/(src|href)="\/(?!\/)/g, '$1="./')
  .replace(/(src|href)='\/(?!\/)/g, "$1='./")
  .replace(/(["'])\/(assets\/)/g, '$1./$2');
if (html.includes('"/assets/') || html.includes("'/assets/")) throw new Error('Entregador: referências absolutas /assets permaneceram');
writeFileSync(path, html, 'utf8');
NODE

cd "$ROOT"
node superapp/partner-shell/build.mjs
test -s superapp/partner-shell/dist/index.html
test -s superapp/partner-shell/dist/modules/motorista/index.html
test -s superapp/partner-shell/dist/modules/entregador/index.html
grep -Fq 'apois-parceiro:pending-push' superapp/partner-shell/dist/index.html

echo '[OK] APOIS Parceiro release build concluído sem gateway eletrônico ativo.'
