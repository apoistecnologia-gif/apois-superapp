// Candidate for a SEPARATE Edge Function, never deployed by this lab.
// Keep verify_jwt=true; verify auth.getUser(token) again in the function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createNavigationControl } from "./navigation-control-v21.mjs";

const origins=new Set((Deno.env.get("APOIS_NAVIGATION_ALLOWED_ORIGINS")??"").split(",").map(x=>x.trim()).filter(Boolean));
const pilots=new Set((Deno.env.get("APOIS_NAVIGATION_PILOT_AUTH_IDS")??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean));
const confirmationEnabled=Deno.env.get("APOIS_NAVIGATION_EXPERIMENTAL_ENABLED")==="true";
const recoveryEnabled=Deno.env.get("APOIS_NAVIGATION_RECOVERY_ENABLED")==="true";
const catalogPolicy={version:Number(Deno.env.get("APOIS_NAVIGATION_CATALOG_VERSION")??"0"),extractHash:Deno.env.get("APOIS_NAVIGATION_CATALOG_EXTRACT_SHA256")??""};
const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";

Deno.serve(async req=>{
 const origin=req.headers.get("Origin");
 const headers:Record<string,string>={"Cache-Control":"no-store","Content-Type":"application/json","Vary":"Origin","X-Content-Type-Options":"nosniff"};
 if(origin&&origins.has(origin)){
  headers["Access-Control-Allow-Origin"]=origin;
  headers["Access-Control-Allow-Headers"]="authorization, x-client-info, apikey, content-type";
  headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
 }
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return json({ok:false,error_code:"origin_not_allowed"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({ok:false,error_code:"method_not_allowed"},405);
 if(!confirmationEnabled&&!recoveryEnabled)return json({ok:false,error_code:"experimental_navigation_disabled"},409);
 if(!url||!anon||!service)return json({ok:false,error_code:"navigation_unavailable"},503);
 const authorization=req.headers.get("authorization")??"";
 if(!authorization.startsWith("Bearer ")||authorization.length>8192)return json({ok:false,error_code:"unauthorized"},401);
 if(req.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json"||!req.body)return json({ok:false,error_code:"invalid_request"},415);
 try{
  const reader=req.body.getReader();let total=0;const decoder=new TextDecoder();let raw="";
  let timedOut=false;
  const deadline=setTimeout(()=>{timedOut=true;void reader.cancel().catch(()=>undefined)},3000);
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4096){await reader.cancel();return json({ok:false,error_code:"request_too_large"},413)}raw+=decoder.decode(value,{stream:true})}
   raw+=decoder.decode();
  }finally{clearTimeout(deadline);reader.releaseLock()}
  if(timedOut)return json({ok:false,error_code:"request_timeout"},408);
  const body=JSON.parse(raw);
  const token=authorization.slice(7);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const handler=createNavigationControl({confirmationEnabled,recoveryEnabled,catalogPolicy,
   verifySession:async()=>{const {data,error}=await client.auth.getUser(token);return error?null:data.user?.id??null},
   allowPilot:(id:string)=>pilots.has(id.toLowerCase()),
   rpc:async(name:string,args:Record<string,unknown>)=>{const {data,error}=await admin.rpc(name,args);if(error)throw Error("navigation RPC failed");return data}
  });
  const result=await handler(null,body);
  return json(result.body,result.status);
 }catch{return json({ok:false,error_code:"navigation_control_unavailable"},503)}
});
