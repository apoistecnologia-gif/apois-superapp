import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] arquivo ausente: ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireMarkers(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}
function forbidMarkers(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireMarkers('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./harden-entregas-delivery-readiness.mjs');",
  "await import('./harden-entregas-merchant-direct-finance.mjs');",
  "await import('./harden-entregas-superapp-refunds.mjs');",
  'boundary final de',
], 'Entregas preserva logística/financeiro direto sem reativar gateway antigo');
forbidMarkers('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./normalize-entregas-merchant-mp-handoff.mjs');",
  "await import('./harden-entregas-merchant-mercadopago-v2.mjs');",
], 'Entregas não executa hardeners de Mercado Pago no build ativo');

requireMarkers('scripts/harden-entregas-payment-provider-boundary.mjs', [
  'sessionStorage.setItem("apois_payment_method", "cash")',
  'const paymentMethod = "cash";',
  'paymentMethod: "cash"',
  'Pedido criado. O pagamento será feito diretamente ao estabelecimento.',
  'const PAYMENT_METHODS = new Set(["cash"]);',
  'process-superapp-refund',
  'devolução automática por gateway não se aplica',
  'SEM GATEWAY DA APOIS',
], 'Boundary final de Entregas usa pagamento direto e neutraliza estorno eletrônico');

requireMarkers('.apois/modules.json', [
  'harden-entregas-payment-provider-boundary.mjs',
  'bun run build:customer',
], 'Boundary de pagamento direto é aplicado antes do build customer');

requireMarkers('supabase/migrations/20260826051214_courier_manual_settlements.sql', [
  'merchant pays the courier directly via',
  'APOIS never custodies or moves this money',
  "if v_order.payment_method = 'pix' and v_order.payment_status <> 'paid'",
], 'Repasse manual de entregador continua sem custódia pela APOIS');

requireMarkers('scripts/harden-entregas-delivery-readiness.mjs', [
  'get_delivery_checkout_readiness',
  'deliveryPlatformAvailable',
], 'Readiness logístico continua presente e independente do gateway do pedido');

process.exit(failed ? 1 : 0);
