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
  'PushNotifications.unregister()',
], 'Motorista isola Push ambíguo e trata foreground/tap sem perder token compartilhado');

requireAll('scripts/harden-partner-motorista-active-resume.mjs', [
  'resyncDriverRides()',
  'apois:driver-push',
  'apois:driver-push-open',
  'removeEventListener',
], 'Motorista ressincroniza corrida/oferta imediatamente após Push');

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

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-offer-expiry.mjs';",
  "import './harden-partner-entregador-map-camera.mjs';",
], 'Build do Entregador aplica expiração de oferta e câmera estável');

forbidAll('scripts/harden-partner-motorista-push.mjs', [
  'política Pix-only aplicada',
], 'log do Motorista não declara política Pix-only obsoleta');

process.exit(failed ? 1 : 0);
