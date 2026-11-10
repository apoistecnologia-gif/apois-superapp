// Live generated TSX assertions, with a simulated GPS watcher.
// No backend, GPS permission, rides or billing data are modified or invoked.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const route=readFileSync(resolve(root,"src/hooks/use-route.tsx"),"utf8");
const review=readFileSync(resolve(root,"src/routes/_authenticated.revisar-solicitacao.tsx"),"utf8");
const request=readFileSync(resolve(root,"src/hooks/rides/use-ride-request.tsx"),"utf8");
const checkout=readFileSync(resolve(root,"src/hooks/use-checkout-preparation.tsx"),"utf8");
const marker="// GPS watcher may deliver a new location object every second.";
const start=route.indexOf(marker);
const end=route.indexOf("  }, [calculateRoute, destination, location, orderedStops]);",start);
assert.ok(start>0 && end>start,"Expected integrated GPS effect, not a source-only mock");
const effectBody=route.slice(start,end);
function simulate(previous,{latitude=-9.389,longitude=-40.503,destLat=-9.397,destLng=-40.493,stops=[]}={}){
  const snapshot={current:previous};
  const calls={scheduled:0,calculated:0,statuses:[],timers:[]};
  const fn=vm.runInNewContext("() => {"+effectBody+"}",{
    routeRequestSnapshotRef:snapshot,
    location:{latitude,longitude},
    destination:{latitude:destLat,longitude:destLng},
    orderedStops:stops.map(x=>({latitude:x[0],longitude:x[1]})),
    calculateRoute:()=>{calls.calculated++},
    setTimeout:cb=>{calls.scheduled++;calls.timers.push(cb);return calls.scheduled;},
    clearTimeout:()=>{},
    setStatus:x=>calls.statuses.push(x),
    Math,JSON,Infinity
  });
  fn();
  calls.timers.forEach(cb=>cb());
  return calls;
}
const base={intent:JSON.stringify([-9.397,-40.493]),origin:{lat:-9.389,lng:-40.503}};
test("GPS <85m: stable route; no debounce or repricing/backend request",()=>{
  const result=simulate(base,{latitude:-9.38915,longitude:-40.5031});
  assert.equal(result.scheduled,0);
  assert.equal(result.calculated,0);
  assert.deepEqual(result.statuses,[]);
});
test("GPS >85m: route must be revalidated by backend",()=>{
  const result=simulate(base,{latitude:-9.3901});
  assert.equal(result.calculated,1);
  assert.deepEqual(result.statuses,["debouncing"]);
});
test("Destination changed: GPS threshold cannot bypass route revalidation",()=>{
  assert.equal(simulate(base,{destLng:-40.48}).calculated,1);
});
test("Stops changed: GPS threshold cannot bypass intermediate route revalidation",()=>{
  assert.equal(simulate(base,{stops:[[-9.4,-40.5]]}).calculated,1);
});
test("Initial/no snapshot: first official route must compute",()=>{
  assert.equal(simulate(null).calculated,1);
});
test("Old async results, route clear, backend quote, stale review remain protected",()=>{
  for(const s of [
    "APOIS_RIDE_GPS_STABILITY_V1","APOIS_REPORT09_ROUTE_CURRENT_V1",
    "++routeGenerationRef.current;","if (generation !== routeGenerationRef.current) return;",
    "routeRequestSnapshotRef.current = null;",
    "APOIS_ROUTE_CLEAR_SAFE_V1","route.destination.lat === destination.latitude",
    "Math.hypot(","<= 85"
  ]) assert.ok(route.includes(s), "Route gate lost "+s);
  for(const s of ["APOIS_REPORT09_SUBMIT_GUARD_V1",
    "latest.route === route","latest.checkout.readiness",
    "stopsSignatureRef.current","Rota, categoria ou valores mudaram."]) {
    assert.ok(request.includes(s),"Anti-stale submission lost "+s);
  }
  assert.ok(checkout.includes("!pricingIsCurrent")&&checkout.includes("!routeIsCurrent"),"Pricing gates lost");
});
test("Invalid tariff is not represented as a zero-priced ride on review",()=>{
  assert.ok(review.includes("Recalculando tarifa..."));
  assert.ok(review.includes('"route_missing", "route_outdated", "pricing_invalid"'));
  assert.ok(review.includes("formatCurrency(checkout.finalTotal)"));
  assert.ok(review.includes("disabled={!canSubmit}"));
  assert.ok(review.includes("APOIS_REPORT09_REVIEW_GUARD_V1"));
});
