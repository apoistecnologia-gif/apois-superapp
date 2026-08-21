import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

check('scripts/neutralize-entregas-superapp-legacy.mjs', [
  "await import('./harden-entregas-merchant-mercadopago-v2.mjs');",
  "await import('./harden-entregas-superapp-refunds.mjs');",
], 'Entregas executa hardening Mercado Pago e estornos na cópia .work');

check('scripts/harden-entregas-merchant-mercadopago-v2.mjs', [
  'merchant-payment-readiness',
  'create-merchant-mercadopago-pix',
  'MerchantMercadoPagoConnection',
  'A APOIS não recebe o valor da venda e não cobra percentual por pedido.',
], 'Entregas direciona PIX ao Mercado Pago do estabelecimento com taxa APOIS zero');

check('scripts/harden-entregas-superapp-refunds.mjs', [
  'process-superapp-refund',
  'src/routes/pedido/$orderId/index.tsx',
  'src/components/MerchantOrderControlCenter.tsx',
  'src/routes/merchant.tsx',
  'src/routes/admin.tsx',
], 'Cancelamentos do Superapp usam conciliador compatível com Mercado Pago OAuth');

check('.env.example', [
  'MERCADO_PAGO_OAUTH_CLIENT_ID=',
  'MERCADO_PAGO_OAUTH_CLIENT_SECRET=',
  'MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64=',
  'MERCADO_PAGO_MERCHANT_REDIRECT_URI=',
  'MERCADO_PAGO_MERCHANT_WEBHOOK_SECRET=',
], 'Segredos externos Mercado Pago necessários estão documentados sem valores reais');

process.exit(failed ? 1 : 0);
