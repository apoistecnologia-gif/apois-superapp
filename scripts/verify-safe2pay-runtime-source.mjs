import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = {
  shared: 'supabase/functions/_shared/safe2pay.ts',
  ride: 'supabase/functions/safe2pay-create-ride-pix/index.ts',
  order: 'supabase/functions/safe2pay-create-order-pix/index.ts',
  webhook: 'supabase/functions/safe2pay-webhook/index.ts',
  status: 'supabase/functions/safe2pay-payment-status/index.ts',
};
let failed = false;
const fail = (m) => { failed = true; console.error('[FAIL] ' + m); };
const ok = (m) => console.log('[OK] ' + m);
const source = {};
for (const [name, path] of Object.entries(files)) source[name] = readFileSync(resolve(path), 'utf8');

for (const marker of [
  'PaymentMethod: "6"',
  'IsSandbox: false',
  'SAFE2PAY_PROVIDER_ENABLED',
  'SAFE2PAY_PIX_FEE_PAYER',
  'safe2pay_split_total_mismatch',
  'ResponseDetail',
  'detail.TransactionStatus',
  'value.trim().startsWith("000201")',
]) if (!source.shared.includes(marker)) fail('shared sem marker: ' + marker);

for (const marker of [
  '.eq("auth_user_id", authData.user.id)',
  '.eq("passenger_id", domainUser.id)',
  'driver_safe2pay_accounts',
  'safe2pay_ride_transactions',
  'pix_copy_paste',
  'pix_qr_code_base64',
  'expires_at',
  'IsPayTax: feePayer === "receiver"',
]) if (!source.ride.includes(marker)) fail('ride charge sem ownership/receiver: ' + marker);

for (const marker of [
  '.eq("customer_user_id", authData.user.id)',
  'merchant_safe2pay_accounts',
  'safe2pay_order_transactions',
  'pix_copy_paste',
  'pix_qr_code_base64',
  'merchant_amount: amount',
  'IsPayTax: feePayer === "receiver"',
]) if (!source.order.includes(marker)) fail('order charge sem ownership/receiver: ' + marker);
if (source.order.includes('courier_safe2pay_accounts')) fail('order charge não pode depender de courier receiver no checkout');
if (source.shared.includes('["code", "statuscode"].includes(key)')) fail('shared não pode tratar Code arbitrário como status transacional');

for (const marker of [
  'SAFE2PAY_SECRET_KEY',
  'safeEqual(receivedSecret, configuredSecret)',
  'safe2pay_webhook_events',
  'provider_transaction_id',
  'payload_hash',
  'shouldAdvance(current, mapped)',
  'payment_status: "paid"',
]) if (!source.webhook.includes(marker)) fail('webhook sem segurança/idempotência: ' + marker);

for (const marker of [
  '.eq("customer_user_id", authData.user.id)',
  '.eq("auth_user_id", authData.user.id)',
  '.eq("passenger_id", user.data.id)',
]) if (!source.status.includes(marker)) fail('status endpoint sem ownership: ' + marker);

for (const [name, src] of Object.entries(source)) {
  for (const forbidden of [
    'console.log(providerPayload',
    'console.log(payload)',
    'VITE_SAFE2PAY',
    'MERCADO_PAGO_',
    'ASAAS_API',
    'OPENPIX_',
    'PAGBANK_',
  ]) if (src.includes(forbidden)) fail(name + ': marker sensível/legado: ' + forbidden);
}

if (failed) process.exit(1);
ok('Safe2Pay charge/webhook/status source possui ownership, idempotência e fail-closed contracts.');
