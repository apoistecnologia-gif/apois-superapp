#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
node "$ROOT/scripts/test-partner-input-contrast-v1.mjs"
node "$ROOT/scripts/test-driver-approval-guard-review-v1.mjs"
MOTORISTA="$ROOT/.work/partner-motorista"
ENTREGADOR="$ROOT/.work/partner-entregador"

rm -rf "$MOTORISTA" "$ENTREGADOR"
mkdir -p "$MOTORISTA" "$ENTREGADOR"
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-corridas-motorista-admin" -cf - . | tar -C "$MOTORISTA" -xf -
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-entregas" -cf - . | tar -C "$ENTREGADOR" -xf -
node "$ROOT/scripts/normalize-partner-workspaces.mjs" "$MOTORISTA" "$ENTREGADOR"
# Security: upgrade CVE-2026-102989 within .work copies only.
node "$ROOT/scripts/harden-partner-tanstack-cve-2026-102989.mjs"
node "$ROOT/scripts/fix-partner-tanstack-api-route-types-v1.mjs"
# Isolated six-check status diagnostics; no Android artifact or backend mutation.

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
node "$ROOT/scripts/harden-partner-motorista-rating-handoff.mjs"
node "$ROOT/scripts/harden-motorista-voice-dedup.mjs"
node "$ROOT/scripts/harden-motorista-map-branding.mjs"
node "$ROOT/scripts/harden-partner-motorista-payment-policy.mjs"
node "$ROOT/scripts/harden-partner-motorista-push.mjs"
node "$ROOT/scripts/harden-partner-motorista-push-runtime.mjs"
node "$ROOT/scripts/harden-partner-motorista-active-resume.mjs"
node "$ROOT/scripts/harden-partner-motorista-offer-fallback.mjs"
node "$ROOT/scripts/harden-partner-motorista-native-gps.mjs"
node "$ROOT/scripts/harden-partner-motorista-native-watch.mjs"
node "$ROOT/scripts/harden-partner-motorista-mobile-base.mjs"
node "$ROOT/scripts/harden-partner-red-visual.mjs"
node "$ROOT/scripts/harden-partner-auth-visual-v17.mjs"
node "$ROOT/scripts/harden-partner-motorista-visual-v18.mjs"
node "$ROOT/scripts/harden-partner-motorista-login-focus-v19.mjs"
# Password recovery callback: no reroute to map; readable email input; return to login on reset.
node "$ROOT/scripts/fix-partner-motorista-recovery-v1.mjs"
node "$ROOT/scripts/fix-partner-motorista-recovery-otp-v5.mjs"
node "$ROOT/scripts/fix-partner-motorista-recovery-relay-v2.mjs"
node "$ROOT/scripts/harden-partner-motorista-profile-contrast-v2.mjs"
node "$ROOT/scripts/fix-motorista-internal-contrast-v1.mjs"
node "$ROOT/scripts/fix-motorista-history-own-profile-v2.mjs"
node "$ROOT/scripts/harden-partner-google-callback-recovery.mjs"
node "$ROOT/scripts/harden-partner-motorista-google-pkce-v20.mjs"
node "$ROOT/scripts/harden-partner-ride-homologation-v2.mjs"
node "$ROOT/scripts/harden-partner-driver-profile-logout-v3.mjs"
node "$ROOT/scripts/harden-partner-motorista-pin-ride-v4.mjs"
node "$ROOT/scripts/harden-partner-motorista-google-roadmap-v5.mjs"
# Restore the same official APOIS cartographic palette seen in the customer app.
# Keep GPS, road navigation and automatic camera logic intact.
node "$ROOT/scripts/fix-partner-motorista-client-map-style-v1.mjs"
# APOIS Driver demand map: only aggregate live zones, never show individual passengers.
node "$ROOT/scripts/harden-partner-motorista-demand-map-v1.mjs"
node "$ROOT/scripts/verify-partner-driver-demand-zones-v1.mjs"
# Admin Corridas headings are already transformed by prior branding; do not run an additional fragile cosmetic patch.
node "$ROOT/scripts/harden-partner-motorista-arrival-voice-v5.mjs"
node "$ROOT/scripts/harden-partner-driver-trip-ux-v6.mjs"
node "$ROOT/scripts/harden-partner-driver-passenger-name-v6.mjs"
node "$ROOT/scripts/harden-partner-driver-registration-exit-v3.mjs"
# QA: private vehicle inspection (front/right/left/dashboard/front and rear seats).
node "$ROOT/scripts/fix-partner-driver-vehicle-photo-form-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-manufacture-year-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-vehicle-photo-upload-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-photo-capture-v2.mjs"
node "$ROOT/scripts/fix-partner-driver-native-photo-v3.mjs"
node "$ROOT/scripts/fix-partner-driver-signup-form-v4.mjs"
node "$ROOT/scripts/fix-partner-driver-auth-resume-v5.mjs"
node "$ROOT/scripts/fix-partner-driver-registration-preflight-v6.mjs"
node "$ROOT/scripts/fix-partner-driver-existing-passenger-v7.mjs"
node "$ROOT/scripts/fix-partner-driver-password-success-v2.mjs"
node "$ROOT/scripts/fix-partner-driver-auth-notice-v8.mjs"
if ! grep -Fq 'data-apois-driver-recovery-email-v1' "$MOTORISTA/src/routes/motorista.recuperar-senha.tsx"; then echo '[FAIL] Motorista recovery input contrast missing'; exit 1; fi
if ! grep -Fq 'recovery callback may be pending' "$MOTORISTA/src/routes/__root.tsx"; then echo '[FAIL] Motorista recovery callback navigation guard missing'; exit 1; fi
node "$ROOT/scripts/fix-partner-admin-vehicle-inspection-v1.mjs"
node "$ROOT/scripts/fix-partner-admin-pendencies-preview-v1.mjs"
node "$ROOT/scripts/fix-partner-support-case-workroom-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-correction-center-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-corrections-red-v2.mjs"
node "$ROOT/scripts/verify-apois-vehicle-incidents-v1.mjs" partner
node "$ROOT/scripts/verify-apois-13-photo-driver-pendencies-v1.mjs"
node "$ROOT/scripts/harden-partner-operational-status-v1.mjs" motorista
node "$ROOT/scripts/harden-partner-available-calls-v1.mjs" motorista
node "$ROOT/scripts/fix-motorista-map-menu-status-v1.mjs"
node "$ROOT/scripts/fix-motorista-global-sidebar-v2.mjs"
node "$ROOT/scripts/verify-partner-available-calls-v1.mjs" motorista
node "$ROOT/scripts/fix-partner-motorista-ride-comfort-v1.mjs"
node "$ROOT/scripts/fix-partner-input-contrast-v1.mjs" motorista
node "$ROOT/scripts/verify-partner-motorista-ride-comfort-v1.mjs"
# APOIS_DRIVER_LIFECYCLE_HOMOLOG_V2 gate
if ! grep -q 'completed-confirmed' "$MOTORISTA/src/routes/motorista.app.tsx"; then echo '[FAIL] voz final de corrida sem confirmação'; exit 1; fi
if ! grep -q 'bg-white text-\[#111827\]' "$MOTORISTA/src/routes/motorista.app.tsx"; then echo '[FAIL] card de oferta sem contraste seguro'; exit 1; fi

