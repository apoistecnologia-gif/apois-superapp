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
 if(settings?.enabled!==true||settings?.operatorApproved!==true)
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
 if(!["pending","confirmed"].includes(charge.status))throw Error("membership_charge_not_open");
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
 if(charge.status!=="pending")throw Error("membership_charge_not_pending_for_creation");
 if(typeof accessToken!=="string"||accessToken.length<15)throw Error("asaas_secret_unavailable");
 if(!/^cus_[a-z0-9]+$/i.test(String(customerId??"")))throw Error("asaas_customer_not_registered");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate??"")))throw Error("invalid_due_date");
 const base=asaasBase(env);
 // Asaas documents that a timeout does NOT prove creation failed.
 // First reconcile by stable externalReference; never rely solely on an
 // idempotency header (not guaranteed to deduplicate all Asaas operations).
 const list=await jsonRequest(base+"/payments?externalReference="+
  encodeURIComponent(charge.id)+"&limit=20",{
   method:"GET",headers:{"access_token":accessToken,"User-Agent":"APOIS-Membership/2"},
 },request);
 if(!Array.isArray(list.data)||list.hasMore===true)
  throw Error("asaas_reference_reconciliation_inconclusive");
 const matches=list.data.filter(row=>row?.externalReference===charge.id);
 if(matches.length>1)throw Error("asaas_duplicate_reference_requires_reconciliation");
 const idempotencyKey="apois-membership-"+charge.id;
 const created=matches[0]??await jsonRequest(base+"/payments",{
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
 if(charge.status!=="pending")throw Error("membership_charge_not_pending_for_creation");
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
    ?["REFUNDED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE","REFUND_REQUESTED","PARTIALLY_REFUNDED","REFUND_IN_PROGRESS","RECEIVED_IN_CASH_UNDONE"].includes(providerResult?.status)
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


/**
 * Authenticate Asaas webhook before reading its JSON.
 * authToken is a distinct webhook secret, never an API key.
 */
export function authenticateAsaasWebhook(headers,authToken) {
 const received=String(headers?.get?.("asaas-access-token")??"");
 if(typeof authToken!=="string"||authToken.length<20||received.length!==authToken.length)
  return false;
 let difference=0;
 for(let i=0;i<authToken.length;i++)difference|=received.charCodeAt(i)^authToken.charCodeAt(i);
 return difference===0;
}
/**
 * WebCrypto HMAC for Mercado Pago notification Webhooks:
 * manifest id:[data.id];request-id:[x-request-id];ts:[ts];
 * data.id comes from URL, never accepted solely from an attacker-supplied JSON.
 * A valid signature is still NOT bank payment confirmation: GET provider
 * payment server-side + verifyProviderBankResult is mandatory.
 */
export async function authenticateMercadoPagoWebhook({headers,url,secret,now=Date.now()}) {
 if(typeof secret!=="string"||secret.length<20)return false;
 let input;
 try{input=new URL(url);}catch{return false;}
 const dataId=input.searchParams.get("data.id")??input.searchParams.get("data_id");
 if(!dataId||!/^\d+$/.test(dataId))return false;
 const rid=String(headers?.get?.("x-request-id")??"");
 if(!rid||rid.length>200)return false;
 const signature=String(headers?.get?.("x-signature")??"");
 const ts=/\bts=(\d{10,13})\b/.exec(signature)?.[1];
 const hex=/\bv1=([0-9a-f]{64})\b/i.exec(signature)?.[1]?.toLowerCase();
 if(!ts||!hex)return false;
 const numeric=Number(ts);
 const timestamp=ts.length>=13?numeric:numeric*1000;
 if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>300000)return false;
 const manifest=`id:${dataId};request-id:${rid};ts:${ts};`;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const calculated=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest)));
 const signatureBytes=Uint8Array.from(hex.match(/.{2}/g)??[],x=>Number.parseInt(x,16));
 if(calculated.length!==signatureBytes.length)return false;
 let diff=0;
 for(let i=0;i<calculated.length;i++)diff|=calculated[i]^signatureBytes[i];
 return diff===0;
}


/**
 * Query the bank directly. A webhook notification never carries trusted
 * amount, driver identity or approval status by itself.
 * The caller MUST compare this verified result with the locked database charge
 * and commit settlement through the private service-only RPC.
 */
export async function fetchVerifiedBankPaymentForCharge({
  charge, accessToken, env, request=fetch
}) {
  requireChargeIdentity(charge);
  if(typeof accessToken!=="string"||accessToken.length<15)
    throw Error("provider_access_token_unavailable");
  const id=String(charge.providerPaymentId??"");
  let url,headers;
  if(charge.provider==="asaas"){
    if(!/^pay_[a-z0-9_-]{3,80}$/i.test(id))
      throw Error("asaas_payment_identifier_invalid");
    url=asaasBase(env)+"/payments/"+encodeURIComponent(id);
    headers={"access_token":accessToken,"User-Agent":"APOIS-Membership/2"};
  }else if(charge.provider==="mercadopago"){
    if(!/^[1-9][0-9]{4,30}$/.test(id))
      throw Error("mp_payment_identifier_invalid");
    url="https://api.mercadopago.com/v1/payments/"+encodeURIComponent(id);
    headers={"Authorization":"Bearer "+accessToken};
  }else{
    throw Error("membership_provider_not_configured");
  }
  const bank=await jsonRequest(url,{method:"GET",headers},request);
  const verified=verifyProviderBankResult({charge,providerResult:bank});
  const bankReported=charge.provider==="asaas"
    ?bank.paymentDate??bank.confirmedDate??bank.clientPaymentDate
    :bank.date_approved;
  const parsed=typeof bankReported==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(bankReported)
    ?new Date(bankReported+"T12:00:00-03:00")
    :new Date(bankReported??"");
  const bankConfirmedAt=Number.isFinite(parsed.getTime())&&
    parsed.getTime()<=Date.now()+300000?parsed.toISOString():new Date().toISOString();
  return Object.freeze({ ...verified, bankStatus: "confirmed",bankConfirmedAt });
}
