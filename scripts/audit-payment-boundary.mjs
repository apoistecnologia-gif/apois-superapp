import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
const read=(p)=>{const full=resolve(p);return existsSync(full)?readFileSync(full,'utf8'):''};
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const ok=(m)=>console.log('[OK] '+m);

// Corridas remains fail-closed for electronic payment until Safe2Pay runtime is live.
// Cash/credit direct to driver stay available without invoking retired gateways.
const corridas=read('scripts/harden-corridas-payment-provider-boundary.mjs');
for(const marker of [
  'code === "cash" || code === "credit"',
  'if (!isActive || !isDirectToDriver) return []',
  'nenhum PIX eletrônico',
]) if(!corridas.includes(marker)) fail('boundary Corridas sem '+marker);

// Entregas is Safe2Pay-ready and must not retain any active legacy-provider branch.
const entregas=read('scripts/harden-entregas-payment-provider-boundary.mjs');
for(const marker of [
  'const paymentMethod = "pix";',
  'paymentMethod: "pix"',
  '"safe2pay-create-order-pix"',
  '"safe2pay-payment-status"',
  'configuredProvider = "safe2pay_marketplace"',
  'pixResponse?.pix?.copyPaste',
]) if(!entregas.includes(marker)) fail('boundary Entregas Safe2Pay sem '+marker);

for(const forbidden of [
  'create-merchant-mercadopago-pix',
  'create-asaas-pix-charge',
  'create-pix-charge',
  'openpix-payout',
  'sync-payment-status',
  'merchant-payment-readiness',
  'mercadopago.com/v2/security.js',
]) if(entregas.includes(forbidden)) fail('boundary Entregas ainda ativa provider aposentado: '+forbidden);

const operations=read('scripts/harden-entregas-direct-payment-operations.mjs');
for(const marker of [
  'return status === "paid";',
  'const paymentReady = isOperationalPayment(order);',
  'isAlertableOrderPayment(order.payment_method, order.payment_status)',
]) if(!operations.includes(marker)) fail('operações Entregas não exigem paid: '+marker);
if(operations.includes('method === "cash" && status === "pending"')) {
  fail('operações Entregas ainda tratam cash/pending como pagamento pronto');
}

const modules=read('.apois/modules.json');
for(const marker of [
  'harden-entregas-payment-provider-boundary.mjs',
  'harden-entregas-direct-payment-operations.mjs',
]) if(!modules.includes(marker)) fail('build Entregas não executa '+marker);

const checkout=read('.work/entregas/src/routes/checkout.tsx');
if(checkout){
  for(const marker of [
    '"safe2pay-create-order-pix"',
    '"safe2pay-payment-status"',
    'const paymentMethod = "pix";',
  ]) if(!checkout.includes(marker)) fail('workspace Entregas sem Safe2Pay: '+marker);
  for(const forbidden of ['mercadopago','openpix','pagbank','asaas','sync-payment-status']) {
    if(checkout.toLowerCase().includes(forbidden)) fail('workspace Entregas contém provider aposentado: '+forbidden);
  }
  ok('workspace Entregas usa somente Safe2Pay para PIX');
}

const createOrder=read('.work/entregas/supabase/functions/create-order/index.ts');
if(createOrder){
  if(!createOrder.includes('const PAYMENT_METHODS = new Set(["pix"]);')) fail('create-order da integração não aceita PIX Safe2Pay');
  if(createOrder.includes('payment_status: "paid"')||createOrder.includes("payment_status: 'paid'")) fail('create-order fabrica paid');
}

const merchant=read('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
if(merchant){
  if(!merchant.includes('return status === "paid";')) fail('merchant control não exige pagamento confirmado');
  if(merchant.includes('method === "cash" && status === "pending"')) fail('merchant control ainda libera cash/pending');
}

if(failed) process.exit(1);
ok('Boundary financeiro auditado: Entregas Safe2Pay, Corridas eletrônico fail-closed e providers antigos fora dos fluxos ativos.');
