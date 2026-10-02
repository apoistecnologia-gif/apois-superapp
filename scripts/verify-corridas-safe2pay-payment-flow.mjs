import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const ok=(m)=>console.log('[OK] '+m);
const read=(p)=>readFileSync(resolve(p),'utf8');

const hardener=read('scripts/harden-corridas-safe2pay-payment-flow.mjs');
for(const marker of [
  'VITE_APOIS_SAFE2PAY_PIX_ENABLED',
  'payment_method: selectedMethod',
  'payment_flow: "safe2pay_marketplace"',
  '"aguardando_pagamento"',
  'safe2pay-create-ride-pix',
  'safe2pay-payment-status',
  'finance.ride_electronic_payments_enabled',
  'electronic_payments_disabled',
]) if(!hardener.includes(marker)) fail('Corridas Safe2Pay hardener sem '+marker);

const charge=read('supabase/functions/safe2pay-create-ride-pix/index.ts');
const chargeCompact=charge.replace(/\s+/g,' ');
for(const marker of [
  'ride.payment_method !== "pix"',
  'ride.status !== "aguardando_pagamento"',
  'driver_safe2pay_accounts',
]) if(!charge.includes(marker)) fail('ride charge sem contrato: '+marker);

for(const [label,pattern] of [
  ['payment_provider safe2pay', /payment_provider:\s*"safe2pay"/],
  ['payment_status publicPix', /payment_status:\s*publicPix\.statusCode\s*===\s*"3"\s*\?\s*"paid"\s*:\s*"pending"/],
]) if(!pattern.test(chargeCompact)) fail('ride charge sem contrato: '+label);

const webhook=read('supabase/functions/safe2pay-webhook/index.ts');
for(const marker of [
  'if (product === "rides")',
  'payment_status: "paid"',
  'payment_provider: "safe2pay"',
  'provider_payment_id: String(transactionId)',
  'payment_confirmed_at: now',
]) if(!webhook.includes(marker)) fail('webhook ride sem reconciliação: '+marker);

const advance=read('supabase/corridas-forward-migrations/20260921182000_advance_safe2pay_ride_after_pix_confirmation.sql');
for(const marker of [
  "new.status = 'aguardando_pagamento'",
  "new.payment_status = 'paid'",
  "lower(coalesce(new.payment_provider,'')) = 'safe2pay'",
  "new.status := 'motorista_a_caminho'",
]) if(!advance.includes(marker)) fail('migration advance sem '+marker);

const driver=read('scripts/harden-motorista-payment-wait.mjs');
for(const marker of [
  '"aguardando_pagamento"',
  'Aguardando pagamento do passageiro',
  'Safe2Pay',
]) if(!driver.includes(marker)) fail('motorista sem hold Safe2Pay: '+marker);
for(const forbidden of ['MercadoPagoSellerCard','disconnect_my_mercadopago_driver','Desconectar Mercado Pago']){
  if(driver.includes(forbidden)) fail('motorista payment wait ainda contém legado: '+forbidden);
}

if(failed) process.exit(1);
ok('Corridas Safe2Pay: seleção, hold, cobrança, webhook e liberação pós-pagamento estão versionados e fail-closed.');
