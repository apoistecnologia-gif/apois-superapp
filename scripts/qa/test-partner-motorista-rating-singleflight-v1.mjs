import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const s=readFileSync(resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/routes/motorista.app.tsx"),"utf8");
const from=s.indexOf("  async function submitRating() {");
const to=s.indexOf("  function dismissRating()",from);
assert.ok(from>0&&to>from,"Submit rating handler exists");
const submit=s.slice(from,to);
for(const marker of [
  "APOIS_DRIVER_RATING_SINGLE_FLIGHT_V1",
  "const ratingSubmittingRef = useRef(false);",
  "submittingRating || ratingSubmitted || ratingSubmittingRef.current",
  "ratingSubmittingRef.current = true;",
  "await callRate(",
  "ratedRidesRef.current.add(ratedRideId)",
  "ratingSubmittingRef.current = false; setSubmittingRating(false);",
  'if (ratingSubmittingRef.current) return;',
  'event: "rating.closed"'
])assert.ok(s.includes(marker),"Rating state-machine guard missing: "+marker);
assert.ok(submit.indexOf("ratingSubmittingRef.current = true;")<submit.indexOf("await callRate("),"Lock must precede server request");
assert.ok(submit.includes("catch (e)"),"Transient failure must remain recoverable");
assert.ok(s.includes("ratingRef.current = null;"),"Next queued ride must still be unblocked");
console.log("[PASS] Driver passenger rating one flight; server confirmation and skip handoff preserved.");