cd "$MOTORISTA"
require_contains 'PARTNER_PENDING_PUSH_KEY' src/lib/nativeBridge.ts 'Motorista encaminha push cruzado ao shell'
require_contains 'window.location.hash = "#/motorista/app"' src/lib/nativeBridge.ts 'Push do Motorista usa rota hash interna'
require_contains 'APOIS_DRIVER_OFFER_POLL_V1' src/routes/motorista.app.tsx 'Motorista reconsulta ofertas sem depender do Firebase'
require_contains 'APOIS_DRIVER_REGISTRATION_EXIT_V3' src/routes/motorista.cadastro.tsx 'Motorista permite sair do cadastro e retornar ao login'
require_contains 'Sair para o login' src/routes/motorista.cadastro.tsx 'Sucesso do cadastro não prende a sessão'
require_contains 'Geolocation.watchPosition(' src/routes/motorista.app.tsx 'Motorista acompanha GPS nativo'
require_contains 'stopDriverWatch();' src/routes/motorista.app.tsx 'Motorista encerra watcher GPS'
require_contains 'driver-finish-redispatch' src/lib/driverRideLifecycle.mobile.ts 'Finalização usa lifecycle canônico'
require_contains 'settlement?.driver_earning ?? settlement?.passenger_charge' 'src/routes/motorista.corridas.$id.tsx' 'Histórico usa ganho autorizado'
require_contains 'Pagamento eletrônico temporariamente indisponível' src/routes/motorista.assinatura.tsx 'Mensalidade informa indisponibilidade sem CTA morto'
require_contains 'Corrida aceita. Siga até o embarque' src/routes/motorista.app.tsx 'Jornada da corrida não depende de gateway'
require_contains 'calc(max(44px, env(safe-area-inset-bottom)) + 88px)' src/routes/motorista.app.tsx 'Motorista reserva espaço para rodapé e barra Android'
require_contains 'max(52px, env(safe-area-inset-bottom))' src/routes/motorista.app.tsx 'Motorista protege painéis ativos contra barra Android'
require_contains 'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]' src/routes/motorista.app.tsx 'Motorista mantém modais de cancelamento/avaliação dentro da viewport'

