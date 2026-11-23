// APOIS_DRIVER_MEMBERSHIP_CHECKOUT_V2 — STAGED ONLY, NOT DEPLOYED.
// New driver membership Pix: R$99.90, ONE approved driver, ONE pending charge.
// Requires explicit server operator approval + bank credentials + staged SQL.
// No price/provider/driver ID accepted from the browser; no ride split.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {verifyMembershipConfiguration,createAsaasPixForCharge,
 createMercadoPagoPixForCharge} from "../_shared/apois-driver-membership-pix-v2.mjs";

const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Cache-Control":"no-store"
};
const respond=(payload:unknown,code=200)=>new Response(JSON.stringify(payload),{
 status:code,headers:{...cors,"Content-Type":"application/json"}
});
type DB=ReturnType<typeof createClient>;
function service(){
 const url=Deno.env.get("SUPABASE_URL")??"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url.startsWith("https://")||key.length<20)throw Error("backend_not_configured");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function readSettings(admin:DB){
 const keys=["finance.driver_monthly_fee_cents","finance.driver_membership_pix_enabled",
  "finance.driver_membership_provider"];
 const {data,error}=await admin.from("app_settings").select("key,value").in("key",keys);
 if(error)throw error;
 const settings=Object.fromEntries((data??[]).map(row=>[row.key,row.value]));
 return verifyMembershipConfiguration({
  feeCents:settings["finance.driver_monthly_fee_cents"],
  enabled:settings["finance.driver_membership_pix_enabled"]===true,
  provider:settings["finance.driver_membership_provider"],
  operatorApproved:Deno.env.get("APOIS_PIX_OPERATOR_APPROVED")==="true"
 });
}
async function asaasCustomer(driver:{id:string,name:string|null,cpf:string|null,email:string|null},
 existingId:string|null,token:string,base:string){
 if(existingId&&/^cus_[a-z0-9]+$/i.test(existingId))return existingId;
 if(!/^\d{11}$/.test((driver.cpf??"").replace(/\D/g,""))||
    !driver.name?.trim())throw Error("approved_driver_identification_incomplete");
 // Bank reconciled before create: Asaas customer creation is NOT assumed idempotent.
 const headers={"access_token":token,"User-Agent":"APOIS-Membership/2"};
 const resp=await fetch(base+"/customers?externalReference="+encodeURIComponent(driver.id)+"&limit=20",{
  method:"GET",headers
 });
 if(!resp.ok)throw Error("asaas_customer_lookup_unavailable");
 const list=await resp.json();
 if(!Array.isArray(list.data)||list.hasMore===true)
  throw Error("asaas_customer_lookup_inconclusive");
 const matched=list.data.filter((item:any)=>item?.externalReference===driver.id);
 if(matched.length>1)throw Error("asaas_customer_duplicate_reference");
 if(matched.length===1){
  if(!/^cus_[a-z0-9]+$/i.test(String(matched[0].id)))throw Error("asaas_customer_bad_identity");
  return String(matched[0].id);
 }
 const created=await fetch(base+"/customers",{
  method:"POST",headers:{...headers,"Content-Type":"application/json"},
  body:JSON.stringify({
   name:driver.name,cpfCnpj:(driver.cpf??"").replace(/\D/g,""),
   email:driver.email??undefined,externalReference:driver.id,
   notificationDisabled:true
  })
 });
 if(!created.ok)throw Error("asaas_customer_creation_failed");
 const customer=await created.json();
 if(!/^cus_[a-z0-9]+$/i.test(String(customer.id))||
    customer.externalReference!==driver.id)throw Error("asaas_customer_response_mismatch");
 return String(customer.id);
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({ok:false,error:"method_not_allowed"},405);
 const token=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")??"")?.[1];
 if(!token)return respond({ok:false,error:"unauthorized"},401);
 try{
  const admin=service();
  const config=await readSettings(admin); // fails closed BEFORE any financial write
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth.user)return respond({ok:false,error:"unauthorized"},401);
  const {data:profile,error:profileError}=await admin.from("users")
   .select("id").eq("auth_user_id",auth.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)return respond({ok:false,error:"driver_profile_missing"},403);
  const {data:driver,error:driverError}=await admin.from("drivers")
   .select("id,name,cpf,email,approval_status,blocked_at,suspended_at")
   .eq("user_id",profile.id).maybeSingle();
  if(driverError)throw driverError;
  if(!driver||driver.approval_status!=="aprovado"||driver.blocked_at||driver.suspended_at)
   return respond({ok:false,error:"driver_not_approved"},403);
  const {data:previousCharges,error:pendingError}=await admin
   .from("driver_membership_charges")
   .select("id,provider,provider_payment_id,amount_cents,status,due_date,pix_payload,pix_expiration_at,pix_qr_code_base64")
   .eq("driver_id",driver.id).in("status",["pending","confirmed"])
   .order("created_at",{ascending:false}).limit(2);
  if(pendingError)throw pendingError;
  if((previousCharges??[]).length>1)
   return respond({ok:false,error:"multiple_open_charges_need_reconciliation"},409);
  if(previousCharges?.length){
   const c=previousCharges[0];
   // Existing pending charges retain ORIGINAL bank and amount after switching
   // providers. Never create a replacement until reconciliation is complete.
   return respond({ok:true,pendingGeneration:!c.pix_payload,
    chargeId:c.id,provider:c.provider,amountCents:Number(c.amount_cents),
    pixPayload:c.pix_payload??null,pixQrCodeBase64:c.pix_qr_code_base64??null,
    pixExpirationAt:c.pix_expiration_at??null});
  }

  let {data:membership,error:membershipError}=await admin.from("driver_memberships")
   .select("driver_id,provider,provider_customer_id,monthly_fee_cents,status,paid_through")
   .eq("driver_id",driver.id).maybeSingle();
  if(membershipError)throw membershipError;
  if(!membership){
   const result=await admin.from("driver_memberships").insert({
    driver_id:driver.id,provider:config.provider,monthly_fee_cents:9990,status:"pending"
   }).select("driver_id,provider,provider_customer_id,monthly_fee_cents,status,paid_through").single();
   if(result.error){
    if(result.error.code!=="23505")throw result.error;
    const after=await admin.from("driver_memberships")
     .select("driver_id,provider,provider_customer_id,monthly_fee_cents,status,paid_through")
     .eq("driver_id",driver.id).single();
    if(after.error)throw after.error;
    membership=after.data;
   }else membership=result.data;
  }
  if(!membership||Number(membership.monthly_fee_cents)!==9990)
   return respond({ok:false,error:"legacy_contract_requires_manual_review"},409);
  if(membership.provider!==config.provider){
   // No open charge existed above; changing default provider does not rewrite
   // historical charge rows, which carry their own provider.
   const changed=await admin.from("driver_memberships")
    .update({provider:config.provider,provider_customer_id:null,updated_at:new Date().toISOString()})
    .eq("driver_id",driver.id).select("driver_id").single();
   if(changed.error)throw changed.error;
   membership={...membership,provider:config.provider,provider_customer_id:null};
  }

  const id=crypto.randomUUID();
  const reservation="reservation:"+id;
  const due=new Date(Date.now()+24*3600_000).toISOString().slice(0,10);
  const inserted=await admin.from("driver_membership_charges").insert({
   id,driver_id:driver.id,provider:config.provider,
   provider_payment_id:reservation,amount_cents:9990,due_date:due,status:"pending"
  }).select("id,driver_id,provider,amount_cents,status").single();
  if(inserted.error){
   if(inserted.error.code==="23505")
    return respond({ok:false,error:"another_checkout_in_progress"},409);
   throw inserted.error;
  }
  const charge={id,driverId:driver.id,provider:config.provider,
   amountCents:9990,status:"pending"};
  let pix;
  if(config.provider==="asaas"){
   const accessToken=Deno.env.get("ASAAS_API_KEY")??"";
   const base=Deno.env.get("ASAAS_API_BASE_URL")??"";
   if(!["https://api-sandbox.asaas.com/v3","https://api.asaas.com/v3"].includes(base))
    throw Error("asaas_provider_unconfigured");
   if(accessToken.length<15)throw Error("asaas_secret_missing");
   const customerId=await asaasCustomer(driver,membership.provider_customer_id,
    accessToken,base);
   if(customerId!==membership.provider_customer_id){
    const updated=await admin.from("driver_memberships")
     .update({provider_customer_id:customerId,updated_at:new Date().toISOString()})
     .eq("driver_id",driver.id);
    if(updated.error)throw updated.error;
   }
   pix=await createAsaasPixForCharge({settings:{feeCents:config.cents,
     enabled:true,operatorApproved:true,provider:"asaas"},
    charge,customerId,dueDate:due,accessToken,
    env:{ASAAS_API_BASE_URL:base}});
  }else{
   const accessToken=Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")??"";
   pix=await createMercadoPagoPixForCharge({settings:{feeCents:config.cents,
     enabled:true,operatorApproved:true,provider:"mercadopago"},
    charge,payerEmail:driver.email??auth.user.email,accessToken});
  }
  const {data:stored,error:storeError}=await admin.from("driver_membership_charges")
   .update({provider_payment_id:pix.providerPaymentId,pix_payload:pix.pixPayload,
    pix_qr_code_base64:pix.qrCodeBase64??null,pix_expiration_at:pix.expiresAt??null,
    updated_at:new Date().toISOString()})
   .eq("id",id).eq("provider_payment_id",reservation).eq("status","pending")
   .select("id").maybeSingle();
  if(storeError||!stored)throw Error("payment_created_but_local_store_unconfirmed");
  return respond({ok:true,amountCents:9990,provider:config.provider,
   chargeId:id,paymentId:pix.providerPaymentId,pixPayload:pix.pixPayload,
   pixQrCodeBase64:pix.qrCodeBase64??null,pixExpirationAt:pix.expiresAt??null});
 }catch(e){
  const name=e instanceof Error?e.message:"unavailable";
  // On inconclusive upstream failure leave reservation to be reconciled,
  // DO NOT retry creating a bank charge or mark the contract as paid.
  console.error("[APOIS Membership Checkout v2] blocked",name.replace(/(token|secret)[^ ]*/ig,"[protected]"));
  const disabled=/not_enabled|not_configured|not_9990|backend_not_configured/.test(name);
  return respond({ok:false,error:disabled?"membership_billing_not_active":"checkout_not_completed",
   pendingGeneration:!disabled},disabled?503:409);
 }
});
