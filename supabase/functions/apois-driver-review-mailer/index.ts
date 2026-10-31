// APOIS Corridas: authenticated staff-only transactional mailer.
// Requires RESEND_API_KEY and APOIS_EMAIL_FROM (verified domain) in Supabase secrets.
// This function is not deployed as part of the WEB-only QA preflight.
import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createClient} from "npm:@supabase/supabase-js@2.58.0";

const json=(code:number,data:unknown)=>new Response(JSON.stringify(data),{
 status:code,headers:{"content-type":"application/json","cache-control":"no-store"}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
serve(async (req)=>{
 if(req.method!=="POST")return json(405,{error:"method_not_allowed"});
 const authorization=req.headers.get("authorization")??"";
 const token=authorization.replace(/^Bearer /i,"");
 if(!token||token.split(".").length!==3)return json(401,{error:"authentication_required"});
 const url=Deno.env.get("SUPABASE_URL")??"";
 const anonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url||!anonKey||!serviceKey)return json(503,{error:"server_not_configured"});
 let requestId:string;
 try{ const body=await req.json();requestId=String(body?.request_id??"");
  if(!uuid.test(requestId))return json(400,{error:"invalid_request_id"});
 }catch{return json(400,{error:"invalid_json"});}
 const client=createClient(url,anonKey,{global:{headers:{Authorization:authorization}}});
 const {data:user,error:authError}=await client.auth.getUser(token);
 if(authError||!user.user)return json(401,{error:"invalid_session"});
 const allowed=await client.rpc("apois_admin_can_dispatch_driver_correction_mail",{_request_id:requestId});
 if(allowed.error||allowed.data!==true)return json(403,{error:"permission_denied"});
 const service=createClient(url,serviceKey,{auth:{persistSession:false}});
 const {data:mail,error:mailError}=await service.from("apois_driver_correction_email_outbox")
  .select("id,request_id,to_email,status,attempts").eq("request_id",requestId).maybeSingle();
 if(mailError||!mail)return json(404,{error:"email_not_queued"});
 if(mail.status==="accepted_by_provider")return json(200,{status:"accepted_by_provider",already_processed:true});
 if(!["queued","failed"].includes(mail.status))return json(409,{error:"invalid_queue_state"});
 const requestRow=await service.from("apois_driver_correction_requests")
  .select("reason,required_items,driver_id").eq("id",requestId).single();
 if(requestRow.error||!requestRow.data)return json(404,{error:"review_request_not_found"});
 const driver=await service.from("drivers").select("name").eq("id",requestRow.data.driver_id).maybeSingle();
 const key=Deno.env.get("RESEND_API_KEY");
 const sender=Deno.env.get("APOIS_EMAIL_FROM");
 if(!key||!sender)return json(503,{status:"queued",error:"email_provider_not_configured"});
 const reason=String(requestRow.data.reason??"").slice(0,1000);
 const items=(Array.isArray(requestRow.data.required_items)?requestRow.data.required_items:[])
  .map((item:string)=>String(item).slice(0,60));
 const name=String(driver.data?.name??"Motorista").slice(0,120);
 const body=[
  "APOIS Corridas — Pendência no cadastro de motorista",
  "",
  "Olá, "+name+".",
  "Nossa equipe analisou seu cadastro e identificou correções necessárias.",
  "",
  "Itens: "+items.join(", "),
  "Orientação da equipe: "+reason,
  "",
  "Entre no aplicativo APOIS Motorista, abra Status do cadastro ou Meus documentos, confira os detalhes e envie o material solicitado.",
  "Seu cadastro continua em análise até a conferência da equipe.",
  "",
  "Se você não reconhece este cadastro, entre em contato pelos canais oficiais da APOIS.",
 ].join("\n");
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",
   "Idempotency-Key":"apois-driver-review-"+requestId},
  body:JSON.stringify({from:sender,to:[mail.to_email],
   subject:"APOIS | Correções necessárias no cadastro de motorista",text:body})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
  await service.from("apois_driver_correction_email_outbox").update({
   status:"failed",attempts:mail.attempts+1,last_error_code:"provider_http_"+response.status
  }).eq("id",mail.id);
  return json(502,{status:"failed",error:"provider_rejected"});
 }
 await service.from("apois_driver_correction_email_outbox").update({
  status:"accepted_by_provider",accepted_at:new Date().toISOString(),
  provider_id:String((payload as {id?:string}).id??""),
  attempts:mail.attempts+1,last_error_code:null
 }).eq("id",mail.id);
 return json(200,{status:"accepted_by_provider"});
});