CORRIDAS_URL_VALUE="${CORRIDAS_VITE_SUPABASE_URL:-}"
CORRIDAS_KEY_VALUE="${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}"
CORRIDAS_MAPS_KEY_VALUE="${CORRIDAS_WEB_MAPS_API_KEY:-}"
if [ -z "$CORRIDAS_URL_VALUE" ] || [ -z "$CORRIDAS_KEY_VALUE" ] || [ -z "$CORRIDAS_MAPS_KEY_VALUE" ]; then
  echo '[FAIL] Motorista: env Corridas URL/key/Maps é obrigatório para build release.'
  exit 1
fi
case "$CORRIDAS_URL_VALUE" in
  *tbbzkrfupmqdywnzgnms.supabase.co) ;;
  *) echo '[FAIL] Motorista: Supabase não é o projeto Corridas canônico atual (tbbzkrfupmqdywnzgnms).'; exit 1 ;;
esac
{
  printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_URL_VALUE"
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_KEY_VALUE"
  printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
  printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
} > .env.mobile.local

# O snapshot protegido do Motorista ainda documenta o projeto histórico vqtuc...
# e não deve definir o runtime atual. O release Parceiro usa a mesma URL/key
# canônica de Corridas já validada no ambiente do Superapp Cliente.
case "$CORRIDAS_KEY_VALUE" in
  sb_publishable_*|eyJ*) ;;
  *) echo '[FAIL] Motorista: publishable key de Corridas não tem formato reconhecido.'; exit 1 ;;
esac
unset VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_PUBLISHABLE_KEY
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
cd "$ROOT"
node "$ROOT/scripts/reconcile-partner-motorista-lockfile.mjs"
cd "$MOTORISTA"
bun install --frozen-lockfile
node "$ROOT/scripts/fix-partner-tanstack-error-boundary-v1.mjs"
bun run typecheck
npm run build:motorista
cd "$ROOT"
node "$ROOT/scripts/audit-motorista-release-surface.mjs"
cd "$MOTORISTA"

require_contains 'tbbzkrfupmqdywnzgnms.supabase.co' dist/client 'Bundle Motorista usa Supabase Corridas canônico atual'
forbid_bundle 'sbvhdgyuuperszlsllji.supabase.co' dist/client 'Bundle Motorista isolado de Entregas'
require_contains 'Continuar com Google' dist/client 'Google login do Motorista presente'
require_contains 'Esqueci minha senha' dist/client 'Recovery do Motorista presente'
require_contains 'Pagamento eletrônico temporariamente indisponível' dist/client 'Mensalidade sem gateway presente'
require_contains 'Recebimento direto' dist/client 'Política de recebimento direto presente'
require_contains 'Nova corrida. Embarque em' dist/client 'Voz de oferta presente'
require_contains 'Corrida aceita. Siga até o embarque' dist/client 'Voz pós-aceite sem gateway presente'
require_contains 'Chegada informada. Aguarde o passageiro e solicite o PIN' dist/client 'Chegada/PIN presente'
require_contains 'Corrida iniciada. Siga a rota até' dist/client 'Início da corrida presente'
require_contains 'toque em finalizar corrida' dist/client 'Finalização orientada presente'
forbid_bundle 'Mercado Pago' dist/client 'Motorista sem Mercado Pago ativo'
forbid_bundle 'mercadopago-' dist/client 'Motorista sem endpoint Mercado Pago ativo'
forbid_bundle 'asaas-create-driver' dist/client 'Motorista sem provisionamento Asaas'
forbid_bundle 'Aguardando pagamento do passageiro' dist/client 'Motorista sem estado Pix legado'
forbid_bundle 'Solicitar saque' dist/client 'Motorista sem saque custodial legado'

