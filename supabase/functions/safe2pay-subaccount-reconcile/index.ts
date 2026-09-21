import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import { getSafe2PaySubaccount } from "../_shared/safe2pay.ts";

const H={"content-type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const j=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:H});
const U=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return j(405,{error:"method_not_allowed"});
 const product=(Deno.env.get("SAFE2PAY_ONBOARDING_PRODUCT")??"").toLowerCase();
 if(!["rides","orders"].includes(product))return j(500,{error:"onboarding_product_not_configured"});
 const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",srv=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
 if(!url||!anon||!srv||!token)return j(401,{error:"unauthorized"});
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,srv,{auth:{persistSession:false,autoRefreshToken:false}});
 const au=await auth.auth.getUser(token); if(au.error||!au.data.user)return j(401,{error:"unauthorized"});
 const uid=au.data.user.id;
 let ok=false;
 if(product==="rides"){
   const du=await admin.from("users").select("id").eq("auth_user_id",uid).maybeSingle();
   const ids=[uid,du.data?.id].filter(Boolean) as string[];
   const rr=await admin.from("user_roles").select("role").in("user_id",ids).in("role",["admin","super_admin"]).limit(1);
   ok=Boolean(rr.data?.length);
 }else{
   const rr=await admin.from("user_roles").select("role").eq("user_id",uid).in("role",["admin","super_admin"]).limit(1);
   ok=Boolean(rr.data?.length);
 }
 if(!ok)return j(403,{error:"forbidden"});
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const target=String(body.target_id??""), receiver=Number(body.receiver_id);
 if(!U.test(target)||!Number.isInteger(receiver)||receiver<=0)return j(400,{error:"invalid_request"});
 try{
   await getSafe2PaySubaccount(receiver);
   const acct=product==="rides"?"driver_safe2pay_accounts":"merchant_safe2pay_accounts";
   const key=product==="rides"?"driver_id":"merchant_id";
   const res=await admin.from(acct).upsert({[key]:target,safe2pay_receiver_id:receiver,status:"active",environment:"production",provider_created_at:new Date().toISOString(),last_error_code:null},{onConflict:key}).select("safe2pay_receiver_id,status").maybeSingle();
   if(res.error||!res.data)return j(500,{error:"reconciliation_persist_failed"});
   return j(200,{ok:true,receiverId:res.data.safe2pay_receiver_id,status:res.data.status});
 }catch(e){
   return j(409,{error:e instanceof Error?e.message:"safe2pay_receiver_lookup_failed"});
 }
});
