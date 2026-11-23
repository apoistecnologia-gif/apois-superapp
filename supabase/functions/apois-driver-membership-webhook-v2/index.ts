// APOIS_DRIVER_MEMBERSHIP_WEBHOOK_V2 — STAGED ONLY, NOT DEPLOYED.
// Deploy with verify_jwt=false ONLY on this endpoint, after staging
// migrations + operator approval. Each bank requires its OWN webhook
// authentication secret. A notification alone NEVER activates a driver.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {authenticateAsaasWebhook,authenticateMercadoPagoWebhook,
 fetchVerifiedBankPaymentForCharge} from "../_shared/apois-driver-membership-pix-v2.mjs";

const respond=(payload:unknown,code=200)=>new Response(JSON.stringify(payload),{
 status:code,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
function service(){
 const url=Deno.env.get("SUPABASE_URL")??"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url.startsWith("https://")||key.length<20)throw Error("backend_not_configured");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function providerSecrets(provider:string){
 if(provider==="asaas"){
  const accessToken=Deno.env.get("ASAAS_API_KEY")??"";
  const base=Deno.env.get("ASAAS_API_BASE_URL")??"";
  if(accessToken.length<15||
   !["https://api-sandbox.asaas.com/v3","https://api.asaas.com/v3"].includes(base))
   throw Error("asaas_not_configured");
  return {accessToken,env:{ASAAS_API_BASE_URL:base}};
 }
 if(provider==="mercadopago"){
  const accessToken=Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")??"";
  if(accessToken.length<15)throw Error("mp_not_configured");
  return {accessToken,env:{}};
 }
 throw Error("unsupported_payment_provider");
}
function eventKind(value:unknown){
 return typeof value==="string"?value.slice(0,100):"";
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return respond({ok:false,error:"method_not_allowed"},405);
 const url=new URL(req.url);
 const provider=url.searchParams.get("provider");
 if(provider!=="asaas"&&provider!=="mercadopago")
  return respond({ok:false,error:"provider_missing"},400);
 try{
  // Authenticate BEFORE deserializing provider data or touching the database.
  if(provider==="asaas"){
   const secret=Deno.env.get("ASAAS_MEMBERSHIP_WEBHOOK_AUTH_TOKEN")??"";
   if(!authenticateAsaasWebhook(req.headers,secret))
    return respond({ok:false,error:"unauthorized"},401);
  }else{
   const secret=Deno.env.get("MERCADOPAGO_MEMBERSHIP_WEBHOOK_SECRET")??"";
   const verified=await authenticateMercadoPagoWebhook({
    headers:req.headers,url:req.url,secret
   });
   if(!verified)return respond({ok:false,error:"unauthorized"},401);
  }
  const bodyText=await req.text();
  if(bodyText.length>32000)return respond({ok:false,error:"payload_too_large"},413);
  let body:any;
  try{body=JSON.parse(bodyText);}catch{return respond({ok:false,error:"invalid_json"},400);}
  const paymentId=provider==="asaas"
   ?String(body?.payment?.id??"")
   :String(url.searchParams.get("data.id")??url.searchParams.get("data_id")??"");
  const kind=provider==="asaas"?eventKind(body?.event)
   :eventKind(body?.type??body?.action);
  const eventId=provider==="asaas"?String(body?.id??"")
   :String(body?.id??req.headers.get("x-request-id")??"");
  if(!/^[a-z0-9_-]{4,160}$/i.test(eventId))
   return respond({ok:false,error:"event_id_invalid"},400);
  if(provider==="asaas"&&!/^pay_[a-z0-9_-]{3,80}$/i.test(paymentId))
   return respond({ok:false,error:"payment_id_invalid"},400);
  if(provider==="mercadopago"&&!/^[1-9][0-9]{4,30}$/.test(paymentId))
   return respond({ok:false,error:"payment_id_invalid"},400);
  const isReversal=provider==="asaas"
   ?/^PAYMENT_(REFUNDED|PARTIALLY_REFUNDED|REFUND_IN_PROGRESS|CHARGEBACK|RECEIVED_IN_CASH_UNDONE)/.test(kind)
   :/refund|chargeback|charged_back/i.test(kind);
  const isPaymentEvent=provider==="asaas"
   ?["PAYMENT_CONFIRMED","PAYMENT_RECEIVED"].includes(kind)
   :["payment","payment.updated","payment.created"].includes(kind);
  if(!isPaymentEvent&&!isReversal)return respond({ok:true,ignored:true});
  const admin=service();
  const {data:charge,error:chargeError}=await admin
   .from("driver_membership_charges")
   .select("id,driver_id,provider,provider_payment_id,amount_cents,status")
   .eq("provider",provider).eq("provider_payment_id",paymentId).maybeSingle();
  if(chargeError)throw chargeError;
  if(!charge){
   // Early provider callback before checkout saves the bank payment id.
   // Return 503 so bank retries AFTER the charge reference is persisted.
   return respond({ok:false,error:"charge_not_yet_reconciled"},503);
  }
  if(charge.status==="received"&&!isReversal)
   return respond({ok:true,duplicate:true});
  const credentials=providerSecrets(provider);
  const bankCharge={
   id:charge.id,driverId:charge.driver_id,
   provider:charge.provider,providerPaymentId:charge.provider_payment_id,
   amountCents:Number(charge.amount_cents),status:charge.status
  };
  let verified;
  try{
   verified=await fetchVerifiedBankPaymentForCharge({
    charge:bankCharge,accessToken:credentials.accessToken,
    env:credentials.env
   });
  }catch(e){
   const reason=e instanceof Error?e.message:"bank_verification_failed";
   if(reason==="payment_reversal_requires_review"&&isReversal){
    // Preserve all historical settlements, require an explicit refund policy
    // before changing driver entitlement; record a minimal auditable event.
    const eventKey=provider+":membership:refund:"+eventId;
    const {error:auditError}=await admin.from("payment_webhook_receipts")
     .upsert({provider,event_key:eventKey,status:"refund_review",
      detail:"Verified bank reversal; administrative policy required",
      raw_payload:{eventKind:kind,providerPaymentId:paymentId,chargeId:charge.id},
      processed_at:new Date().toISOString()},{onConflict:"event_key"});
    if(auditError)throw auditError;
    return respond({ok:true,requiresRefundReview:true});
   }
   if(reason==="bank_payment_not_confirmed")
    return respond({ok:true,pending:true});
   throw e;
  }
  if(isReversal)return respond({ok:true,ignored:true});
  const {data:settled,error:settleError}=await admin.rpc(
   "apois_apply_verified_driver_membership_pix_v2",{
    _charge_id:verified.chargeId,
    _provider:verified.provider,
    _payment_id:verified.providerPaymentId,
    _external_reference:verified.chargeId,
    _verified_amount_cents:verified.amountCents,
    _bank_status:verified.bankStatus,
    _event_key:eventId,
    _bank_confirmed_at:verified.bankConfirmedAt,
   });
  if(settleError)throw settleError;
  if(!Array.isArray(settled)||!settled.length)throw Error("settlement_missing");
  return respond({ok:true,duplicate:settled[0].was_duplicate===true});
 }catch(e){
  // No bank identifiers, PII, bearer tokens or raw payloads in logs.
  console.error("[APOIS Membership Webhook v2] verification/settlement blocked",
   e instanceof Error?e.name:"unknown");
  return respond({ok:false,error:"webhook_reconciliation_pending"},503);
 }
});
