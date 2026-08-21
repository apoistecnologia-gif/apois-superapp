import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const read = (path) => {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Parceiro v2: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-motorista-push-runtime.mjs', [
  'pushNotificationReceived',
  'if (delivery && ride) return;',
  'apois:driver-push',
  'apois:driver-push-open',
], 'Motorista isola Push ambíguo e trata foreground/tap sem perder token compartilhado');
forbidAll('scripts/harden-partner-motorista-push-runtime.mjs', [
  'await PushNotifications.unregister();',
], 'Motorista não invalida o token FCM compartilhado do APOIS Parceiro');

requireAll('scripts/harden-partner-motorista-active-resume.mjs', [
  'resyncDriverRides()',
  'apois:driver-push',
  'apois:driver-push-open',
  'removeEventListener',
], 'Motorista ressincroniza corrida/oferta imediatamente após Push');

requireAll('scripts/harden-partner-motorista-post-finish.mjs', [
  'const completedRide = await callComplete',
  'setActive(null);',
  'setRatingRide(completedRide);',
  'event: "ride.completed"',
  'window.dispatchEvent(new CustomEvent("apois:driver-push"',
], 'Motorista aplica encerramento local imediatamente e força promoção/ressincronização da próxima corrida');

requireAll('scripts/harden-partner-motorista-push.mjs', [
  "import './harden-partner-motorista-post-finish.mjs';",
], 'pipeline do Motorista executa o hardening pós-finalização');

requireAll('scripts/harden-partner-motorista-native-watch.mjs', [
  'useRef<number | string | null>(null)',
  'Geolocation.watchPosition(',
  'Geolocation.clearWatch({ id })',
  'watchStopRequestedRef',
  'stopDriverWatch();',
], 'Motorista usa watcher GPS nativo contínuo e o encerra com segurança ao ficar offline');

requireAll('scripts/build-partner-modules.sh', [
  'harden-partner-motorista-native-watch.mjs',
  "require_contains 'Geolocation.watchPosition('",
  "require_contains 'stopDriverWatch();'",
], 'build Parceiro aplica e valida o watcher GPS nativo do Motorista');

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-history-receipt.mjs';",
  'case "credit":',
  'case "credit_card":',
  'case "cartao_credito":',
  'case "card":',
  'return "Cartão";',
], 'Motorista preserva Dinheiro/PIX/Cartão e normaliza cartão direto');
forbidAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  'Pix-only', 'PIX-only', 'somente Pix', 'somente PIX',
], 'Motorista não reintroduz política exclusiva de Pix');

requireAll('scripts/harden-partner-motorista-history-receipt.mjs', [
  'settlement?.driver_earning ?? settlement?.passenger_charge',
  'Valor do motorista:',
  'receiptPaymentLabel',
  'A APOIS não retém comissão nem recebe o valor da corrida.',
  'doc.setFillColor(246, 190, 28);',
  'Valor da corrida',
], 'Histórico e recibos do Motorista refletem recebimento direto e identidade APOIS');

requireAll('scripts/harden-partner-entregador-offer-expiry.mjs', [
  'offer.expires_at',
  'remainingSeconds',
  'window.setInterval(() => setNowMs(Date.now()), 1000)',
  'Oferta expirada',
  'onExpire?.(offer.id)',
  'busy || expired',
], 'Entregador exibe expiração real da oferta e impede aceite vencido');

requireAll('scripts/harden-partner-entregador-map-camera.mjs', [
  'cameraTargetRef',
  'shouldFitCamera',
  'cameraTargetRef.current = target',
  'if (shouldFitCamera)',
], 'Mapa ativo do Entregador não sequestra câmera após pan manual');

requireAll('scripts/harden-partner-entregador-finance.mjs', [
  'Ganhos registrados',
  'Total registrado',
  'Recebimento direto em homologação',
  'A APOIS não libera saque manual',
  'Nenhuma chave PIX ou valor de saque é solicitado nesta fase.',
], 'Entregador não oferece saque sem lastro antes do marketplace direto');
forbidAll('scripts/harden-partner-entregador-finance.mjs', [
  '<h2 className="font-black">Solicitar saque</h2>',
  '>Salvar chave PIX<',
], 'hardening financeiro não preserva CTA legado de saque/PIX');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-offer-expiry.mjs';",
  "import './harden-partner-entregador-map-camera.mjs';",
  "import './harden-partner-entregador-finance.mjs';",
], 'Build do Entregador aplica expiração, câmera estável e proteção financeira');

requireAll('supabase/migrations/20260821233000_disable_legacy_courier_payout_until_marketplace_direct_live.sql', [
  "'courier_payout_mode'",
  "'\"marketplace_direct_pending\"'::jsonb",
  'revoke execute on function public.request_payout(uuid,numeric,text) from authenticated;',
  'get_courier_payout_readiness',
  "'marketplace_direct_live'",
], 'backend bloqueia saque legado e expõe estado explícito do repasse do Entregador');

requireAll('supabase/migrations/20260821233200_guard_delivery_orders_until_courier_marketplace_live.sql', [
  'enforce_delivery_financial_readiness',
  "new.fulfillment_type = 'delivery'",
  "v_mode <> 'marketplace_direct_live'",
  'orders_require_delivery_financial_readiness',
], 'pedido com entrega não nasce antes do repasse direto estar homologado');

forbidAll('scripts/harden-partner-motorista-push.mjs', [
  'política Pix-only aplicada',
], 'log do Motorista não declara política Pix-only obsoleta');

process.exit(failed ? 1 : 0);
