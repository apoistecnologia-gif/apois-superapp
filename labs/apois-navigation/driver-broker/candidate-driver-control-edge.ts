// Candidate only. No production registration. JWT must be verified by Auth.
// Both local and remote experimental modes require a reviewed private session reader.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {createDriverProxy} from "./driver-proxy.mjs";
import {createDirectLocalDriverEdge} from "../production-contract/driver-direct-edge-v21.mjs";
import {createV21EdgeSession} from "../production-contract/edge-session-v21.mjs";
const enabled=Deno.env.get("APOIS_NAVIGATION_DRIVER_ENABLED")==="true";
const localOnly=Deno.env.get("APOIS_NAVIGATION_DRIVER_LOCAL_ONLY")==="true";
const directLocal=Deno.env.get("APOIS_NAVIGATION_DRIVER_DIRECT_LOCAL")==="true";
const pilots=new Set((Deno.env.get("APOIS_NAVIGATION_DRIVER_PILOT_AUTH_IDS")??"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean));
const unavailable=(status=503)=>new Response(JSON.stringify({ok:false,error_code:status===409?"experimental_navigation_disabled":"navigation_unavailable"}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
let proxy:((req:Request)=>Promise<Response>)|null=null;
function configure(){
 const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const policy=Deno.env.get("APOIS_NAVIGATION_SESSION_POLICY")==="existence-not-after-reviewed";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!policy||!service)throw Error("Unverified session reader");
 const privateClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const verifySession=createV21EdgeSession({projectUrl:url,sessionPolicyConfirmed:policy,authClient:client,serviceClient:privateClient});
 if(directLocal){
  if(!localOnly)throw Error("Direct target reads require local-only routing");
  return createDirectLocalDriverEdge({enabled,verifySession,allowPilot:id=>pilots.has(id.toLowerCase()),
   readLimited:async(input,signal)=>{
    const {data,error}=await privateClient.rpc("apois_nav_lab_driver_target_limited_v21",{
     p_auth_user:input.authUserId,p_ride:input.rideId,p_phase:input.phase}).abortSignal(signal);
    if(error)throw Error("Driver target unavailable");
    return data;
   }});
 }
 return createDriverProxy({enabled,localOnly,endpoint:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_ENDPOINT"),keyId:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_KEY_ID"),secret:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_SECRET"),allowPilot:(id:string)=>pilots.has(id.toLowerCase()),verifySession});
}
Deno.serve(async req=>{
 if(!enabled)return unavailable(409);
 try{proxy??=configure();return await proxy(req)}catch{return unavailable()}
});
