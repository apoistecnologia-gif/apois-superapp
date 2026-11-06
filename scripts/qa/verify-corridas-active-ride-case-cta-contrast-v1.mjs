// Case-center CTA on the actual generated Corridas route.
// Field APK Nov 6 contained invisible white-on-white "Reportar problema" text.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const src=readFileSync(resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas","src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");
for(const marker of [
  "Reportar problema com esta corrida",
  "setShowCaseCenter(true)",
  'border border-[#E00029]/45 bg-white text-sm font-extrabold text-[#991B1B]',
  "ApoisCaseCenter",
  "APOIS_CASE_CENTER_CLIENT_V1",
  "CANCELAR CORRIDA",
])assert.ok(src.includes(marker),"Invisible CTA or case action regression: "+marker);
assert.ok(!src.includes('bg-white/5 text-sm font-bold text-white">Reportar problema com esta corrida'),"Original invisible white-on-white CTA must be absent");
console.log("[PASS] Cliente live ride: Reportar problema CTA has dark text on white background, case center/cancel preserved.");
