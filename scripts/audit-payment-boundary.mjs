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
for (const marker of ['paymentMethod: "cash"', 'const PAYMENT_METHODS = new Set(["cash"]);', 'merchant-payment-readiness', 'create-merchant-mercadopago-pix']) {
  if (!entregasHardener.includes(marker)) fail(`boundary Entregas sem contrato ${marker}`);
}

const modules = read('.apois/modules.json');
if (!modules.includes('harden-entregas-payment-provider-boundary.mjs')) fail('build Entregas não executa boundary financeiro final');

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
  for (const forbidden of ['merchant-payment-readiness','create-merchant-mercadopago-pix','create-asaas-pix-charge','create-pix-charge','mercadopago.com/v2/security.js','sync-payment-status']) {
    if (checkout.includes(forbidden)) fail(`workspace Entregas contém gateway ativo: ${forbidden}`);
  }
  if (!checkout.includes('const paymentMethod = "cash";') || !checkout.includes('paymentMethod: "cash"')) fail('workspace Entregas não usa cash direto');
  else ok('workspace Entregas usa pedido direto sem gateway');
}
const createOrder = read('.work/entregas/supabase/functions/create-order/index.ts');
if (createOrder) {
  if (!createOrder.includes('const PAYMENT_METHODS = new Set(["cash"]);')) fail('create-order da integração não aceita boundary cash');
  if (createOrder.includes('payment_status: "paid"') || createOrder.includes("payment_status: 'paid'")) fail('create-order fabrica paid');
}

if (failed) process.exit(1);
ok('Boundary financeiro final auditado: gateways antigos ficam fora dos fluxos ativos.');
