import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const workspace=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/motorista");
const driver=readFileSync(resolve(workspace,"src/routes/motorista.app.tsx"),"utf8");
const script=readFileSync(resolve("scripts/harden-partner-motorista-demand-map-v1.mjs"),"utf8");

test("QA218 motorista idle: existing demand remains plus anonymized opt-in groups",()=>{
 for(const marker of [
  "APOIS_DRIVER_DEMAND_ZONES_V1",
  'rpc("apois_get_driver_demand_zones")',
  'rpc("apois_driver_passenger_hotspots")',
  "const optInZones=",
  "const zones=[...requestZones,...optInZones]",
  "online && !active && !incoming && !ratingRide",
  "showDemandZones && demandZones.map",
  "OverlayView.OVERLAY_LAYER",
  "animate-ping",
  "data-apois-demand-zone-v1",
  "window.clearInterval(timer)",
 ])assert.ok(driver.includes(marker),marker);
 assert.ok(script.includes("apois_driver_passenger_hotspots"));
 assert.ok(!driver.includes("auth.users"));
 assert.ok(!driver.includes("public.apois_passenger_demand_presence"));
});
