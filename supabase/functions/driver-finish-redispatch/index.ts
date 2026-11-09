// APOIS Relatorio 07 / INV-055. STAGED, NOT DEPLOYED.
// Do not enable until dispatch-ride and the recovery consumer are validated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asId = (v: unknown) => typeof v === "string" && UUID.test(v) ? v : null;
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status,headers:{...getCorsHeaders(req),"content-type":"application/json"}});

async function continueReleasedQueue(rideId: string): Promise<{redispatch:string;status:number|null}> {
  try {
    // Released queue must rebuild eligible candidates; the previous pool may
    // contain only the now-ineligible driver. This is NOT the rejection cursor.
    const response = await fetch(URL + "/functions/v1/dispatch-ride", {
      method: "POST",
      headers: {Authorization: "Bearer " + SERVICE,apikey:SERVICE,"content-type":"application/json"},
      body: JSON.stringify({ride_id:rideId,mode:"initial"}),
    });
    const data = await response.json().catch(()=>({})) as {ok?:boolean;action?:string};
    if (!response.ok || data.ok !== true) return {redispatch:"deferred",status:response.status};
    return {redispatch:data.action ?? "triggered",status:response.status};
  } catch(error) {
    console.error("[APOIS finish] dispatch after commit unavailable",error instanceof Error ? error.name : "unknown");
    return {redispatch:"deferred",status:null};
  }
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:getCorsHeaders(req)});
  if(req.method!=="POST") return json(req,{ok:false,error:"method_not_allowed"},405);
  if(!URL||!ANON||!SERVICE) return json(req,{ok:false,error:"server_configuration_missing"},503);
  const auth=req.headers.get("Authorization")??"";
  if(!/^Bearer\s+\S+/i.test(auth))return json(req,{ok:false,error:"unauthorized"},401);
  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const rideId=asId(body.ride_id);
    if(!rideId)return json(req,{ok:false,error:"invalid_ride_id"},422);
    const driverClient=createClient(URL,ANON,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:auth}},
    });
    // All identity, state, subscription, pricing and queued promotion checks
    // remain inside the existing atomic driver_finish_ride RPC.
    const {data,error}=await driverClient.rpc("driver_finish_ride",{_ride_id:rideId});
    if(error){
      // A lost response could follow a committed RPC. Never automatically
      // re-run it as a fallback; caller must refresh actual ride state.
      return json(req,{ok:false,error:error.message || "driver_finish_failed",
        completion:"unconfirmed",recheck_ride_state:true},409);
    }
    const row=(data&&typeof data==="object"?data:{}) as Record<string,unknown>;
    const releasedId=asId(row.released_queued_ride_id);
    const promotedId=asId(row.promoted_queued_ride_id);
    if(!releasedId)return json(req,{ok:true,ride:data,completion:"confirmed",
      redispatch:promotedId?"promoted":"not_required"});
    const continuation=await continueReleasedQueue(releasedId);
    if(continuation.redispatch==="deferred"){
      // This RPC also persisted ride.queued_released_ineligible_driver into
      // audit_logs; the staged recovery consumer can retry without re-finishing.
      console.error("[APOIS finish] queue released; retry required",{
        released_queued_ride_id:releasedId,dispatch_http_status:continuation.status});
    }
    return json(req,{ok:true,ride:data,completion:"confirmed",
      released_queued_ride_id:releasedId,redispatch:continuation.redispatch});
  }catch(error){
    console.error("[APOIS finish] error",error instanceof Error?error.name:"unknown");
    return json(req,{ok:false,error:"internal_error",completion:"unconfirmed",
      recheck_ride_state:true},500);
  }
});
