#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
MOTORISTA="$ROOT/.work/partner-motorista"
ENTREGADOR="$ROOT/.work/partner-entregador"

rm -rf "$MOTORISTA" "$ENTREGADOR"
mkdir -p "$MOTORISTA" "$ENTREGADOR"
# Os submódulos fonte costumam ter node_modules instalado localmente para
# typecheck/lint/build isolados durante o desenvolvimento. Um `cp -R` simples
# copiaria essa árvore inteira (potencialmente dezenas de milhares de
# arquivos) para dentro de .work a cada execução. tar com --exclude copia
# sem essa cópia redundante.
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-corridas-motorista-admin" -cf - . \
  | tar -C "$MOTORISTA" -xf -
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-entregas" -cf - . \
  | tar -C "$ENTREGADOR" -xf -

# Um checkout local com core.autocrlf=true grava esses arquivos como CRLF na
# árvore de trabalho, embora o blob no Git permaneça LF. Os hardeners abaixo
# usam substituição textual exata (padrões com \n) e quebrariam sem indicar
# nenhuma mudança real de conteúdo. Normalizamos para LF logo após copiar.
node "$ROOT/scripts/normalize-partner-workspaces.mjs" "$MOTORISTA" "$ENTREGADOR"

echo '[OK] normalização Parceiro usa Node.js portátil (CRLF/CR para LF)'

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

require_contains() {
  local needle="$1"
  local target="$2"
  local label="$3"
  if ! grep -R -Fq "$needle" "$target"; then
    echo "[FAIL] validação Parceiro: $label"
    echo "       esperado: $needle"
    echo "       em: $target"
    exit 1
  fi
  echo "[OK] validação Parceiro: $label"
}

# ---------------- Motorista ----------------
export APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"
node "$ROOT/scripts/harden-motorista-auth.mjs"
node "$ROOT/scripts/harden-motorista-field-runtime.mjs"
node "$ROOT/scripts/harden-motorista-flags-offline-v1.mjs"
node "$ROOT/scripts/harden-partner-motorista-onboarding.mjs"
node "$ROOT/scripts/harden-motorista-field-mercadopago.mjs"
node "$ROOT/scripts/harden-partner-mercadopago-callback.mjs"
node "$ROOT/scripts/harden-motorista-mercadopago-disconnect.mjs"
node "$ROOT/scripts/harden-motorista-direct-mercadopago.mjs"
node "$ROOT/scripts/harden-motorista-payment-wait.mjs"
node "$ROOT/scripts/harden-motorista-ride-flow-ui.mjs"
node "$ROOT/scripts/harden-motorista-voice-navigation-flow.mjs"
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
node "$ROOT/scripts/harden-partner-motorista-native-gps.mjs"
node "$ROOT/scripts/harden-partner-motorista-native-watch.mjs"
node "$ROOT/scripts/harden-partner-motorista-mobile-base.mjs"
node "$ROOT/scripts/harden-motorista-embedded-hash-router.mjs"
node "$ROOT/scripts/harden-motorista-feature-flags-rejection.mjs"
node "$ROOT/scripts/harden-motorista-history-recovery.mjs"
node "$ROOT/scripts/fix-motorista-history-cursor-v1.mjs"
node --test "$ROOT/scripts/qa/test-motorista-history-cursor-v1.test.mjs"
node "$ROOT/scripts/harden-motorista-registration-insert-only.mjs"
node "$ROOT/scripts/harden-motorista-document-photo-types.mjs"

