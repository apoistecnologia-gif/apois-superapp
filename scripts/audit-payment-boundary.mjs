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

if (failed) process.exit(1);
ok('Boundary financeiro final auditado: gateways antigos ficam fora dos fluxos ativos e cash/pending continua operacional.');

// Run the isolated callback simulations using the Bun already pinned by the WEB QA builder.
// This WEB-only audit remains separate from the fail-closed Safe2Pay production gate.
const { spawnSync } = await import('node:child_process');
// Windows: `bun` é um .cmd e spawnSync direto falha com ENOENT, o que fazia este
// gate reprovar sem que o teste isolado tivesse qualquer problema. Usamos o
// mesmo tratamento de build-product.mjs (shell no win32).
const bunBin = process.platform === 'win32' ? 'bun.cmd' : 'bun';
const bunOpts = { stdio: 'inherit', shell: process.platform === 'win32' };
const cashCheck = spawnSync(bunBin, ['scripts/test-entregas-cash-create-order-isolated-v1.mjs'], bunOpts);
if (cashCheck.error || cashCheck.status !== 0) {
  console.error('[FAIL] O teste isolado de pedido em dinheiro falhou; homologação CASH NÃO LIBERADA.');
  process.exit(1);
}
ok('Entregas: Edge real cash-only validada com mocks, sem API, pagamento ou banco real.');
const replayCheck = spawnSync(bunBin, ['scripts/test-safe2pay-webhook-retry-v1.mjs'], bunOpts);
if (replayCheck.error || replayCheck.status !== 0) {
  console.error('[FAIL] Simulação isolada de reenvio Safe2Pay não passou.');
  process.exit(1);
}
ok('Safe2Pay: reenvio, zero registros e estornos simulados sem gravar em bancos reais.');
const sandboxCheck = spawnSync(bunBin, ['scripts/test-safe2pay-environment-isolation-v1.mjs'], bunOpts);
if (sandboxCheck.error || sandboxCheck.status !== 0) {
  console.error('[FAIL] QA Safe2Pay sandbox isolation: a test configuration could reach live credentials.');
  process.exit(1);
}
ok('Safe2Pay: configuração de sandbox isolada de produção e Pix real bloqueado em ambiente de teste.');
const releaseGate = spawnSync(process.execPath, ['scripts/verify-safe2pay-production-readiness-v1.mjs'], {
  encoding: 'utf8',
});
if (releaseGate.error || releaseGate.status !== 1 ||
  !releaseGate.stderr.includes('[BLOCKED]') ||
  !releaseGate.stdout.includes('One-transaction canonical payments reconciliation for Entregas')) {
  console.error('[FAIL] The Safe2Pay production release gate did not block missing canonical payments.');
  console.error(releaseGate.stdout ?? '', releaseGate.stderr ?? '');
  process.exit(1);
}
ok('WEB-only QA passed; separate financial release gate correctly blocks incomplete ledger reconciliation.');

