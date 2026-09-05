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
  'openpix-payout',
  'MP_DEVICE_SESSION_ID',
  'PixPaymentScreen(',
  'devolução automática por gateway não se aplica',
  'SEM GATEWAY DA APOIS',
], 'Boundary final de Entregas usa pagamento direto e rejeita resíduos de gateway/PIX');

requireMarkers('scripts/harden-entregas-direct-payment-operations.mjs', [
  'function isOperationalPayment(order: MerchantOrder)',
  'return status === "paid" || (method === "cash" && status === "pending");',
  'const paymentReady = isOperationalPayment(order);',
  'function isAlertableOrderPayment(',
  'isAlertableOrderPayment(order.payment_method, order.payment_status)',
], 'Operação merchant reconhece cash/pending sem marcar o pedido como pago');

requireMarkers('.apois/modules.json', [
  'harden-entregas-payment-provider-boundary.mjs',
  'harden-entregas-direct-payment-operations.mjs',
  'bun run build:customer',
], 'Boundaries de pagamento direto são aplicados antes do build customer');

requireMarkers('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql', [
  'Merchant members can view operational merchant orders',
  "payment_method = 'cash' and payment_status in ('pending','cancelled')",
  "v_order.payment_method = 'cash' and v_order.payment_status = 'pending'",
  'merchant access required',
], 'Migration forward-only preserva autorização merchant e libera apenas cash direto');

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
