import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import { createSafe2PaySubaccount, extractSafe2PaySubaccountPublic } from "../_shared/safe2pay.ts";

const H={"content-type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const j=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:H});
const U=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const obj=(v:unknown)=>{if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("invalid_payload");return v as Record<string,unknown>};
const txt=(v:unknown,n:string,m=200)=>{const x=typeof v==="string"?v.trim():"";if(!x||x.length>m)throw new Error("invalid_"+n);return x};
const dig=(v:unknown)=>String(v??"").replace(/\D/g,"");
async function hash(v:unknown){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(v)));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("")}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return j(405,{error:"method_not_allowed"});
 const product=(Deno.env.get("SAFE2PAY_ONBOARDING_PRODUCT")??"").toLowerCase();
 if(!["rides","orders"].includes(product))return j(500,{error:"onboarding_product_not_configured"});
 const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",srv=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 const bearer=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
 if(!url||!anon||!srv||!bearer)return j(401,{error:"unauthorized"});
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,srv,{auth:{persistSession:false,autoRefreshToken:false}});
 const au=await auth.auth.getUser(bearer); if(au.error||!au.data.user)return j(401,{error:"unauthorized"});
 const uid=au.data.user.id;
 let adminOk=false;
 if(product==="rides"){
   const du=await admin.from("users").select("id").eq("auth_user_id",uid).maybeSingle();
   const ids=[uid,du.data?.id].filter(Boolean) as string[];
   const rr=await admin.from("user_roles").select("role").in("user_id",ids).in("role",["admin","super_admin"]).limit(1);
   adminOk=Boolean(rr.data?.length);
 }else{
   const rr=await admin.from("user_roles").select("role").eq("user_id",uid).in("role",["admin","super_admin"]).limit(1);
   adminOk=Boolean(rr.data?.length);
 }
 if(!adminOk)return j(403,{error:"forbidden"});
 try{
   const b=obj(await req.json());
   const target=txt(b.target_id,"target_id",36); if(!U.test(target))return j(400,{error:"invalid_target_id"});
   const targetTable=product==="rides"?"drivers":"merchants", acct=product==="rides"?"driver_safe2pay_accounts":"merchant_safe2pay_accounts", key=product==="rides"?"driver_id":"merchant_id";
   const targetSelect=product==="rides"
     ? "id,name,email,phone,cpf,birth_date,address,address_number,address_complement,province,postal_code,city,state"
     : "id";
   const found=await admin.from(targetTable).select(targetSelect).eq("id",target).maybeSingle(); if(!found.data)return j(404,{error:"target_not_found"});
   const old=await admin.from(acct).select("safe2pay_receiver_id,status").eq(key,target).maybeSingle();
   if(old.data?.safe2pay_receiver_id&&old.data.status==="active")return j(200,{ok:true,reused:true,receiverId:old.data.safe2pay_receiver_id,status:"active"});
   if(["provisioning","reconciliation_required"].includes(String(old.data?.status??"")))return j(409,{error:"safe2pay_reconciliation_required"});
   let requestBody: Record<string, unknown>;
   if(product==="rides"){
     const d=found.data as Record<string,unknown>;
     const identity=dig(d.cpf);
     const phone=dig(d.phone);
     const zip=dig(d.postal_code);
     const birth=String(d.birth_date??"").trim();
     if(identity.length!==11||phone.length<10||phone.length>11||zip.length!==8||!/^\d{4}-\d{2}-\d{2}$/.test(birth)){
       return j(409,{error:"driver_safe2pay_profile_incomplete"});
     }
     requestBody={
       Name:txt(d.name,"name"),
       Identity:identity,
       ResponsibleName:txt(d.name,"responsible_name"),
       ResponsibleIdentity:identity,
       ResponsibleBirthDate:birth,
       ResponsiblePhone:phone,
       Email:txt(d.email,"email",254),
       Address:{
         ZipCode:zip,
         Street:txt(d.address,"street",150),
         Number:txt(d.address_number,"number",15),
         District:txt(d.province,"district",60),
         Complement:typeof d.address_complement==="string"?d.address_complement.trim()||undefined:undefined,
         Reference:[d.city,d.state].filter(Boolean).map(String).join(" - ").slice(0,100)||undefined
       },
       IsPanelRestricted:true,
       IsTransferCheckingAccountDisabled:true
     };
   } else {
     const a=obj(b.Address);
     const identity=txt(b.Identity,"identity",32).replace(/[.\/-]/g,"");
     const rid=txt(b.ResponsibleIdentity??b.Identity,"responsible_identity",32).replace(/\D/g,"");
     const phone=dig(b.ResponsiblePhone),zip=dig(a.ZipCode);
     if(![11,14].includes(identity.length)||rid.length!==11||phone.length<10||phone.length>11||zip.length!==8)throw new Error("invalid_identity_data");
     requestBody={
       Name:txt(b.Name,"name"),CommercialName:typeof b.CommercialName==="string"?b.CommercialName.trim():undefined,
       Identity:identity,ResponsibleName:txt(b.ResponsibleName??b.Name,"responsible_name"),ResponsibleIdentity:rid,
       ResponsibleBirthDate:txt(b.ResponsibleBirthDate,"responsible_birth_date",10),ResponsiblePhone:phone,Email:txt(b.Email,"email",254),
       Address:{ZipCode:zip,Street:txt(a.Street,"street",150),Number:txt(a.Number,"number",15),District:txt(a.District,"district",60),
         Complement:typeof a.Complement==="string"?a.Complement.trim()||undefined:undefined,Reference:typeof a.Reference==="string"?a.Reference.trim()||undefined:undefined},
       IsPanelRestricted:true,IsTransferCheckingAccountDisabled:b.IsTransferCheckingAccountDisabled===true
     };
   }
   const fp=await hash({target,product,requestBody});
   const prep=await admin.from(acct).upsert({[key]:target,status:"provisioning",request_fingerprint:fp,provisioning_started_at:new Date().toISOString(),environment:"production",last_error_code:null},{onConflict:key});
   if(prep.error)return j(500,{error:"provisioning_state_failed"});
   let provider;
   try{provider=await createSafe2PaySubaccount(requestBody)}
   catch(e){await admin.from(acct).update({status:"reconciliation_required",last_error_code:e instanceof Error?e.message.slice(0,180):"provider_error"}).eq(key,target);return j(502,{error:"safe2pay_subaccount_failed",reconciliationRequired:true})}
   const pub=extractSafe2PaySubaccountPublic(provider);
   if(!pub.receiverId){await admin.from(acct).update({status:"reconciliation_required",last_error_code:"receiver_id_missing"}).eq(key,target);return j(502,{error:"safe2pay_receiver_id_missing",reconciliationRequired:true})}
   const fin=await admin.from(acct).update({safe2pay_receiver_id:pub.receiverId,status:"active",provider_created_at:new Date().toISOString(),last_error_code:null}).eq(key,target).eq("request_fingerprint",fp).select("safe2pay_receiver_id,status").maybeSingle();
   if(fin.error||!fin.data)return j(500,{error:"safe2pay_receiver_persist_failed",reconciliationRequired:true});
   return j(200,{ok:true,reused:false,receiverId:fin.data.safe2pay_receiver_id,status:fin.data.status});
 }catch(e){return j(400,{error:e instanceof Error?e.message:"invalid_request"})}
});