# ---------------- Entregador ----------------
cd "$ROOT"
unset APOIS_MOTORISTA_WORKSPACE
export APOIS_ENTREGAS_WORKSPACE=".work/partner-entregador"
export APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.parceiro"
export APOIS_ENTREGAS_AUTH_HOME="/courier"
node "$ROOT/scripts/harden-entregas-auth-entry.mjs"
node "$ROOT/scripts/harden-partner-entregador-router.mjs"
node "$ROOT/scripts/harden-partner-entregador-hash-boundary.mjs"
node "$ROOT/scripts/harden-partner-entregador-push.mjs"
# Umbrella: aplica jornada, concorrência, GPS/background, sessão, financeiro manual, privacidade e UI.
node "$ROOT/scripts/harden-partner-entregador-map.mjs"
node "$ROOT/scripts/harden-partner-red-visual.mjs"
node "$ROOT/scripts/harden-partner-auth-visual-v17.mjs"
node "$ROOT/scripts/harden-partner-courier-auth-registration-v2.mjs"
node "$ROOT/scripts/harden-partner-courier-auth-back-v2.mjs"
node "$ROOT/scripts/harden-partner-courier-compact-home-v1.mjs"
node "$ROOT/scripts/harden-partner-courier-map-native-fallback-v3.mjs"
node "$ROOT/scripts/harden-partner-courier-driver-inspired-home-v1.mjs"
node "$ROOT/scripts/harden-partner-courier-push-diagnostics-v1.mjs"
node "$ROOT/scripts/harden-partner-courier-inner-panels-v1.mjs"
node "$ROOT/scripts/harden-partner-courier-offer-ux-v2.mjs"
node "$ROOT/scripts/harden-partner-courier-waiting-compact-v2.mjs"
node "$ROOT/scripts/harden-partner-courier-home-viewport-v3.mjs"
node "$ROOT/scripts/harden-partner-courier-map-client-style-v4.mjs"
node "$ROOT/scripts/harden-partner-courier-online-speed-v4.mjs"
node "$ROOT/scripts/harden-apois-entregas-email-auth-v1.mjs"
node "$ROOT/scripts/harden-partner-courier-registration-exit-v3.mjs"
# Scoped visual fixes for courier screenshots; do not change GPS, delivery transitions or payments.
node "$ROOT/scripts/fix-partner-courier-offer-contrast-v1.mjs"
# QA: no extra confirmation steps; preserve courier PIN and server transitions.
node "$ROOT/scripts/fix-partner-courier-simple-journey-v1.mjs"
# Reset previous online availability only on a new login/app entry, not on refresh.
node "$ROOT/scripts/fix-partner-courier-manual-online-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-map-journey-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-completion-light-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-idle-status-v1.mjs"
# Profilo/historico: telas claras e campos de contato, sem alterar aprovacoes.
node "$ROOT/scripts/fix-partner-courier-profile-history-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-avatar-diagnostics-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-env-type-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-home-regression-v1.mjs"
node "$ROOT/scripts/harden-partner-operational-status-v1.mjs" entregador
# Visual scanning indicator on online idle waiting screen; no effect on dispatch.
node "$ROOT/scripts/fix-partner-courier-search-scan-v1.mjs"
node "$ROOT/scripts/fix-partner-input-contrast-v1.mjs" entregador
node "$ROOT/scripts/harden-partner-available-calls-v1.mjs" entregador
node "$ROOT/scripts/verify-partner-available-calls-v1.mjs" entregador
require_contains 'APOIS_COURIER_PROFILE_EDIT_V1' "$ENTREGADOR/src/components/CourierPanels.tsx" 'Perfil e contatos do entregador editáveis'
require_contains 'data-apois-courier-history-light-v1' "$ENTREGADOR/src/components/CourierPanels.tsx" 'Histórico de entregas em contraste claro'
require_contains 'APOIS_COURIER_SIMPLE_FLOW_V1' "$ENTREGADOR/src/components/CourierPremiumViews.tsx" 'Entregador com coleta e PIN como únicas ações da entrega'
require_contains 'APOIS_COURIER_AUTOMATIC_STAGES_V1' "$ENTREGADOR/src/routes/courier.tsx" 'Transições autenticadas preservadas sem botões redundantes'
require_contains 'APOIS_COURIER_MANUAL_ONLINE_V1' "$ENTREGADOR/src/routes/courier.tsx" 'Entregador fica offline após login sem entrega ativa'
require_contains 'APOIS_COURIER_MAPS_URL_NO_API_KEY_V1' "$ENTREGADOR/src/components/CourierRouteMap.tsx" 'Navegação Google Maps externa disponível sem chave API da APOIS'
require_contains 'APOIS_COURIER_COMPLETION_LIGHT_V1' "$ENTREGADOR/src/system-theme.css" 'Confirmação final em identidade branca/vermelha'


