// APOIS_DRIVER_MEMBERSHIP_STATUS_V2 — STAGED, NOT DEPLOYED.
// Read-only, own-driver status. Depends on staged 20261123 Pix migrations.
// Never returns API/webhook keys. No payment is created by GET.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
 "Access-Control-Allow-Methods":"GET,OPTIONS",
 "Cache-Control":"no-store",
};
const respond=(payload:unknown,code=200)=>new Response(JSON.stringify(payload),{
 status:code,headers:{...cors,"Content-Type":"application/json"}
});
function service(){
 const url=Deno.env.get("SUPABASE_URL")??"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url.startsWith("https://")||key.length<20)throw Error("backend_not_configured");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return respond({ok:false,error:"method_not_allowed"},405);
 const authorization=req.headers.get("authorization")??"";
 const token=/^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
 if(!token)return respond({ok:false,error:"unauthorized"},401);
 try{
  const admin=service();
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth.user)return respond({ok:false,error:"unauthorized"},401);
  const {data:profile,error:profileError}=await admin.from("users")
   .select("id").eq("auth_user_id",auth.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)return respond({ok:false,error:"driver_profile_missing"},404);
  const {data:driver,error:driverError}=await admin.from("drivers")
   .select("id,approval_status,subscription_status,blocked_at,suspended_at,documents_status")
   .eq("user_id",profile.id).maybeSingle();
  if(driverError)throw driverError;
  if(!driver)return respond({ok:false,error:"driver_account_missing"},404);
  const [memberResult,chargeResult,priceResult,enableResult]=await Promise.all([
   admin.from("driver_memberships")
    .select("provider,status,monthly_fee_cents,paid_through,next_due_date,last_payment_at")
    .eq("driver_id",driver.id).maybeSingle(),
   admin.from("driver_membership_charges")
    .select("id,provider,amount_cents,status,due_date,paid_at,pix_payload,pix_qr_code_base64,pix_expiration_at")
    .eq("driver_id",driver.id).order("created_at",{ascending:false}).limit(15),
   admin.from("app_settings").select("value")
    .eq("key","finance.driver_monthly_fee_cents").maybeSingle(),
   admin.from("app_settings").select("value")
    .eq("key","finance.driver_membership_pix_enabled").maybeSingle(),
  ]);
  if(memberResult.error)throw memberResult.error;
  if(chargeResult.error)throw chargeResult.error;
  if(priceResult.error)throw priceResult.error;
  if(enableResult.error)throw enableResult.error;
  const member=memberResult.data;
  const now=Date.now();
  const paidThrough=member?.paid_through?Date.parse(member.paid_through):NaN;
  const verifiedActive=member?.status==="active"&&
   Number.isFinite(paidThrough)&&paidThrough>now;
  const approved=driver.approval_status==="aprovado"&&
   !driver.blocked_at&&!driver.suspended_at;
  const listed=(chargeResult.data??[]).map(c=>({
   id:c.id,provider:c.provider,amountCents:Number(c.amount_cents),
   status:c.status,dueDate:c.due_date,paidAt:c.paid_at,
   pixPayload:c.pix_payload??null,
   pixQrCodeBase64:c.pix_qr_code_base64??null,
   pixExpirationAt:c.pix_expiration_at??null,
  }));
  return respond({
   ok:true,approved,documentsStatus:driver.documents_status,
   operationalByVerifiedMembership:approved&&verifiedActive,
   homologationOnly:driver.subscription_status==="teste"&&!verifiedActive,
   membership:member?{
    provider:member.provider,status:member.status,
    contractualFeeCents:Number(member.monthly_fee_cents),
    paidThrough:member.paid_through,nextDueDate:member.next_due_date,
    lastPaymentAt:member.last_payment_at,
   }:null,
   futureFeeCents:priceResult.data?.value??null,
   pixEnabled:enableResult.data?.value===true,
   charges:listed,
  });
 }catch(e){
  console.error("[APOIS Membership Status v2] failed",e instanceof Error?e.name:"unknown");
  return respond({ok:false,error:"service_unavailable"},503);
 }
});