cd "$MOTORISTA"
require_contains 'history: createHashHistory()' src/mobile.tsx 'Motorista embutido segue as rotas hash do seletor Parceiro'
require_contains 'appTarget: "partner"' src/components/payments/MercadoPagoSellerCard.tsx 'OAuth Mercado Pago usa callback exclusivo do APOIS Parceiro'
require_contains 'Desconectar Mercado Pago' src/components/payments/MercadoPagoSellerCard.tsx 'desconexão segura do Mercado Pago presente'
require_contains 'PARTNER_PENDING_PUSH_KEY' src/lib/nativeBridge.ts 'Motorista encaminha Push de outro módulo ao shell'
require_contains 'window.location.hash = "#/motorista/app"' src/lib/nativeBridge.ts 'Push de corrida navega por Hash dentro do módulo Motorista'
require_contains 'import { Geolocation } from "@capacitor/geolocation";' src/routes/motorista.app.tsx 'Motorista usa GPS nativo no Android'
require_contains 'restauração do GPS nativo falhou' src/routes/motorista.app.tsx 'Motorista reidrata presença ONLINE após reabrir o app'
require_contains 'Geolocation.watchPosition(' src/routes/motorista.app.tsx 'Motorista acompanha GPS continuamente pela API nativa Android'
require_contains 'stopDriverWatch();' src/routes/motorista.app.tsx 'Motorista encerra watcher GPS ao ficar offline'
require_contains 'driver-finish-redispatch' src/lib/driverRideLifecycle.mobile.ts 'finalização chama redispatch canônico da próxima corrida'
require_contains 'const completedRide = await callComplete' src/routes/motorista.app.tsx 'finalização limpa corrida sem depender de eco Realtime'
require_contains 'setRouteSteps([]);' src/routes/motorista.app.tsx 'finalização encerra navegação da corrida anterior'
require_contains 'ratingRef.current = completedRide;' src/routes/motorista.app.tsx 'avaliação bloqueia race de ofertas durante abertura'
require_contains 'event: "rating.closed"' src/routes/motorista.app.tsx 'fechamento da avaliação força ressincronização da próxima corrida'
require_contains 'ratedRidesRef.current.add(ratedRideId);' src/routes/motorista.app.tsx 'avaliação enviada é marcada contra duplicidade'
require_contains 'window.addEventListener("apois:driver-push", onDriverPush);' src/routes/motorista.app.tsx 'push/resume força resync sem depender somente de Realtime'
require_contains 'settlement?.driver_earning ?? settlement?.passenger_charge' 'src/routes/motorista.corridas.$id.tsx' 'histórico usa ganho do motorista e não saldo APOIS'
require_contains 'A APOIS não retém comissão nem recebe o valor da corrida.' src/lib/rideReceipt.ts 'recibo deixa recebimento direto explícito'
require_contains 'Trocar perfil de parceiro' src/routes/motorista.cadastro.tsx 'sucesso do cadastro permite voltar ao seletor sem encerrar sessão'
require_contains 'window.location.replace("../../index.html")' src/routes/motorista.cadastro.tsx 'cadastro retorna ao seletor Parceiro na primeira etapa'
require_contains 'window.location.replace("../../index.html")' src/routes/motorista.status.tsx 'status possui fallback ao seletor Parceiro'
require_contains 'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_LOGOUT_GUARD' src/routes/motorista.configuracoes.tsx 'configurações bloqueiam logout enquanto Motorista está operacional'
require_contains 'APOIS_PARTNER_DRIVER_SETTINGS_OPERATIONAL_DELETE_GUARD' src/routes/motorista.configuracoes.tsx 'configurações bloqueiam exclusão enquanto Motorista está operacional'
require_contains 'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.' src/routes/motorista.perfil.tsx 'perfil não encerra sessão operacional por rota secundária'
require_contains 'APOIS_PARTNER_DRIVER_HEADER_OPERATIONAL_GUARD' src/components/MovviHeader.tsx 'cabeçalho não encerra sessão operacional por tela secundária'
CORRIDAS_URL_VALUE="${CORRIDAS_VITE_SUPABASE_URL:-}"
CORRIDAS_KEY_VALUE="${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}"
CORRIDAS_MAPS_KEY_VALUE="${CORRIDAS_WEB_MAPS_API_KEY:-}"
if [ -z "$CORRIDAS_URL_VALUE" ] || [ -z "$CORRIDAS_KEY_VALUE" ] || [ -z "$CORRIDAS_MAPS_KEY_VALUE" ]; then
  echo '[FAIL] Motorista: variáveis CORRIDAS_VITE_SUPABASE_URL, CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY e CORRIDAS_WEB_MAPS_API_KEY são obrigatórias.'
  exit 1
fi
node "$ROOT/scripts/verify-corridas-build-env.mjs"
{
  printf 'VITE_SUPABASE_URL=%s\n' "$CORRIDAS_URL_VALUE"
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$CORRIDAS_KEY_VALUE"
  printf 'VITE_GOOGLE_MAPS_API_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
  printf 'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$CORRIDAS_MAPS_KEY_VALUE"
} > .env.mobile.local

# A referência e a chave vêm EXCLUSIVAMENTE do ambiente de release atual.
# Nunca compare uma chave do projeto canônico com .env.mobile do snapshot legado.
unset VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_PUBLISHABLE_KEY
export VITE_APP_ROLE="motorista"
export VITE_ENABLE_NATIVE_PUSH="true"
cd "$ROOT"
node "$ROOT/scripts/reconcile-partner-motorista-lockfile.mjs"
cd "$MOTORISTA"
bun install --frozen-lockfile
npm run build:motorista

# Validação de isolamento: o bundle Motorista deve apontar para Corridas,
# nunca para o projeto Entregas, mesmo que o processo externo tenha VITE_*
# herdado de outro módulo.
require_contains 'tbbzkrfupmqdywnzgnms.supabase.co' dist/client 'bundle Motorista usa o Supabase Corridas canônico'
if grep -R -Fq 'vqtucstyduxrqjgyigfk.supabase.co' dist/client; then
  echo '[FAIL] bundle Motorista ainda usa Supabase histórico'
  exit 1
fi
if grep -R -Fq 'ptgkwyyolrdgnqketkjj.supabase.co' dist/client; then
  echo '[FAIL] bundle Motorista referencia o Supabase Entregas'
  exit 1
