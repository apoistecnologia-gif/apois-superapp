import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const ok=(m)=>console.log('[OK] '+m);
const read=(p)=>readFileSync(resolve(p),'utf8');

const edge=read('supabase/functions/create-order/index.ts');
const hardener=read('scripts/harden-entregas-payment-provider-boundary.mjs');
const runtime=read('supabase/functions/safe2pay-create-order-pix/index.ts');
const webhook=read('supabase/functions/safe2pay-webhook/index.ts');

for(const marker of [
  'const PAYMENT_METHODS = new Set(["pix"]);',
  'p_customer_user_id: userData.user.id',
  'p_payment_method: paymentMethod',
  'snapshot.payment_method !== "pix"',
  'snapshot.payment_status === "paid"',
  'FINANCIAL_CONTRACT_MISMATCH',
]) if(!edge.includes(marker)) fail('create-order perdeu contrato Safe2Pay: '+marker);

if(/payment_status\s*[:=]\s*["']paid["']/i.test(edge)){
  fail('create-order contém atribuição que pode fabricar paid');
}

for(const marker of [
  'const paymentMethod = "pix";',
  'paymentMethod: "pix"',
  '"safe2pay-create-order-pix"',
  '"safe2pay-payment-status"',
  'configuredProvider = "safe2pay_marketplace"',
  'pixResponse?.pix?.copyPaste',
]) if(!hardener.includes(marker)) fail('hardener Safe2Pay incompleto: '+marker);

for(const forbidden of [
  'create-merchant-mercadopago-pix',
  'create-asaas-pix-charge',
  'create-pix-charge',
  'openpix-payout',
  'sync-payment-status',
  'merchant-payment-readiness',
]) if(hardener.includes(forbidden)) fail('hardener ainda ativa provider aposentado: '+forbidden);

for(const marker of [
  '.eq("customer_user_id", authData.user.id)',
  'merchant_safe2pay_accounts',
  'safe2pay_order_transactions',
  'merchant_amount: amount',
  'IsPayTax: feePayer === "receiver"',
]) if(!runtime.includes(marker)) fail('runtime Safe2Pay order incompleto: '+marker);

for(const marker of [
  'SAFE2PAY_SECRET_KEY',
  'safeEqual(receivedSecret, configuredSecret)',
  'payment_status: "paid"',
  'safe2pay_webhook_events',
]) if(!webhook.includes(marker)) fail('webhook Safe2Pay incompleto: '+marker);

if(failed) process.exit(1);
ok('Entregas cria pedido PIX pending, cobra via Safe2Pay e só confirma pagamento por reconciliação backend.');