cd "$ENTREGADOR"
require_contains 'register_courier_push_device_v2' src/lib/courier-push.ts 'Push do Entregador registrado'
require_contains 'APOIS_COURIER_REGISTRATION_EXIT_V3' src/routes/courier.tsx 'Entregador sai do cadastro com logout local'
require_contains 'data-apois-courier-register-hero-v3' src/components/CourierPremiumViews.tsx 'Hero do cadastro com contraste alto'
require_contains 'APOIS_COURIER_REGISTRATION_CONTRAST_V3' src/system-theme.css 'Inputs de cadastro legíveis'
require_contains 'const COURIER_ACTION_TIMEOUT_MS = 20_000;' src/routes/courier.tsx 'Ações do Entregador têm timeout'
require_contains 'const transitionJobId = activeJob.id;' src/routes/courier.tsx 'Transição captura delivery correta'
require_contains 'setCompletedJob({ ...deliveredJob, status: "delivered" });' src/routes/courier.tsx 'Conclusão operacional separada do financeiro'
require_contains 'Recebimento direto ainda está em homologação.' src/routes/courier.tsx 'Settlement manual permanece explícito'
require_contains 'Saque manual está desativado.' src/routes/courier.tsx 'Saque legado desativado'
require_contains 'courier_confirm_courier_settlement' src/routes/courier.tsx 'Confirmação manual de recebimento existente'
require_contains 'data-[active-job=true]:pb-[max(52px,env(safe-area-inset-bottom))]' src/routes/courier.tsx 'Entregador protege entrega ativa da barra Android'
require_contains 'pb-[max(8px,env(safe-area-inset-bottom))]' src/components/CourierPanels.tsx 'Entregador protege rodapé sem espaço excessivo'
require_contains 'pb-[max(52px,env(safe-area-inset-bottom))]' src/components/CourierCompletionSupport.tsx 'Entregador mantém suporte acima da barra Android'
require_contains 'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]' src/components/CourierCompletionSupport.tsx 'Entregador mantém suporte utilizável com teclado'

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
export VITE_SUPABASE_URL="https://ptgkwyyolrdgnqketkjj.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_DcfjTMboo1HX0O3w8Ptijg_quQbvVBY"
# Reconcile patched TanStack lockfile only in discarded Entregador workspace.
bun install --lockfile-only
bun install --frozen-lockfile
bun test src/lib/courier-dispatch-readiness.test.ts src/lib/courier-operation-readiness.test.ts
node "$ROOT/scripts/fix-partner-entregas-tanstack-boundary-v1.mjs"
bun run typecheck
bun run build
require_contains 'ptgkwyyolrdgnqketkjj.supabase.co' .output/public 'Bundle Entregador usa Supabase Entregas canônico atual'
forbid_bundle 'sbvhdgyuuperszlsllji.supabase.co' .output/public 'Bundle Entregador remove URL Supabase inválida antiga'

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