fi
if grep -R -Fq 'sbvhdgyuuperszlsllji.supabase.co' dist/client; then
  echo '[FAIL] bundle Motorista contaminado com o Supabase Entregas'
  exit 1
fi
echo '[OK] validação Motorista: Supabase Entregas ausente do bundle'

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
require_contains 'APOIS_DRIVER_LOCATION_V2' src/components/mapMarkers.tsx 'marcador de localizacao APOIS refinado presente'
require_contains 'themeOverride="light"' src/routes/motorista.app.tsx 'home Motorista utiliza mapa claro APOIS'
require_contains 'strokeColor: "#F6BE1C"' src/routes/motorista.app.tsx 'rota dourada APOIS presente'
require_contains 'tickNavigation' src/routes/motorista.app.tsx 'motorista recebe orientação por voz durante deslocamento'
require_contains 'readableFunctionInvokeError' src/lib/driverRideLifecycle.mobile.ts 'erro real da Edge Function é traduzido'
require_contains 'Não foi possível finalizar a corrida.' src/routes/motorista.app.tsx 'falha de finalização é visível ao motorista'
require_contains 'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.' dist/client 'bundle Motorista preserva guarda contra saída operacional por telas secundárias'

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
node "$ROOT/scripts/harden-entregas-support-legacy-route.mjs"
node "$ROOT/scripts/harden-entregas-merchant-image-mime.mjs"
node "$ROOT/scripts/harden-partner-entregador-router.mjs"
node "$ROOT/scripts/harden-partner-entregador-hash-boundary.mjs"
node "$ROOT/scripts/harden-partner-entregador-push.mjs"
node "$ROOT/scripts/harden-partner-entregador-map.mjs"

cd "$ENTREGADOR"
require_contains 'register_courier_push_device_v2' src/lib/courier-push.ts 'registro Push v2 do Entregador presente'
require_contains '_app_package: "br.com.apois.parceiro"' src/lib/courier-push.ts 'token Push vinculado ao package do Parceiro'
require_contains 'PARTNER_PENDING_PUSH_KEY' src/lib/courier-push.ts 'Entregador encaminha Push de corrida ao shell'
require_contains 'const APOIS_GOLD = "#F6BE1C"' src/components/CourierRouteMap.tsx 'mapa do Entregador usa rota dourada APOIS'
require_contains '"DEMO_MAP_ID"' src/components/CourierRouteMap.tsx 'mapa possui Map ID de fallback para não desaparecer'
require_contains 'const COURIER_ACTION_TIMEOUT_MS = 20_000;' src/routes/courier.tsx 'ações de entrega possuem limite para não girar indefinidamente'
require_contains 'const transitionJobId = activeJob.id;' src/routes/courier.tsx 'mudança de etapa reconcilia a entrega correta'
require_contains 'setCompletedJob({ ...deliveredJob, status: "delivered" });' src/routes/courier.tsx 'conclusão remove entrega ativa e abre resumo imediatamente'
require_contains 'Atualização temporariamente indisponível' src/routes/courier.tsx 'falha de refresh preserva estado e mostra recuperação'
if grep -Fq 'window.location.assign("/courier")' src/lib/courier-push.ts; then
  echo '[FAIL] Entregador ainda tenta abrir rota absoluta /courier dentro do bundle aninhado'
  exit 1
fi
if grep -Fq 'PushNotifications.unregister()' src/lib/courier-push.ts; then
  echo '[FAIL] logout do Entregador ainda desregistra o token FCM compartilhado do APOIS Parceiro'
  exit 1
fi
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
bun run build

HOST=127.0.0.1 PORT=4173 TSS_SHELL=true node .output/server/index.mjs >/tmp/apois-parceiro-entregador.log 2>&1 &
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
  .replace(/(src|href)='\/(?!\/)/g, "$1='./")
  // TanStack Start serializa preloads/scripts no manifesto TSR como strings
  // absolutas; normalize-as também para o módulo aninhado do Parceiro.
  .replace(/(["'])\/(assets\/)/g, '$1./$2');
if (html.includes('"/assets/') || html.includes("'/assets/")) {
  throw new Error('Entregador: manifesto TSR ainda contém referências absolutas a /assets');
}
writeFileSync(path, html, 'utf8');
NODE

cd "$ROOT"
node superapp/partner-shell/build.mjs
test -s superapp/partner-shell/dist/index.html
test -s superapp/partner-shell/dist/modules/motorista/index.html
test -s superapp/partner-shell/dist/modules/entregador/index.html
grep -R -Fq '#F6BE1C' superapp/partner-shell/dist/modules/entregador
grep -R -Fq 'DEMO_MAP_ID' superapp/partner-shell/dist/modules/entregador
grep -Fq 'apois-parceiro:pending-push' superapp/partner-shell/dist/index.html

echo '[OK] módulos do APOIS Parceiro compilados: Push cruzado isolado, GPS nativo, ações resilientes e mapa do Entregador operacional'
