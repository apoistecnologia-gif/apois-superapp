import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,randomBytes} from "node:crypto";
import {createPolygonRegion,inside} from "./region-policy.mjs";
import {routeBody,createRouteIssuer} from "./route-issuer.mjs";
import {normalizeRoute} from "./route-gateway.mjs";
import {createRouteAuthorization} from "./route-authorization.mjs";
// Synthetic polygon around a sample corridor, with a hole. NOT official Northeast boundary.
const square=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
const raw=Buffer.from(JSON.stringify({type:"MultiPolygon",coordinates:[[square(-42,-8,1),square(-41.8,-7.8,.1)],[square(-40,-6,1)]]}));
const hash=createHash("sha256").update(raw).digest("hex");
const contains=createPolygonRegion(raw,hash);
test("trusted geometry rejects hole, boundary, gap and invalid coordinates",()=>{
 assert.equal(contains(-7.4,-41.4),true);assert.equal(contains(-5.5,-39.5),true);
 for(const [lat,lon] of [[-7.75,-41.75],[-8,-42],[-6.5,-40.5],[0,0],[NaN,-41]])assert.equal(contains(lat,lon),false);
 assert.throws(()=>createPolygonRegion(raw,"0".repeat(64)));
 const bad=Buffer.from(JSON.stringify({type:"Polygon",coordinates:[[[0,0],[1,0],[1,1],[0,1]]]}));
 assert.throws(()=>createPolygonRegion(bad,createHash("sha256").update(bad).digest("hex")));
 assert.equal(inside(()=>{throw Error("bad")},0,0),false);
});
const origin={lat:-7.4,lon:-41.4},target={lat:-7.2,lon:-41.2};
test("legacy default preserved, explicit server policy required",()=>{
 assert.equal(routeBody(origin,target),null);
 const body=routeBody(origin,target,contains);assert.ok(body);
 assert.equal(normalizeRoute(body),null);assert.deepEqual(normalizeRoute(body,contains),body);
 assert.equal(routeBody(origin,{lat:-7.75,lon:-41.75},contains),null);
});
test("issuer and gateway agree on a signed exact route under explicit scope",async()=>{
 const ids=Array.from({length:5},(_,i)=>"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
 const request={rideId:ids[3],phase:"PICKUP",origin,target};
 const proof={authUserId:ids[0],profileUserId:ids[1],driverId:ids[2],rideId:ids[3],assignedDriverId:ids[2],acceptedDriverId:ids[2],status:"motorista_a_caminho",category:"carros",intermediateStops:0,verifiedAt:100000,targetEvidence:{id:ids[4],version:1,rideId:ids[3],phase:"PICKUP",source:"INDEPENDENT_OSM",point:target}};
 const k=generateKeyPairSync("ed25519"),cfg={privateKey:k.privateKey,principalKey:randomBytes(32),audience:"synthetic-region",now:()=>100000,readAuthority:async()=>proof};
 assert.equal((await createRouteIssuer(cfg)({},request)).status,400);
 const issue=createRouteIssuer({...cfg,contains});const r=await issue({},request);assert.equal(r.status,200);
 const auth=createRouteAuthorization({publicKey:k.publicKey,audience:cfg.audience,now:cfg.now});
 const grant=auth("Bearer "+r.token,normalizeRoute(routeBody(origin,target,contains),contains));assert.equal(grant.status,200);grant.release();
 assert.equal((await issue({}, {...request,target:{lat:-7.75,lon:-41.75}})).status,400);
});
