import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const ok=(m)=>console.log('[OK] '+m);
const read=(p)=>{const full=resolve(p);if(!existsSync(full)){fail('arquivo ausente: '+p);return ''}return readFileSync(full,'utf8')};

const rideService=read('.work/corridas/src/services/payments/payment-service.ts');
if(rideService){
  for(const marker of [
    'VITE_APOIS_SAFE2PAY_PIX_ENABLED',
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'const isSafe2PayPix = code === "pix" && safe2PayPixEnabled;',
    'PIX processado pela Safe2Pay',
  ]) if(!rideService.includes(marker)) fail('Corridas: política Safe2Pay/direct ausente ('+marker+')');
  if(!failed) ok('Corridas: dinheiro/crédito diretos e PIX Safe2Pay controlado por flag explícita');
}

const checkout=read('.work/entregas/src/routes/checkout.tsx');
if(checkout){
  for(const marker of [
    'const paymentMethod = "pix";',
    '"safe2pay-create-order-pix"',
    '"safe2pay-payment-status"',
    'configuredProvider = "safe2pay_marketplace"',
  ]) if(!checkout.includes(marker)) fail('Entregas: checkout Safe2Pay incompleto ('+marker+')');
  for(const forbidden of [
    'merchant-payment-readiness',
    'create-merchant-mercadopago-pix',
    'create-asaas-pix-charge',
    'create-pix-charge',
    'openpix-payout',
    'sync-payment-status',
    'mercadopago.com/v2/security.js',
  ]) if(checkout.includes(forbidden)) fail('Entregas: provider antigo permaneceu ('+forbidden+')');
}

const createOrder=read('.work/entregas/supabase/functions/create-order/index.ts');
if(createOrder){
  if(!createOrder.includes('const PAYMENT_METHODS = new Set(["pix"]);')) fail('Entregas: create-order não restringe checkout a PIX');
  if(createOrder.includes('payment_status: "paid"')||createOrder.includes("payment_status: 'paid'")) fail('Entregas: create-order não pode fabricar paid');
}

const merchantControl=read('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
if(merchantControl){
  if(!merchantControl.includes('return status === "paid";')) fail('Entregas: merchant deve aguardar confirmação de pagamento');
  if(merchantControl.includes('method === "cash" && status === "pending"')) fail('Entregas: cash/pending ainda tratado como pronto');
}

const retiredMerchantMpHardener=read('scripts/harden-entregas-merchant-mercadopago-v2.mjs');
if(retiredMerchantMpHardener){
  if(!retiredMerchantMpHardener.includes('RETIRED PROVIDER GUARD')) fail('Entregas: hardener Mercado Pago legado deixou de ser sentinela');
  for(const forbidden of [
    'supabase.functions.invoke("merchant-mercadopago-oauth"',
    'supabase.functions.invoke("create-merchant-mercadopago-pix"',
    'export function MerchantMercadoPagoConnection',
  ]) if(retiredMerchantMpHardener.includes(forbidden)) fail('Entregas: hardener legado ainda contém implementação ativa ('+forbidden+')');
}

const providerPolicy=JSON.parse(read('docs/payment-provider-policy.json')||'{}');
if(providerPolicy.provider!=='safe2pay') fail('Safe2Pay não é o provider eletrônico oficial');
if(providerPolicy.products?.corridas?.platformCommissionPercent!==0) fail('Corridas: comissão por corrida deve permanecer 0%');
if(providerPolicy.products?.entregas?.platformCommissionPercent!==0) fail('Entregas: comissão por pedido deve permanecer 0%');

const motorBuild=read('scripts/build-motorista-module.mjs');
if(!motorBuild.includes('harden-motorista-payment-wait.mjs')) fail('Motorista: build não reconhece aguardando pagamento');
if(motorBuild.includes('harden-motorista-superapp-mercadopago.mjs')||motorBuild.includes('auth/mercadopago')) fail('Motorista: build reativou Mercado Pago');
const motorWait=read('scripts/harden-motorista-payment-wait.mjs');
if(!motorWait.includes('Safe2Pay')||!motorWait.includes('aguardando_pagamento')) fail('Motorista: estado de espera Safe2Pay ausente');

if(failed) process.exit(1);
ok('Política financeira final: Safe2Pay único provider eletrônico alvo, providers legados fora dos fluxos ativos e confirmação server-authoritative.');
