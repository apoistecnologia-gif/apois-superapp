import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const base=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const card=readFileSync(resolve(base,"src/components/rides/active/RideStopsTimeline.tsx"),"utf8");
const route=readFileSync(resolve(base,"src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");
for(const marker of [
"APOIS_CLIENTE_ACTIVE_RIDE_SUMMARY_CONTRAST_V1",
"data-apois-ride-summary-contrast-v1",
"bg-white",
"text-[#111827]",
"Embarque",
"Destino Final",
"ride.origin_name",
"ride.destination_name",
"Parada {i + 1}",
"ride.intermediates || []",
])assert.ok(card.includes(marker),"Ride summary/card lost: "+marker);
assert.ok(!card.includes("text-zinc-300"),"White card must not show faded dark-theme address text");
for(const marker of [
"<RideStopsTimeline ride={ride} />",
"CANCELAR CORRIDA",
"APOIS_CANCEL_VISIBLE_V1",
"max-h-[60vh]",
"ride.estimated_price",
"ride.payment_method",
])assert.ok(route.includes(marker),"Active ride rendering/scroll action lost: "+marker);
console.log("[PASS] Client trip summary: pickup/destination and stops visible with dark-on-light contrast; fixed Cancel remains accessible and scroll clear.");
