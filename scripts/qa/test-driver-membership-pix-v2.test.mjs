import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MONTHLY_FEE_CENTS,verifyMembershipConfiguration,centsFromBRL,createAsaasPixForCharge,
 createMercadoPagoPixForCharge,verifyProviderBankResult,nextPaidThrough
} from '../../supabase/functions/_shared/apois-driver-membership-pix-v2.mjs';
const chargeId='11111111-1111-4111-8111-111111111111';
const driverId='22222222-2222-4222-8222-222222222222';
const mkCharge=(provider)=>({id:chargeId,driverId,amountCents:9990,status:'pending',provider,
 providerPaymentId:provider==='asaas'?'pay_verified123':'9999888777'});
const mkConfig=provider=>({provider,enabled:true,operatorApproved:true,feeCents:9990});
function fakeFetch(response,result){
 return async(url,opts)=>{
  fakeFetch.calls??=[];
  fakeFetch.calls.push({url,opts});
  return {ok:true,status:200,json:async()=>typeof result==='function'?result(url,opts):response};
 };
}
test('backend price and provider config are fail-closed by default',()=>{
 assert.equal(MONTHLY_FEE_CENTS,9990);
 assert.equal(centsFromBRL(99.9),9990);
 assert.equal(centsFromBRL(99.901),null);
 assert.throws(()=>verifyMembershipConfiguration({provider:'asaas',feeCents:5990,enabled:true,operatorApproved:true}),/fee/);
 assert.throws(()=>verifyMembershipConfiguration({provider:'asaas',feeCents:9990,enabled:false,operatorApproved:true}),/not_enabled/);
 assert.throws(()=>verifyMembershipConfiguration({provider:'asaas',feeCents:9990,enabled:true,operatorApproved:false}),/not_enabled/);
 assert.throws(()=>verifyMembershipConfiguration({provider:'other',feeCents:9990,enabled:true,operatorApproved:true}),/provider/);
});
test('Asaas 9990 Pix creation uses only provider API and validates charge reference/amount',async()=>{
 let calls=[];
 const request=async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.endsWith('pixQrCode')?
   {payload:'000201PIX-COPIA-E-COLA-APOIS-9990',encodedImage:'BASE64',expirationDate:'2026-12-23'}:
   {id:'pay_verified123',externalReference:chargeId,value:99.9}};
 };
 const a=await createAsaasPixForCharge({settings:mkConfig('asaas'),charge:mkCharge('asaas'),
  customerId:'cus_registered123',dueDate:'2026-12-23',
  accessToken:'sandbox-test-token-only',env:{ASAAS_API_BASE_URL:'https://api-sandbox.asaas.com/v3'},request});
 assert.equal(a.providerPaymentId,'pay_verified123');
 assert.equal(a.provider,'asaas');
 assert.equal(calls.length,2);
 assert.equal(calls[0].options.headers['X-Idempotency-Key'],'apois-membership-'+chargeId);
 const body=JSON.parse(calls[0].options.body);
 assert.equal(body.value,99.9);assert.equal(body.billingType,'PIX');
 assert.equal(body.externalReference,chargeId);
 assert.match(calls[1].url,/\/payments\/pay_verified123\/pixQrCode$/);
});
test('Asaas rejects unauthorized hosts and any amount/client mismatch before exposing Pix',async()=>{
 const args={settings:mkConfig('asaas'),charge:mkCharge('asaas'),customerId:'cus_registered123',
  dueDate:'2026-12-23',accessToken:'sandbox-test-token-only'};
 await assert.rejects(()=>createAsaasPixForCharge({...args,env:{ASAAS_API_BASE_URL:'http://evil.invalid/v3'},request:()=>{throw Error('network should not run')}}),/not_authorized/);
 await assert.rejects(()=>createAsaasPixForCharge({...args,charge:{...args.charge,amountCents:4990},env:{ASAAS_API_BASE_URL:'https://api-sandbox.asaas.com/v3'},request:()=>{throw Error('network should not run')}}),/amount/);
});
test('Mercado Pago 9990 Pix request sends idempotency key and no split',async()=>{
 let called;
 const request=async(url,options)=>{
  called={url,options};
  return {ok:true,json:async()=>({id:9999888777,external_reference:chargeId,
    transaction_amount:99.9,payment_method_id:'pix',
    point_of_interaction:{transaction_data:{qr_code:'000201MP-PAYLOAD-APOIS',qr_code_base64:'TESTBASE64'}}})};
 };
 const a=await createMercadoPagoPixForCharge({settings:mkConfig('mercadopago'),
  charge:mkCharge('mercadopago'),payerEmail:'teste@example.invalid',
  accessToken:'sandbox-mp-token-only',request});
 assert.equal(a.providerPaymentId,'9999888777');
 assert.equal(called.url,'https://api.mercadopago.com/v1/payments');
 assert.equal(called.options.headers['X-Idempotency-Key'],'apois-membership-'+chargeId);
 const body=JSON.parse(called.options.body);
 assert.equal(body.transaction_amount,99.9);
 assert.equal(body.payment_method_id,'pix');assert.equal(body.external_reference,chargeId);
 assert.ok(!('split' in body)&&!('fee' in body)&&!('application_fee' in body));
});
test('Bank verification rejects fake, wrong driver, wrong amount, wrong method and reversed payment',()=>{
 const charge=mkCharge('asaas');
 const good={id:charge.providerPaymentId,value:99.9,billingType:'PIX',status:'RECEIVED',externalReference:chargeId};
 assert.equal(verifyProviderBankResult({charge,providerResult:good}).driverId,driverId);
 for(const patch of [{id:'pay_fake'},{value:99.89},{billingType:'BOLETO'},{status:'PENDING'},{status:'REFUNDED'},{externalReference:driverId}]){
  assert.throws(()=>verifyProviderBankResult({charge,providerResult:{...good,...patch}}));
 }
 const mp=mkCharge('mercadopago');
 const mpgood={id:mp.providerPaymentId,transaction_amount:99.9,external_reference:chargeId,
  payment_method_id:'pix',status:'approved'};
 assert.equal(verifyProviderBankResult({charge:mp,providerResult:mpgood}).amountCents,9990);
 assert.throws(()=>verifyProviderBankResult({charge:mp,providerResult:{...mpgood,status:'pending'}}));
 assert.throws(()=>verifyProviderBankResult({charge:mp,providerResult:{...mpgood,status:'refunded'}}));
});
test('Early renewal preserves paid time and calendar-month edge',()=>{
 assert.equal(nextPaidThrough('2026-12-15T12:00:00.000Z','2026-11-23T12:00:00.000Z'),'2027-01-15T12:00:00.000Z');
 assert.equal(nextPaidThrough(null,'2026-01-31T10:00:00.000Z'),'2026-02-28T10:00:00.000Z');
 assert.throws(()=>nextPaidThrough(null,'garbage'));
});
