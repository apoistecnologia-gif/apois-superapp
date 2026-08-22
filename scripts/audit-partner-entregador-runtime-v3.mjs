import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Entregador runtime v3: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
};
const requireAll = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};
const forbidAll = (path, markers, label) => {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
};

requireAll('scripts/harden-partner-entregador-online-bootstrap.mjs', [
  'rpc("bootstrap_courier_location"',
  'const { error: onlineError } = await rpc("set_courier_online"',
  'toggleBlock.includes(\'rpc("update_courier_location"\')',
], 'Entregador elimina deadlock GPS/offline antes de ficar online');

requireAll('supabase/migrations/20260822013000_allow_secure_courier_location_bootstrap_before_online.sql', [
  'create or replace function public.bootstrap_courier_location',
  "c.status = 'approved'",
  'c.is_active = true',
  'private.courier_max_location_accuracy_meters()',
  'revoke all on function public.bootstrap_courier_location',
  'grant execute on function public.bootstrap_courier_location',
], 'Bootstrap GPS é restrito, valida precisão e não fica exposto a anon/public');

requireAll('scripts/harden-partner-entregador-gps-resume.mjs', [
  'const clearNativeWatch = async () =>',
  'const restartNativeTracking = async () =>',
  'App.addListener("appStateChange"',
  'void restartNativeTracking().catch(receiveError);',
  'Uma falha temporária de GPS não deve apagar a última posição válida',
  'void appStateHandle?.remove();',
], 'GPS do Entregador é rearmado ao voltar do background sem desmontar rota por falha transitória');

requireAll('scripts/harden-partner-entregador-quiet-refresh.mjs', [
  'if (quiet) {',
  'setOperationsError',
  'setAppError',
], 'Refresh silencioso não substitui operação ativa por erro de tela cheia');

requireAll('scripts/harden-partner-entregador-push-runtime.mjs', [
  '"pushNotificationReceived"',
  'const delivery = isDeliveryPushPayload(data);',
  'const ride = isRidePushPayload(data);',
  'if (delivery && ride) return;',
  'sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY',
  'new CustomEvent("apois:courier-push-open"',
], 'Push do Entregador isola entrega/corrida, foreground e toque sem alternância indevida');
forbidAll('scripts/harden-partner-entregador-push-runtime.mjs', [
  'PushNotifications.unregister()',
], 'Entregador não invalida token FCM compartilhado');

requireAll('scripts/harden-partner-entregador-state-handoff.mjs', [
  'const activeJobIdentity = activeJob?.id ?? null;',
  'setPin("");',
  'setSupportOpen(false);',
  'setSupportDescription("");',
  'if (activeJobIdentity) setOffers([]);',
  'if (courier?.id) void loadCourierOperations(courier.id);',
], 'Troca/conclusão de entrega limpa PIN, suporte e ofertas antigas');

requireAll('scripts/harden-partner-entregador-action-timeouts.mjs', [
  'const acceptedOfferId = offerId;',
  'const rejectedOfferId = offerId;',
  'const transitionJobId = activeJob.id;',
  'const completionJobId = activeJob.id;',
  'const supportJobId = activeJob.id;',
  'COURIER_ACTION_TIMEOUT_MS = 20_000',
  'current === "delivery" ? null : current',
  'current === "support" ? null : current',
], 'Aceitar, recusar, transicionar, concluir e suporte não ficam presos em busy infinito');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-online-bootstrap.mjs';",
  "import './harden-partner-entregador-gps-resume.mjs';",
  "import './harden-partner-entregador-quiet-refresh.mjs';",
  "import './harden-partner-entregador-push-runtime.mjs';",
  "import './harden-partner-entregador-state-handoff.mjs';",
], 'Umbrella real do Entregador executa bootstrap, GPS resume, quiet refresh, Push e handoff');

requireAll('superapp/partner-shell/index.html', [
  'const isDelivery=Boolean(orderId)',
  'const isRide=Boolean(rideId)',
  'if(isDelivery&&isRide)return false;',
  "localStorage.setItem('apois-parceiro:last-module','entregador')",
  "localStorage.setItem('apois-parceiro:last-module','motorista')",
], 'Shell do Parceiro não decide payload ambíguo e roteia por produto explícito');

requireAll('scripts/harden-partner-entregador-finance.mjs', [
  'Recebimento direto em homologação',
  'Nenhuma chave PIX ou valor de saque é solicitado nesta fase.',
  'Histórico de repasses',
], 'Financeiro do Entregador não promete saque antes de marketplace direto');
forbidAll('scripts/harden-partner-entregador-finance.mjs', [
  '<h2 className="font-black">Solicitar saque</h2>',
  '>Salvar chave PIX<',
], 'Financeiro do Entregador não preserva CTA legado de saque');

process.exit(failed ? 1 : 0);
