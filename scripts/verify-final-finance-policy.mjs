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
    'openpix-payout',
    'mercadopago.com/v2/security.js',
    'MP_DEVICE_SESSION_ID',
    'ensureMercadoPagoSecurityScript',
    'readMercadoPagoDeviceId',
    'sync-payment-status',
    'type PixData =',
    'PixPaymentScreen(',
    'pixData',
    'setPixData',
    'handleCopyPix',
    'QRCode',
    'QrCode',
  ]) if (checkout.includes(forbidden)) fail(`Entregas: gateway/PIX antigo permaneceu no checkout (${forbidden})`);
  if (/mercadopago|openpix|pagbank|asaas/i.test(checkout)) fail('Entregas: checkout final contém referência executável a gateway removido');
}

const createOrder = read('.work/entregas/supabase/functions/create-order/index.ts');
if (createOrder) {
  if (!createOrder.includes('const PAYMENT_METHODS = new Set(["cash"]);')) fail('Entregas: create-order não restringe o método temporário a cash');
  if (createOrder.includes('payment_status: "paid"') || createOrder.includes("payment_status: 'paid'")) fail('Entregas: payment_status=paid não pode ser fabricado');
}

const merchantControl = read('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
if (merchantControl) {
  if (!merchantControl.includes('return status === "paid" || (method === "cash" && status === "pending");')) fail('Entregas: merchant não reconhece cash/pending');
  if (!merchantControl.includes('const paymentReady = isOperationalPayment(order);')) fail('Entregas: ações merchant não usam boundary operacional');
}
const merchantWatcher = read('.work/entregas/src/components/MerchantOrderSoundWatcher.tsx');
if (merchantWatcher) {
  if (!merchantWatcher.includes('isAlertableOrderPayment(order.payment_method, order.payment_status)')) fail('Entregas: alerta merchant não inclui cash/pending');
  if (merchantWatcher.includes('Novo pedido pago')) fail('Entregas: alerta merchant promete pagamento confirmado indevidamente');
}

const cashMigration = read('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql');
for (const marker of [
  'Merchant members can view operational merchant orders',
  "payment_method = 'cash' and payment_status in ('pending','cancelled')",
  "v_order.payment_method = 'cash' and v_order.payment_status = 'pending'",
]) if (!cashMigration.includes(marker)) fail(`Entregas: migration de operação cash sem ${marker}`);

const motorBuild = read('scripts/build-motorista-module.mjs');
if (!motorBuild.includes('harden-motorista-finance-boundary.mjs')) fail('Motorista: build não aplica boundary financeiro sem gateway');
if (motorBuild.includes('harden-motorista-superapp-mercadopago.mjs') || motorBuild.includes('auth/mercadopago')) fail('Motorista: build reativou Mercado Pago');
const motorBoundary = read('scripts/harden-motorista-finance-boundary.mjs');
if (!motorBoundary.includes('Pagamento eletrônico temporariamente indisponível') || !motorBoundary.includes('Nenhum gateway de cobrança está ativo')) {
  fail('Motorista: tela de mensalidade não representa ausência de gateway');
}

if (failed) process.exit(1);
ok('Política financeira final verificada sem gateway legado e sem fabricar pagamento aprovado.');
