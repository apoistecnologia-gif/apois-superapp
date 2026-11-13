import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {distanceToRoute,advanceDeviation,marker,patchDriver} from "../fix-partner-driver-qa222-follow-reroute-v1.mjs";

const route=[{lat:-9.390,lng:-40.520},{lat:-9.390,lng:-40.515},{lat:-9.389,lng:-40.512}];
const on={lat:-9.39001,lng:-40.518};
const off1={lat:-9.38935,lng:-40.518};
const off2={lat:-9.38930,lng:-40.5178};
const clock=100000;

test("distance to real route segments: on road near zero and off road over forty meters",()=>{
 assert.ok(distanceToRoute(on,route)<4);
 assert.ok(distanceToRoute(off1,route)>50);
 assert.ok(distanceToRoute({lat:-9.390,lng:-40.520},route)<1);
 assert.equal(distanceToRoute(on,[]),Infinity);
 assert.equal(distanceToRoute({lat:NaN,lng:0},route),Infinity);
});

test("one noisy GPS fix cannot trigger a reroute, even far from the road",()=>{
 const a=advanceDeviation(null,"trip",off1,distanceToRoute(off1,route),clock,0,false,0);
 assert.equal(a.reroute,false);
 assert.equal(a.state.observations,1);
 const back=advanceDeviation(a.state,"trip",on,distanceToRoute(on,route),clock+3000,0,false,0);
 assert.equal(back.reroute,false);
 assert.equal(back.state,null);
});

test("two distinct off-route positions over seven seconds trigger bounded route refresh",()=>{
 const a=advanceDeviation(null,"trip",off1,distanceToRoute(off1,route),clock,0,false,0);
 const b=advanceDeviation(a.state,"trip",off2,distanceToRoute(off2,route),clock+8000,0,false,0);
 assert.equal(b.reroute,true);
 assert.equal(b.state.observations,2);
});

test("cooldown and provider failure backoff prevent repeated paid route calls",()=>{
 const a=advanceDeviation(null,"trip",off1,distanceToRoute(off1,route),clock,clock-10000,false,0);
 const b=advanceDeviation(a.state,"trip",off2,distanceToRoute(off2,route),clock+8000,clock-10000,false,0);
 assert.equal(b.reroute,false,"must wait >=30s after prior request");
 const c=advanceDeviation(a.state,"trip",off2,distanceToRoute(off2,route),clock+8000,0,true,2);
 assert.equal(c.reroute,false,"must stop after two provider failures");
});

test("route phase switch resets off-route confirmation",()=>{
 const a=advanceDeviation(null,"pickup",off1,100,clock,0,false,0);
 const b=advanceDeviation(a.state,"trip",off2,100,clock+8000,0,false,0);
 assert.equal(b.reroute,false);
 assert.equal(b.state.observations,1);
});

test("short GPS jitter does not masquerade as a second distinct route deviation",()=>{
 const a=advanceDeviation(null,"trip",off1,75,clock,0,false,0);
 const b=advanceDeviation(a.state,{toString:()=> "trip"}.toString(),{lat:off1.lat+0.00001,lng:off1.lng},75,clock+9000,0,false,0);
 assert.equal(b.reroute,false);
 assert.equal(b.state.observations,1);
});

test("generated Motorista QA222 preserves QA220/QA221 and inserts live camera and off-route handling",()=>{
 const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
 if(!existsSync(file))return; // pure unit standalone; integration build asserts this path
 const code=readFileSync(file,"utf8");
 for(const tok of [
   marker, "qa222DistanceToRoute(pos,polyline)","qa222AdvanceDeviation(",
   "offRouteDue","qa222OverviewActiveRef.current=true","qa222OverviewActiveRef.current=false",
   "driverCameraHistory.delete(mapRef.current);",
   "map.setCenter({lat:position.lat,lng:position.lng})",
   "onClick={onRecenter}","onClick={onShowRoute}","onStart(pinCode)",
   "onClick={handleComplete}","onClick={onAccept}","onClick={onReject}",
   "data-apois-driver-main-map-owner","data-apois-qa221-trip-hud",
   "data-apois-qa220-pin-digit-v1",
 ])assert.ok(code.includes(tok),"missing "+tok);
 assert.ok(code.includes("elapsedMs >= 180000"),"old rate-limited periodic refresh retained");
 assert.ok(code.includes("prior.failures < 2"),"provider backoff retained");
 assert.ok(!code.includes("movedMeters < 12 || now-previous.at < 1800"),"obsolete lag removed");
 assert.throws(()=>patchDriver(code),/duplicate transform/);
});
