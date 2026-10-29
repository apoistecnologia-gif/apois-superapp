import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) { const full = resolve(path); return existsSync(full) ? readFileSync(full, 'utf8') : ''; }
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }

const corridasHardener = read('scripts/harden-corridas-payment-provider-boundary.mjs');
for (const marker of ['code === "cash" || code === "credit"', 'if (!isActive || !isDirectToDriver) return []', 'nenhum PIX eletrônico']) {
  if (!corridasHardener.includes(marker)) fail(`boundary Corridas sem ${marker}`);
}

const isCashTestBuild = process.env.APOIS_ENTREGAS_CASH_TEST_MODE === "1";
if(isCashTestBuild){
const entregasHardener = read('scripts/harden-entregas-payment-provider-boundary.mjs');
for (const marker of [
  'paymentMethod: "cash"',
  'const PAYMENT_METHODS = new Set(["cash"]);',
  'merchant-payment-readiness',
  'create-merchant-mercadopago-pix',
  'openpix-payout',
  'MP_DEVICE_SESSION_ID',
  'PixPaymentScreen(',
]) {
  if (!entregasHardener.includes(marker)) fail(`boundary Entregas sem contrato ${marker}`);
}

const directOperations = read('scripts/harden-entregas-direct-payment-operations.mjs');
for (const marker of [
  'return status === "paid" || (method === "cash" && status === "pending");',
  'const paymentReady = isOperationalPayment(order);',
  'isAlertableOrderPayment(order.payment_method, order.payment_status)',
]) {
  if (!directOperations.includes(marker)) fail(`operação Entregas direta sem ${marker}`);
}

const directMigration = read('supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql');
for (const marker of [
  "payment_method = 'cash' and payment_status in ('pending','cancelled')",
  'create policy "Merchant members can view operational merchant orders"',
  "v_order.payment_method = 'cash' and v_order.payment_status = 'pending'",
  'merchant access required',
]) {
  if (!directMigration.includes(marker)) fail(`migration forward-only Entregas sem ${marker}`);
}


} else {
const prodBuild = read(".apois/modules.json");
const prodGuard = read("scripts/harden-entregas-pix-production-guard.mjs");
for(const marker of ["APOIS_ENTREGAS_CASH_TEST_MODE","harden-entregas-pix-production-guard.mjs","harden-entregas-cash-test-badges.mjs"]){
  if(!prodBuild.includes(marker)) fail("build Entregas não distingue teste e produção: "+marker);
}
if(!prodGuard.includes("APOIS_ENTREGAS_PIX_PRODUCTION_GUARD_V1"))
  fail("checkout PIX de produção não está protegido contra cobrança legado");

}

const motorFinance = read('scripts/harden-motorista-finance-boundary.mjs');
for (const marker of [
  'Pagamento eletrônico temporariamente indisponível',
  'Nenhum gateway de cobrança está ativo',
  '.eq("auth_user_id", auth.user.id)',
  '.eq("user_id", profile.id)',
]) {
  if (!motorFinance.includes(marker)) fail(`boundary Motorista sem ${marker}`);
}
const motorBuild = read('scripts/build-motorista-module.mjs');
if (!motorBuild.includes('harden-motorista-finance-boundary.mjs')) fail('build Motorista não aplica boundary financeiro final');
for (const forbidden of ['harden-motorista-superapp-mercadopago.mjs', 'auth/mercadopago']) {
  if (motorBuild.includes(forbidden)) fail(`build Motorista ainda ativa integração removida: ${forbidden}`);
}

const modules = read('.apois/modules.json');
for (const marker of ['harden-entregas-payment-provider-boundary.mjs', 'harden-entregas-direct-payment-operations.mjs']) {
  if (!modules.includes(marker)) fail(`build Entregas não executa ${marker}`);
}

const neutralize = read('scripts/neutralize-entregas-superapp-legacy.mjs');
if (neutralize.includes("await import('./harden-entregas-merchant-mercadopago-v2.mjs');") || neutralize.includes("await import('./normalize-entregas-merchant-mp-handoff.mjs');")) {
  fail('pipeline Entregas ainda executa hardeners Mercado Pago concorrentes');
}

const rideService = read('.work/corridas/src/services/payments/payment-service.ts');
if (rideService) {
  if (!rideService.includes('if (!isActive || !isDirectToDriver) return [];')) fail('workspace Corridas não filtra pagamentos eletrônicos');
  else ok('workspace Corridas expõe somente pagamento direto');
}

if(isCashTestBuild){
const checkout = read('.work/entregas/src/routes/checkout.tsx');
if (checkout) {
  for (const forbidden of [
    'merchant-payment-readiness','create-merchant-mercadopago-pix','create-asaas-pix-charge','create-pix-charge','openpix-payout',
    'mercadopago.com/v2/security.js','MP_DEVICE_SESSION_ID','ensureMercadoPagoSecurityScript','readMercadoPagoDeviceId',
    'sync-payment-status','type PixData =','PixPaymentScreen(','pixData','setPixData','handleCopyPix','QRCode','QrCode',
  ]) {
    if (checkout.includes(forbidden)) fail(`workspace Entregas contém gateway/Pix ativo: ${forbidden}`);
  }
  if (/mercadopago|openpix|pagbank|asaas/i.test(checkout)) fail('workspace Entregas ainda contém referência executável a gateway removido');
  if (!checkout.includes('const paymentMethod = "cash";') || !checkout.includes('paymentMethod: "cash"')) fail('workspace Entregas não usa cash direto');
  else ok('workspace Entregas usa pedido direto sem gateway');
}

const createOrder = read('.work/entregas/supabase/functions/create-order/index.ts');
if (createOrder) {
  if (!createOrder.includes('const PAYMENT_METHODS = new Set(["cash"]);')) fail('create-order da integração não aceita boundary cash');
  if (createOrder.includes('payment_status: "paid"') || createOrder.includes("payment_status: 'paid'")) fail('create-order fabrica paid');
}

const merchantControl = read('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
if (merchantControl) {
  if (!merchantControl.includes('const paymentReady = isOperationalPayment(order);')) fail('merchant control não reconhece cash/pending como operacional');
  if (merchantControl.includes('.eq("payment_status", "paid")\n      .in("status", ACTIVE_STATUSES)')) fail('merchant control ainda oculta pedido cash/pending');
}
const merchantWatcher = read('.work/entregas/src/components/MerchantOrderSoundWatcher.tsx');
if (merchantWatcher) {
  if (!merchantWatcher.includes('isAlertableOrderPayment(order.payment_method, order.payment_status)')) fail('alerta merchant não reconhece cash/pending');
  if (merchantWatcher.includes('Novo pedido pago')) fail('alerta merchant ainda promete pagamento confirmado');
}


} else {
const checkout = read(".work/entregas/src/routes/checkout.tsx");
if (checkout && (!checkout.includes("APOIS_ENTREGAS_PIX_PRODUCTION_GUARD_V1") ||
                 checkout.includes('paymentMethod: "cash"'))) {
  fail("checkout Entregas produção não manteve PIX-only fail-closed");
}

}

if (failed) process.exit(1);
ok('Boundary financeiro final auditado: gateways antigos ficam fora dos fluxos ativos e cash/pending continua operacional.');
