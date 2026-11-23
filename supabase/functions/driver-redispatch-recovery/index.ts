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
    // The existing reject RPC does not write an audit event. Scan BOTH:
    // (1) durable cancel/released-queue audit logs and (2) stale open searches.
    // Never call reject/cancel/finish a second time: only redispatch the
    // committed ride state, with dispatch-ride's CAS and eligibility guards.
    const scanNowMs = Date.now();
    const nowIso = new Date(scanNowMs).toISOString();
    const since = new Date(scanNowMs - 6 * 60 * 60 * 1000).toISOString();
    const staleBefore = new Date(scanNowMs - 10_000).toISOString();
    const MAX_AUDIT_EVENTS = 75;
    const MAX_STALE_RIDES = 75;
    const MAX_REDISPATCH_ATTEMPTS = 60;
    const { data: events, error: eventsError } = await admin.from("audit_logs")
      .select("id,entity_id,action,created_at")
      .eq("entity_type", "ride")
      .in("action", [
        "ride.queued_released_ineligible_driver",
        "ride.driver_cancelled_for_redispatch",
      ])
      .gte("created_at", since)
      .order("id", { ascending: false })
      .limit(MAX_AUDIT_EVENTS);
    if (eventsError) return json(req, { ok: false, error: "audit_lookup_failed" }, 500);

    // After rejection, a failed dispatcher leaves an unassigned ride searching
    // and its existing offer window eventually expires. A second read catches
    // that case, even though the reject RPC has no matching audit event.
    // Never scan an active offer or a queued ride still assigned to a driver.
    const { data: staleRides, error: staleError } = await admin.from("rides")
      .select("id")
      .eq("status", "procurar_motorista")
      .is("driver_id", null)
      .is("accepted_driver_id", null)
      .is("queued_after_ride_id", null)
      // request-ride can commit the ride before its initial offer is saved.
      // Include null request_expires_at after a short creation grace period.
      .or("request_expires_at.is.null,request_expires_at.lte." + staleBefore)
      .gt("search_expires_at", nowIso)
      .gte("created_at", since)
      .lte("created_at", staleBefore)
      .order("request_expires_at", { ascending: true })
      .limit(MAX_STALE_RIDES);
    if (staleError) return json(req, { ok: false, error: "stale_lookup_failed" }, 500);

    const candidates = [
      ...(events ?? []).map((event) => ({
        rideId: String(event.entity_id ?? ""),
        action: String(event.action ?? ""),
      })),
      ...(staleRides ?? []).map((ride) => ({
        rideId: String(ride.id ?? ""),
        action: "ride.stale_search_recovery",
      })),
    ];
    const seen = new Set<string>();
    const result = {
      checked: 0, skipped: 0, retried: 0, deferred: 0,
      event_candidates: (events ?? []).length,
      stale_candidates: (staleRides ?? []).length,
      scan_limited: (events ?? []).length >= MAX_AUDIT_EVENTS
        || (staleRides ?? []).length >= MAX_STALE_RIDES,
      attempt_limited: false,
    };
    let attempts = 0;

    for (const candidate of candidates) {
      if (attempts >= MAX_REDISPATCH_ATTEMPTS) {
        result.attempt_limited = true;
        break;
      }
      const rideId = candidate.rideId;
      if (!UUID.test(rideId) || seen.has(rideId)) continue;
      seen.add(rideId);
      result.checked++;
      const { data: ride, error: rideError } = await admin.from("rides")
        .select("status,driver_id,accepted_driver_id,queued_after_ride_id,search_expires_at,request_expires_at,offered_driver_ids,candidate_driver_ids")
        .eq("id", rideId).maybeSingle();
      if (rideError) { result.deferred++; continue; }
      if (!ride || ride.status !== "procurar_motorista" || ride.driver_id
        || ride.accepted_driver_id || ride.queued_after_ride_id) {
        result.skipped++; continue;
      }
      if (ride.search_expires_at && new Date(ride.search_expires_at).getTime() <= scanNowMs) {
        result.skipped++; continue;
      }
      const offerUntil = ride.request_expires_at
        ? new Date(ride.request_expires_at).getTime() : 0;
      if (Array.isArray(ride.offered_driver_ids)
        && ride.offered_driver_ids.length > 0 && offerUntil > scanNowMs) {
        result.skipped++; continue;
      }

      // Rebuilding from scratch is allowed only after the remaining pool is
      // exhausted; rejected/offered drivers remain excluded by dispatch-engine.
      const hasRemainingCandidates = Array.isArray(ride.candidate_driver_ids)
        && ride.candidate_driver_ids.length > 0;
      const mode = candidate.action === "ride.queued_released_ineligible_driver"
        || !hasRemainingCandidates ? "initial" : "redispatch";
      attempts++;
      try {
        const response = await fetch(URL + "/functions/v1/dispatch-ride", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + SERVICE,
            apikey: SERVICE,
            "content-type": "application/json",
          },
          body: JSON.stringify({ ride_id: rideId, mode }),
        });
        const payload = await response.json().catch(() => ({})) as { ok?: boolean };
        if (response.ok && payload.ok === true) result.retried++;
        else result.deferred++;
      } catch { result.deferred++; }
    }
    // Bounded scan and bounded dispatch attempts; report caps as partial coverage.
    return json(req,{ok:true,...result,recovery:"bounded_audit_replay"});
  }catch(error){
    console.error("[APOIS redispatch recovery] internal",error instanceof Error?error.name:"unknown");
    return json(req,{ok:false,error:"internal_error"},500);
  }
});
