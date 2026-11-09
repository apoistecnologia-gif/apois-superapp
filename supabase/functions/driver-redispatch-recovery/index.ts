// APOIS Relatorio 07 / bounded reconciliation for committed redispatch events.
// STAGED ONLY. Service-role invocation by controlled scheduler, never a browser.
// No deployment, cron, migration or notification is initiated by this source.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),
  {status,headers:{...getCorsHeaders(req),"content-type":"application/json"}});

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:getCorsHeaders(req)});
  if(req.method!=="POST")return json(req,{ok:false,error:"method_not_allowed"},405);
  if(!URL||!SERVICE)return json(req,{ok:false,error:"server_configuration_missing"},503);
  const auth=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(auth!==SERVICE)return json(req,{ok:false,error:"unauthorized"},401);
  try{
    const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
    // Audit events are written INSIDE the existing RPC transaction. They
    // survive a response loss after commit and identify the released ride.
    const since=new Date(Date.now()-6*60*60*1000).toISOString();
    const {data:events,error:eventsError}=await admin.from("audit_logs")
      .select("id,entity_id,action,created_at")
      .eq("entity_type","ride")
      .in("action",[
        "ride.queued_released_ineligible_driver",
        "ride.driver_cancelled_for_redispatch",
      ])
      .gte("created_at",since)
      .order("id",{ascending:false}).limit(200);
    if(eventsError)return json(req,{ok:false,error:"audit_lookup_failed"},500);
    const seen=new Set<string>();
    const result={checked:0,skipped:0,retried:0,deferred:0,scan_limited:(events??[]).length>=200};
    for(const event of events??[]){
      const rideId=String(event.entity_id??"");
      if(!UUID.test(rideId)||seen.has(rideId))continue;
      seen.add(rideId);
      result.checked++;
      const {data:ride,error:rideError}=await admin.from("rides")
        .select("status,driver_id,accepted_driver_id,search_expires_at,request_expires_at,offered_driver_ids")
        .eq("id",rideId).maybeSingle();
      if(rideError){result.deferred++;continue;}
      if(!ride||ride.status!=="procurar_motorista"||ride.driver_id||ride.accepted_driver_id){
        result.skipped++;continue;
      }
      const now=Date.now();
      if(ride.search_expires_at && new Date(ride.search_expires_at).getTime()<=now){
        result.skipped++;continue;
      }
      const offerUntil=ride.request_expires_at?new Date(ride.request_expires_at).getTime():0;
      if(Array.isArray(ride.offered_driver_ids)&&ride.offered_driver_ids.length>0&&offerUntil>now){
        result.skipped++;continue;
      }
      // Released queue rebuilds candidate pool; ordinary cancellation keeps
      // the remaining pool. Dispatch itself checks eligibility and CAS.
      const mode=event.action==="ride.queued_released_ineligible_driver"?"initial":"redispatch";
      try{
        const response=await fetch(URL+"/functions/v1/dispatch-ride",{
          method:"POST",
          headers:{Authorization:"Bearer "+SERVICE,apikey:SERVICE,"content-type":"application/json"},
          body:JSON.stringify({ride_id:rideId,mode}),
        });
        const payload=await response.json().catch(()=>({})) as {ok?:boolean};
        if(response.ok&&payload.ok===true)result.retried++;
        else result.deferred++;
      }catch{result.deferred++;}
    }
    // A 6h/200 cap is intentional; report it as limited, never as full scan.
    return json(req,{ok:true,...result,recovery:"bounded_audit_replay"});
  }catch(error){
    console.error("[APOIS redispatch recovery] internal",error instanceof Error?error.name:"unknown");
    return json(req,{ok:false,error:"internal_error"},500);
  }
});
