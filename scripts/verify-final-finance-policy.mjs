import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function read(path) { const full = resolve(path); if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; } return readFileSync(full, 'utf8'); }

const rideService = read('.work/corridas/src/services/payments/payment-service.ts');
if (rideService) {
  for (const marker of [
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'if (!isActive || !isDirectToDriver) return [];',
    'Pague diretamente ao motorista em dinheiro ao final da corrida.',
    'Pague diretamente ao motorista no cartão de crédito',
  ]) if (!rideService.includes(marker)) fail(`Corridas: política direta ausente (${marker})`);
  if (!failed) ok('Corridas: somente Dinheiro/Crédito direto ao motorista ficam no fluxo ativo');
}

const checkout = read('.work/entregas/src/routes/checkout.tsx');
if (checkout) {
  if (!checkout.includes('const paymentMethod = "cash";')) fail('Entregas: checkout não está em pagamento direto');
  if (!checkout.includes('paymentMethod: "cash"')) fail('Entregas: create-order não recebe cash');
  if (!checkout.includes('Pedido criado. O pagamento será feito diretamente ao estabelecimento.')) fail('Entregas: feedback do pagamento direto ausente');
  for (const forbidden of [
    'merchant-payment-readiness',
    'create-merchant-mercadopago-pix',
    'create-asaas-pix-charge',
    'create-pix-charge',
    'mercadopago.com/v2/security.js',
    'sync-payment-status',
  ]) if (checkout.includes(forbidden)) fail(`Entregas: gateway antigo permaneceu no checkout (${forbidden})`);
}

const createOrder = read('.work/entregas/supabase/functions/create-order/index.ts');
if (createOrder) {
  if (!createOrder.includes('const PAYMENT_METHODS = new Set(["cash"]);')) fail('Entregas: create-order não restringe o método temporário a cash');
  if (createOrder.includes('payment_status: "paid"') || createOrder.includes("payment_status: 'paid'")) fail('Entregas: payment_status=paid não pode ser fabricado');
}

if (failed) process.exit(1);
ok('Política financeira final verificada sem gateway legado no fluxo ativo.');
