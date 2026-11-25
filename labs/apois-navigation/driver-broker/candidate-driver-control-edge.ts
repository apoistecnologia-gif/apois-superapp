// Candidate only. verify_jwt=true; no service role or live config here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {createDriverProxy} from "./driver-proxy.mjs";
const enabled=Deno.env.get("APOIS_NAVIGATION_DRIVER_ENABLED")==="true";
const pilots=new Set((Deno.env.get("APOIS_NAVIGATION_DRIVER_PILOT_AUTH_IDS")??"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean));
Deno.serve(async req=>{
 if(!enabled)return new Response('{"ok":false,"error_code":"experimental_navigation_disabled"}',{status:409,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 try{
  const client=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
  return await createDriverProxy({enabled,endpoint:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_ENDPOINT"),keyId:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_KEY_ID"),secret:Deno.env.get("APOIS_NAVIGATION_DRIVER_BROKER_SECRET"),allowPilot:(id:string)=>pilots.has(id.toLowerCase()),verifySession:async(token:string)=>{const {data,error}=await client.auth.getUser(token);return error?null:data.user?.id??null}})(req);
 }catch{return new Response('{"ok":false,"error_code":"navigation_unavailable"}',{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
});
