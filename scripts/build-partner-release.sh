#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
node "$ROOT/scripts/test-partner-input-contrast-v1.mjs"
node "$ROOT/scripts/test-driver-approval-guard-review-v1.mjs"
node "$ROOT/scripts/test-entregas-privileged-rpc-review-v1.mjs"
node "$ROOT/scripts/test-corridas-cancellation-fee-privileges-review-v1.mjs"
node "$ROOT/scripts/test-corridas-internal-rpc-privileges-review-v1.mjs"
node "$ROOT/scripts/test-corridas-asaas-vault-rpc-review-v1.mjs"
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
node "$ROOT/scripts/harden-motorista-flags-offline-v1.mjs"
node --test "$ROOT/scripts/qa/test-motorista-flags-offline-v1.test.mjs"
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
# Relatorio 06 / INV-052: after receipt visual hardener; read-only synthetic unit gate.
node "$ROOT/scripts/fix-report06-motorista-receipt-v1.mjs"
node --test "$ROOT/scripts/qa/test-report06-receipt-v1.test.mjs"
# Relatorio 05: patch after native GPS utilities (imported by payment-policy).
node "$ROOT/scripts/fix-report05-motorista-security-v1.mjs"
node "$ROOT/scripts/verify-report05-motorista-security-v1.mjs"
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
# Relatório 11 / INV-063: synthetic OTP recipient/cooldown verification before release; no emails.
node --test "$ROOT/scripts/qa/test-report11-recovery-otp-v1.test.mjs"
node "$ROOT/scripts/fix-partner-motorista-recovery-relay-v2.mjs"
node "$ROOT/scripts/harden-partner-motorista-profile-contrast-v2.mjs"
node "$ROOT/scripts/fix-motorista-internal-contrast-v1.mjs"
node "$ROOT/scripts/fix-motorista-history-own-profile-v2.mjs"
# Historical error/retry recovery must precede cursor and period-summary transforms.
# Required by INV-053; edits only the disposable Motorista workspace.
node "$ROOT/scripts/harden-motorista-history-recovery.mjs"
node "$ROOT/scripts/fix-motorista-history-cursor-v1.mjs"
# Relatorio 06 / INV-053: apply to the existing cursor, not to the pinned source.
node "$ROOT/scripts/fix-report06-motorista-history-period-v1.mjs"
node --test "$ROOT/scripts/qa/test-motorista-history-cursor-v1.test.mjs"
node --test "$ROOT/scripts/qa/test-report06-history-period-v1.test.mjs"
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
# Physical Android feedback: follow route heading on vector map and avoid generic P avatar.
# Source pin and backend permissions remain unchanged.
node "$ROOT/scripts/fix-partner-driver-forward-camera-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-passenger-avatar-v1.mjs"
# Android QA 175 regression: avoid WebGL vector on idle and keep errors inside the map.
node "$ROOT/scripts/fix-partner-motorista-map-startup-stability-v1.mjs"
# Physical QA179: stop map crashes when a ride starts and retry cancelled routes.
node "$ROOT/scripts/fix-partner-motorista-active-ride-map-v2.mjs"
node --test "$ROOT/scripts/qa/test-partner-motorista-active-map-v2.test.mjs"
node --test "$ROOT/scripts/qa/test-partner-motorista-map-startup-stability-v1.test.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-forward-camera-v1.test.mjs"
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
node "$ROOT/scripts/fix-partner-admin-finance-refresh-v2.mjs"
node "$ROOT/scripts/verify-apois-report02-integrity-v1.mjs" finance
node "$ROOT/scripts/fix-partner-driver-correction-center-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-corrections-red-v2.mjs"
node "$ROOT/scripts/fix-report04-driver-center-v1.mjs"
node "$ROOT/scripts/fix-report04-driver-document-reconciliation-v1.mjs"
node "$ROOT/scripts/verify-report04-documents-v1.mjs"
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
# Surface Supabase presence rejection instead of leaving a phantom ONLINE UI.
node "$ROOT/scripts/harden-partner-driver-presence-ack-v1.mjs"
# Preserve original 6-check diagnostic and available-call RPC logic, while moving their entry points into the SideMenu.
node "$ROOT/scripts/fix-partner-motorista-sidebar-tools-profile-v1.mjs"
node "$ROOT/scripts/fix-partner-motorista-menu-overlay-v4.mjs"
node "$ROOT/scripts/fix-partner-motorista-settings-contrast-v4.mjs"
node "$ROOT/scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs"
node "$ROOT/scripts/verify-partner-motorista-sidebar-tools-profile-v1.mjs"
node "$ROOT/scripts/verify-partner-motorista-settings-ui-v4.mjs"
# Readable ride offer, Android navigation status and completed rating. No lifecycle/provider rewrites.
node "$ROOT/scripts/fix-partner-motorista-ride-visual-v7.mjs"
node "$ROOT/scripts/verify-partner-motorista-ride-visual-v7.mjs"
# Route Edge Function rejected real authenticated calls with HTTP 401 in physical QA; bounded token refresh only.
node "$ROOT/scripts/fix-partner-motorista-route-auth-v1.mjs"
node "$ROOT/scripts/verify-partner-motorista-route-auth-v1.mjs"
# Final scoped Motorista UI cleanup after historical red-theme hardeners; no RPC changes.
node "$ROOT/scripts/fix-partner-motorista-drawer-profile-v5.mjs"
node "$ROOT/scripts/verify-partner-motorista-drawer-profile-v5.mjs"
# Relatorio 03: aplicar correcoes apenas na copia isolada do Motorista/Admin.
node "$ROOT/scripts/fix-report03-motorista-notifications-v1.mjs"
node "$ROOT/scripts/fix-report03-native-push-permission-v1.mjs"
# Relatorio 07: code-only gates after all Motorista lifecycle hardeners.
# Never deploy Edge Functions / run QA_NOT_APPLIED SQL as part of this builder.
node "$ROOT/scripts/fix-report07-driver-reason-code-v1.mjs"
node --test "$ROOT/scripts/qa/test-report07-driver-reason-code-v1.test.mjs"
node --test "$ROOT/scripts/qa/test-report07-redispatch-v1.test.mjs"
# CV-013..015: last scoped rating presentation patch, after V7 and other Motorista hardeners.
# No source-pin edit, backend action, rating submission or app publication here.
node "$ROOT/scripts/fix-partner-motorista-rating-accessibility-cv03-v1.mjs"
node --test "$ROOT/scripts/qa/test-motorista-rating-accessibility-cv03-v1.test.mjs"
require_contains 'APOIS_CV03_DRIVER_RATING_V1' "$MOTORISTA/src/routes/motorista.app.tsx" 'Motorista rating accessibility marker'
require_contains 'aria-pressed={stars === n}' "$MOTORISTA/src/routes/motorista.app.tsx" 'Rating announces selected star'
require_contains 'textarea#apois-driver-rating-comment::placeholder' "$MOTORISTA/src/styles.css" 'Rating placeholder only contrast'
# RV-06 CV-021/022: last Motorista attachment presentation overlay after native picker,
# correction-center security transforms, and red visual hardeners. No operational code change.
node "$ROOT/scripts/fix-partner-driver-document-guidance-visual06-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-document-guidance-visual06-v1.test.mjs"
require_contains 'APOIS_CV06_DRIVER_DOCUMENT_GUIDANCE_V1' "$MOTORISTA/src/components/DriverDocumentField.tsx" 'Motorista document limits help'
require_contains 'APOIS_CV06_DRIVER_NATIVE_REJECTION_V1' "$MOTORISTA/src/components/DriverDocumentField.tsx" 'Motorista native picker error guidance'
require_contains 'data-apois-cv06-correction-hint' "$MOTORISTA/src/components/ApoisDriverCorrections.tsx" 'Motorista correction photo limits'
# RV-08 CV-025/026: after Support Workroom generation, staff triage, privacy
# and all Motorista visual hardeners. Purely communicative overlay on .work.
node "$ROOT/scripts/fix-partner-support-workroom-visual08-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-support-workroom-visual08-v1.test.mjs"
require_contains 'APOIS_CV08_CASE_WORKROOM_V1' "$MOTORISTA/src/components/ApoisCaseWorkroom.tsx" 'CV08 status/empty/error communication'
require_contains 'caseStatusLabel(t.status)' "$MOTORISTA/src/components/ApoisCaseWorkroom.tsx" 'CV08 ticket status labels'
require_contains 'ticketListLoaded&&!ticketListFailed' "$MOTORISTA/src/components/ApoisCaseWorkroom.tsx" 'CV08 error vs empty guard'
# RV-09 / CV-027: focus management in existing V4 deletion modal only.
node "$ROOT/scripts/fix-apois-account-deletion-visual09-v1.mjs" motorista
node --test "$ROOT/scripts/qa/test-apois-account-deletion-visual09-v1.test.mjs"
require_contains 'APOIS_CV09_DRIVER_DELETION_DIALOG_V1' "$MOTORISTA/src/routes/motorista.configuracoes.tsx" 'CV09 Motorista dialog focus'
require_contains 'APOIS_CV09_DELETION_FOCUS_V1' "$MOTORISTA/src/lib/useApoisDeletionDialogFocus.ts" 'CV09 shared focus guard'
# RV-14: only the generated calls component. Server claim/presence and RPCs stay intact.
node "$ROOT/scripts/fix-partner-available-calls-visual14-v1.mjs" motorista
node --test "$ROOT/scripts/qa/test-partner-available-calls-visual14-v1.test.mjs"
require_contains 'APOIS_CV14_AVAILABLE_CALLS_STATE_V1' "$MOTORISTA/src/components/ApoisAvailableCalls.tsx" 'RV14 Motorista guarded call feedback/expiry'
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
cd "$ROOT"
node "$ROOT/scripts/fix-partner-driver-new-monthly-price-v1.mjs"
# RV-07 / CV-023: presentation-only status mapping after contract price resolver.
node "$ROOT/scripts/fix-apois-financial-status-visual07-v1.mjs" motorista
node --test "$ROOT/scripts/qa/test-apois-financial-status-visual07-v1.test.mjs"
require_contains 'APOIS_CV07_DRIVER_MEMBERSHIP_STATUS_V1' "$MOTORISTA/src/routes/motorista.assinatura.tsx" 'CV07 Motorista status displayed safely'
node "$ROOT/scripts/qa/test-partner-driver-new-monthly-price-v1.mjs"
# QA186 presentation-only Android Motorista fixes after existing hardeners.
node "$ROOT/scripts/fix-partner-driver-qa186-navigation-layout-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa186-navigation-layout-v1.test.mjs"
# QA190: short incoming offer and guaranteed return to forward map camera after route preview.
node "$ROOT/scripts/fix-partner-driver-qa190-physical-video-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa190-physical-video-v1.test.mjs"
# QA192: immutable vector/raster choice, Google runtime fallback and audited passenger RPC contract.
node "$ROOT/scripts/fix-partner-driver-qa192-vector-passenger-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa192-vector-passenger-v1.test.mjs"
# QA194: restore Passenger's APOIS base palette without changing GPS/ride lifecycle.
node "$ROOT/scripts/fix-partner-driver-qa194-passenger-map-style-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa194-passenger-map-style-v1.test.mjs"
# QA195: Android physical video UX, Motorista only.
node "$ROOT/scripts/fix-partner-driver-qa195-physical-ux-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa195-physical-ux-v1.test.mjs"
# QA198: preserve map, passenger and route presentation after physical QA197.
node "$ROOT/scripts/fix-partner-driver-qa198-physical-stability-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa198-physical-stability-v1.test.mjs"
# QA201: GPS request epoch, route refresh cap, honest fallback, real trip score.
node "$ROOT/scripts/fix-partner-driver-qa201-route-reliability-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa201-route-reliability-v1.test.mjs"
# QA202: cloud-styled vector gated; defaults to same Passenger raster until approved.
node "$ROOT/scripts/fix-partner-driver-qa202-cloud-vector-readiness-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa202-cloud-vector-readiness-v1.test.mjs"
# QA209 physical video: stable vector road camera, realtime + confirmed finish cleanup, real PIN fields.
node "$ROOT/scripts/fix-partner-driver-qa209-camera-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-qa209-finished-route-v1.mjs"
node "$ROOT/scripts/fix-partner-driver-qa209-pin-controls-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa209-physical-map-pin-v1.test.mjs"
# PDF 12/11: presentation-only physical Android notes, after all QA209 gates.
# Never build an APK here; this changes only the disposable Motorista web source.
node "$ROOT/scripts/fix-partner-driver-pdf-notes-20261112-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-pdf-notes-20261112-v1.test.mjs"
# Video 1001992704.mp4: preserve vector rotation and reset phase bearing;
# only presentation/camera in disposable Motorista. No APK or Maps key edits.
node "$ROOT/scripts/fix-partner-driver-video-map-rotation-20261112-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-video-map-rotation-20261112-v1.test.mjs"
# QA219: ignore delayed terminal updates from earlier rides; Motorista generated UI only.
node "$ROOT/scripts/fix-partner-driver-qa219-stale-ride-events-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa219-stale-ride-events-v1.test.mjs"
# QA219: no lost native GPS watcher after rapid OFFLINE/ONLINE while startup is pending.
node "$ROOT/scripts/fix-partner-driver-qa219-native-watch-restart-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa219-native-watch-restart-v1.test.mjs"
# QA219: GPS telemetry must not substitute missing heading/speed with zero.
node "$ROOT/scripts/fix-partner-driver-qa219-null-telemetry-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-driver-qa219-null-telemetry-v1.test.mjs"
# Recheck after later visual/hardener transforms before compiling.
(cd "$ROOT" && node "$ROOT/scripts/verify-report05-motorista-security-v1.mjs")
cd "$MOTORISTA"
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
# Motorista-only Map ID must not enter the Vite/Nitro environment of Entregador.
# Vite can embed all VITE_ variables in its import.meta.env runtime object.
unset VITE_APOIS_PARTNER_VECTOR_MAP_ID VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED
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
node "$ROOT/scripts/fix-partner-courier-membership-disclosure-v1.mjs"
node "$ROOT/scripts/qa/test-partner-courier-membership-disclosure-v1.mjs"
node "$ROOT/scripts/harden-partner-available-calls-v1.mjs" entregador
node "$ROOT/scripts/verify-partner-available-calls-v1.mjs" entregador
# Courier: keep same server-backed actions; move diagnostics under Perfil and complete available calls visual.
node "$ROOT/scripts/fix-partner-courier-operational-actions-v2.mjs"
node "$ROOT/scripts/verify-partner-courier-operational-actions-v2.mjs"
# CV-009..012: late, source-locked visual-only corrections on the FINAL courier UI.
node "$ROOT/scripts/fix-partner-courier-visual02-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-courier-visual02-v1.test.mjs"
require_contains 'APOIS_CV02_COURIER_ACTIVE_V1' "$ENTREGADOR/src/components/CourierPremiumViews.tsx" 'Entregador retirada verbalizada e alvos acessiveis'
require_contains 'data-apois-cv02-offer-dialog' "$ENTREGADOR/src/components/CourierOfferOverlay.tsx" 'Oferta semantica e altura limitada'
require_contains 'APOIS_COURIER_PROFILE_EDIT_V1' "$ENTREGADOR/src/components/CourierPanels.tsx" 'Perfil e contatos do entregador editáveis'
require_contains 'data-apois-courier-history-light-v1' "$ENTREGADOR/src/components/CourierPanels.tsx" 'Histórico de entregas em contraste claro'
require_contains 'APOIS_COURIER_SIMPLE_FLOW_V1' "$ENTREGADOR/src/components/CourierPremiumViews.tsx" 'Entregador com coleta e PIN como únicas ações da entrega'
require_contains 'APOIS_COURIER_AUTOMATIC_STAGES_V1' "$ENTREGADOR/src/routes/courier.tsx" 'Transições autenticadas preservadas sem botões redundantes'
require_contains 'APOIS_COURIER_MANUAL_ONLINE_V1' "$ENTREGADOR/src/routes/courier.tsx" 'Entregador fica offline após login sem entrega ativa'
# RV-14: same overlay on the Courier copy; do not touch source Entregas.
node "$ROOT/scripts/fix-partner-available-calls-visual14-v1.mjs" entregador
node --test "$ROOT/scripts/qa/test-partner-available-calls-visual14-v1.test.mjs"
# Google Cloud: courier-only vector map, same published 2D style as Motorista.
# Applied after all courier hardeners; affects map presentation only.
node "$ROOT/scripts/fix-partner-courier-exclusive-vector-style-20261112-v1.mjs"
node --test "$ROOT/scripts/qa/test-partner-courier-exclusive-vector-style-20261112-v1.test.mjs"
require_contains 'APOIS_CV14_AVAILABLE_CALLS_STATE_V1' "$ENTREGADOR/src/components/ApoisAvailableCalls.tsx" 'RV14 Entregador guarded call feedback/expiry'
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
export VITE_GOOGLE_MAPS_MAP_ID="1af3628136c58ef8d1029763" # Exclusivo APOIS Entregador, publicado no Google Cloud (12/11/2026)
[[ "$VITE_GOOGLE_MAPS_MAP_ID" =~ ^[0-9a-fA-F]{16,32}$ ]] || { echo "[FAIL] Map ID Entregador inválido"; exit 1; }
[[ "$VITE_GOOGLE_MAPS_MAP_ID" != "1af3628136c58ef8a23052b5" && "$VITE_GOOGLE_MAPS_MAP_ID" != "1af3628136c58ef870ba9d1a" ]] || { echo "[FAIL] Map ID compartilhado ou do Motorista não autorizado para Entregador"; exit 1; }
export VITE_SUPABASE_URL="https://ptgkwyyolrdgnqketkjj.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_DcfjTMboo1HX0O3w8Ptijg_quQbvVBY"
# Reconcile patched TanStack lockfile only in discarded Entregador workspace.
bun install --lockfile-only
bun install --frozen-lockfile
bun test src/lib/courier-dispatch-readiness.test.ts src/lib/courier-operation-readiness.test.ts
node "$ROOT/scripts/fix-partner-entregas-tanstack-boundary-v1.mjs"
node "$ROOT/scripts/fix-partner-courier-offer-focus-ts-v1.mjs"
bun run typecheck
bun run build
# Public Map ID is embedded in courier web bundle, never in Motorista bundle.
require_contains '1af3628136c58ef8d1029763' .output/public 'Entregador compila apenas seu Map ID Google Cloud exclusivo'
forbid_bundle '1af3628136c58ef870ba9d1a' .output/public 'Entregador não recebe o Map ID do Motorista'
forbid_bundle '1af3628136c58ef8a23052b5' .output/public 'Entregador não recebe o Map ID compartilhado com Cliente'
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
