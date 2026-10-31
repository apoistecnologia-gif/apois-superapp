import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const client=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const sql=readFileSync("supabase/corridas-forward-migrations/20261031_driver_demand_zones_qa_NOT_APPLIED.sql","utf8");
for(const marker of [
  "APOIS_DRIVER_DEMAND_ZONES_V1",
  'rpc("apois_get_driver_demand_zones")',
  "OverlayView.OVERLAY_LAYER",
  "showDemandZones && demandZones.map",
  "online && !active && !incoming && !ratingRide",
  "setDemandZones([])",
  "window.clearInterval(timer)",
  "window.setInterval",
  "Array.isArray(data)",
  "data-apois-demand-zone-v1",
  "animate-ping",
]){
 assert.ok(client.includes(marker),"Driver map missing "+marker);
}
assert.equal((client.match(/apois_get_driver_demand_zones/g)||[]).length,1,"one RPC caller");
assert.ok(!client.includes('from("rides").select("origin_lat'),"No direct read of rider GPS");
for(const marker of [
  "NÃO APLICADA","HAVING count(DISTINCT r.id)>=3",
  "r.created_at > now()-interval '30 minutes'",
  "d.approval_status='aprovado'",
  "d.is_online IS TRUE",
  "d.last_location_at > now()-interval '5 minutes'",
  "r.cancelled_at IS NULL",
  "REVOKE ALL ON FUNCTION public.apois_get_driver_demand_zones() FROM PUBLIC, anon",
  "GRANT EXECUTE ON FUNCTION public.apois_get_driver_demand_zones() TO authenticated"
])assert.ok(sql.includes(marker),"Demand SQL privacy gate missing "+marker);
for(const disallowed of ["passenger_id","destination_lat","destination_lng","r.passenger_id","driver_phone","driver_id AS"]){
 assert.ok(!sql.includes(disallowed),"Demand SQL must not expose "+disallowed);
}
console.log("[OK] Motorista demand: privacy minimum 3, approximate cell, online idle, cleanup and no fake clients.");
