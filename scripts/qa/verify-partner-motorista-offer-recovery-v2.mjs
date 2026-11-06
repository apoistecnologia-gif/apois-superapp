import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const source=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const start=source.indexOf("// APOIS_DRIVER_OFFER_RECOVERY_V2:");
const end=source.indexOf("    return () => {\n      supabase.removeChannel(ch);",start);
assert.ok(start>0 && end>start,"Real compiled driver app must include V2 polling inside live ride subscription effect");
const poll=source.slice(start,end);
for(const marker of [
  "offerQueryInFlight",
  "window.setInterval(",
  'from("rides").select("*")',
  '.contains("candidate_driver_ids", [userId as string])',
  '.eq("status", "procurar_motorista")',
  '.is("driver_id", null)',
  "presentOffer(data as RideRow)",
  ".finally(() => { offerQueryInFlight = false; })",
  "4_000",
])assert.ok(poll.includes(marker),"V2 polling missing: "+marker);
assert.ok(!/if\s*\(\s*!\s*navigator\.onLine\s*\)/.test(poll),"Do not gate live offers on a stale WebView navigator.onLine value");
assert.ok(!poll.includes("resyncDriverRides().catch(() => undefined)"),"Do not silently swallow failing offer queries");
assert.ok(source.includes("window.clearInterval(offerPoll)"),"Interval must stop on unmount");
assert.ok(source.includes('r.status !== "procurar_motorista"'),"Candidate validation must remain in real presentOffer");
assert.ok(source.includes('acceptedDriverId || didReject || !isCandidate || expired'),"Reject expired/assigned/noncandidate rides before display");
assert.ok(source.includes("callAccept({ data: { rideId: offer.id } })"),"Existing authenticated ride acceptance handler must remain unchanged");
console.log("[PASS] Motorista V2 pending offers recover from Supabase independently of FCM/browser online flag, scoped to authenticated driver; lifecycle preserved.");
