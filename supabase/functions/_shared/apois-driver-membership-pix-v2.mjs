/**
 * APOIS_DRIVER_MEMBERSHIP_PIX_V2 — STAGED ONLY, NOT DEPLOYED.
 * Server-side adapter for one-off monthly Pix to APOIS, never ride fares.
 * DO NOT enable without:
 *   1. staged SQL/membership RPC and paid_through gate applied with approval,
 *   2. original merchant credentials securely provisioned,
 *   3. authenticated webhook + reconciliation deployed and sandbox E2E,
 *   4. explicit enable flag in the server config.
 * Never import into browser; do not log access tokens, CPF, payer email or QR.
 */
export const MONTHLY_FEE_CENTS = 9990;
export const VALID_PROVIDERS = Object.freeze(["asaas","mercadopago"]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function centsFromBRL(value) {
 if(typeof value!=="number"||!Number.isFinite(value)||value<0)return null;
 const x=Math.round(value*100);
 return Math.abs(value*100-x)<=1e-6?x:null;
}
export function verifyMembershipConfiguration(settings) {
 const cents=Number(settings?.feeCents);
 const provider=String(settings?.provider??"none");
 if(!Number.isSafeInteger(cents)||cents!==MONTHLY_FEE_CENTS)
  throw Error("membership_fee_backend_not_9990");
 if(!settings?.enabled||!settings?.operatorApproved)
  throw Error("membership_pix_not_enabled");
 if(!VALID_PROVIDERS.includes(provider))
  throw Error("membership_provider_not_configured");
 return Object.freeze({cents,provider});
}
function requireChargeIdentity(charge) {
 if(!UUID.test(String(charge?.id??""))||!UUID.test(String(charge?.driverId??"")))
  throw Error("invalid_membership_charge_identity");
 if(charge.amountCents!==MONTHLY_FEE_CENTS)throw Error("wrong_backend_membership_amount");
 if(!VALID_PROVIDERS.includes(charge.provider))throw Error("wrong_membership_provider");
 if(charge.status!=="pending")throw Error("membership_charge_not_pending");
 return charge;
}
async function jsonRequest(url,options,request){
 const response=await request(url,options);
 if(!response?.ok)throw Error("membership_pix_provider_http_"+String(response?.status||0));
 const obj=await response.json();
 if(!obj||typeof obj!=="object")throw Error("invalid_payment_provider_response");
 return obj;
}
function asaasBase(env) {
 const url=String(env?.ASAAS_API_BASE_URL??"");
 if(!["https://api-sandbox.asaas.com/v3","https://api.asaas.com/v3"].includes(url))
  throw Error("asaas_api_host_not_authorized");
 return url;
}
export async function createAsaasPixForCharge({settings,charge,customerId,dueDate,accessToken,env,request=fetch}){
 const config=verifyMembershipConfiguration(settings);
 if(config.provider!=="asaas")throw Error("provider_selection_mismatch");
 requireChargeIdentity(charge);
 if(typeof accessToken!=="string"||accessToken.length<15)throw Error("asaas_secret_unavailable");
 if(!/^cus_[a-z0-9]+$/i.test(String(customerId??"")))throw Error("asaas_customer_not_registered");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate??"")))throw Error("invalid_due_date");
 const base=asaasBase(env);
 const idempotencyKey="apois-membership-"+charge.id;
 const created=await jsonRequest(base+"/payments",{
  method:"POST",
  headers:{"Content-Type":"application/json","access_token":accessToken,
    "User-Agent":"APOIS-Membership/2","X-Idempotency-Key":idempotencyKey},
  body:JSON.stringify({customer:customerId,billingType:"PIX",value:99.90,
    dueDate,description:"APOIS Motorista - mensalidade",externalReference:charge.id}),
 },request);
 if(!String(created?.id??"").startsWith("pay_")||
   created.externalReference!==charge.id ||
   centsFromBRL(created.value)!==MONTHLY_FEE_CENTS)
   throw Error("asaas_charge_response_identity_mismatch");
 const qr=await jsonRequest(base+"/payments/"+encodeURIComponent(created.id)+"/pixQrCode",{
  method:"GET",headers:{"access_token":accessToken,"User-Agent":"APOIS-Membership/2"},
 },request);
 if(typeof qr.payload!=="string"||qr.payload.length<20)
  throw Error("asaas_pix_code_missing");
 return {provider:"asaas",providerPaymentId:created.id,pixPayload:qr.payload,
  qrCodeBase64:typeof qr.encodedImage==="string"?qr.encodedImage:null,
  expiresAt:qr.expirationDate??null};
}
export async function createMercadoPagoPixForCharge({settings,charge,payerEmail,accessToken,request=fetch}){
 const config=verifyMembershipConfiguration(settings);
 if(config.provider!=="mercadopago")throw Error("provider_selection_mismatch");
 requireChargeIdentity(charge);
 if(typeof accessToken!=="string"||accessToken.length<15)throw Error("mp_secret_unavailable");
 if(typeof payerEmail!=="string"||!/^.+@[^@]+\.[^@]+$/.test(payerEmail))throw Error("payer_email_required");
 const data=await jsonRequest("https://api.mercadopago.com/v1/payments",{
  method:"POST",
  headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken,
    "X-Idempotency-Key":"apois-membership-"+charge.id},
  body:JSON.stringify({transaction_amount:99.90,description:"APOIS Motorista - mensalidade",
    payment_method_id:"pix",payer:{email:payerEmail},external_reference:charge.id}),
 },request);
 const qr=data?.point_of_interaction?.transaction_data;
 if(!/^\d+$/.test(String(data?.id??""))||String(data?.external_reference??"")!==charge.id||
   centsFromBRL(data.transaction_amount)!==MONTHLY_FEE_CENTS||
   data.payment_method_id!=="pix"||typeof qr?.qr_code!=="string")
  throw Error("mp_pix_response_identity_mismatch");
 return {provider:"mercadopago",providerPaymentId:String(data.id),pixPayload:qr.qr_code,
  qrCodeBase64:qr.qr_code_base64??null,expiresAt:data.date_of_expiration??null};
}
export function verifyProviderBankResult({charge,providerResult}) {
 requireChargeIdentity(charge);
 if(String(providerResult?.id??"")!==String(charge.providerPaymentId??""))
  throw Error("foreign_membership_payment");
 const resultAmount=charge.provider==="asaas"?providerResult?.value:providerResult?.transaction_amount;
 if(centsFromBRL(resultAmount)!==MONTHLY_FEE_CENTS)throw Error("paid_amount_mismatch");
 const reference=charge.provider==="asaas"?providerResult?.externalReference:providerResult?.external_reference;
 if(reference!==charge.id)throw Error("external_reference_mismatch");
 const method=charge.provider==="asaas"?providerResult?.billingType:providerResult?.payment_method_id;
 if(String(method).toLowerCase()!=="pix")throw Error("payment_not_pix");
 const approved=charge.provider==="asaas"
    ?["RECEIVED","CONFIRMED"].includes(providerResult?.status)
    :providerResult?.status==="approved";
 const reversed=charge.provider==="asaas"
    ?["REFUNDED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE","REFUND_REQUESTED"].includes(providerResult?.status)
    :["refunded","charged_back"].includes(providerResult?.status);
 if(reversed)throw Error("payment_reversal_requires_review");
 if(!approved)throw Error("bank_payment_not_confirmed");
 return {chargeId:charge.id,driverId:charge.driverId,provider:charge.provider,
         providerPaymentId:charge.providerPaymentId,amountCents:MONTHLY_FEE_CENTS};
}
export function nextPaidThrough(paidThrough,confirmedAt) {
 const date=new Date(confirmedAt);
 if(!Number.isFinite(date.getTime()))throw Error("invalid_paid_timestamp");
 const current=paidThrough?new Date(paidThrough):new Date(0);
 const base=current.getTime()>date.getTime()?current:date;
 const result=new Date(base.getTime());
 const desiredMonth=result.getUTCMonth()+1;
 const previousDay=result.getUTCDate();
 result.setUTCDate(1);
 result.setUTCMonth(desiredMonth);
 const days=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();
 result.setUTCDate(Math.min(previousDay,days));
 return result.toISOString();
}
