import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes} from "node:crypto";
import {createRouteIssuer,routeBody} from "./route-issuer.mjs";
import {createRouteAuthorization} from "./route-authorization.mjs";
const ids=Array.from({length:6},(_,i)=>"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
const req=()=>({rideId:ids[3],phase:"PICKUP",origin:{lat:-9.4,lon:-40.5},target:{lat:-9.42,lon:-40.51}});
const proof=()=>({authUserId:ids[0],profileUserId:ids[1],driverId:ids[2],rideId:ids[3],
  assignedDriverId:ids[2],acceptedDriverId:ids[2],status:"motorista_a_caminho",category:"carros",intermediateStops:0,verifiedAt:100000,
  targetEvidence:{id:ids[4],version:1,rideId:ids[3],phase:"PICKUP",source:"INDEPENDENT_OSM",point:req().target}});
const keys=generateKeyPairSync("ed25519");
const principalKey=randomBytes(32);
const fixture=(readAuthority=async()=>proof(),options={})=>createRouteIssuer({privateKey:keys.privateKey,principalKey,audience:"local-lab",
  now:()=>100000,readAuthority,...options});
test("trusted proof issues a valid gateway credential bound to exact route",async()=>{
  const issue=fixture();
  const r=await issue({},req());assert.equal(r.status,200);
  const auth=createRouteAuthorization({publicKey:keys.publicKey,audience:"local-lab",now:()=>100000});
  const grant=auth("Bearer "+r.token,routeBody(req().origin,req().target));
  assert.equal(grant.status,200);grant.release();
  assert.equal(auth("Bearer "+r.token,routeBody(req().origin,req().target)).status,403);
  const claims=JSON.parse(Buffer.from(r.token.split(".")[0],"base64url"));
  assert.equal(claims.exp-claims.iat,30000);
  assert.ok(!JSON.stringify(claims).includes(ids[2]));
  const second=await issue({},req());
  const next=JSON.parse(Buffer.from(second.token.split(".")[0],"base64url"));
  assert.equal(next.sub,claims.sub);assert.notEqual(next.jti,claims.jti);
});
test("rejects absent session and extra client-supplied identity or provenance",async()=>{
  let reads=0;const issue=fixture(async()=>{reads++;return proof();});
  assert.equal((await issue(null,req())).status,401);
  for(const r of [{...req(),driverId:ids[2]},{...req(),source:"INDEPENDENT_OSM"},{...req(),phase:"__proto__"},{...req(),phase:["PICKUP"]},{...req(),origin:{lat:0,lon:0}}]){
    assert.equal((await issue({},r)).status,400);
  }
  assert.equal(reads,0);
});
test("requires current assigned car ride with zero stops and fresh authenticated read",async()=>{
  for(const patch of [{authUserId:null},{assignedDriverId:ids[5]},{acceptedDriverId:ids[5]},{rideId:ids[5]},
    {status:"cancelada"},{category:"motos"},{intermediateStops:1},{intermediateStops:null},{verifiedAt:94999},{verifiedAt:100001}]){
    const r=await fixture(async()=>({...proof(),...patch}))({},req());assert.equal(r.status,403);
  }
});
test("independent server evidence must match exact target, ride and leg",async()=>{
  for(const patch of [{source:"GOOGLE"},{source:"UNKNOWN"},{id:null},{version:0},{rideId:ids[5]},{phase:"TRIP"},{point:{lat:-9.43,lon:-40.51}}]){
    const r=await fixture(async()=>({...proof(),targetEvidence:{...proof().targetEvidence,...patch}}))({},req());
    assert.equal(r.status,403);
  }
  assert.equal((await fixture(async()=>({...proof(),targetEvidence:null}))({},req())).status,403);
});
test("request mutation while trusted read is pending cannot change signed route",async()=>{
  let release;const issue=fixture(()=>new Promise(r=>{release=r;}));
  const request=req(),pending=issue({},request);
  await Promise.resolve();request.target.lat=-9.43;release(proof());
  const r=await pending;assert.equal(r.status,200);
  const auth=createRouteAuthorization({publicKey:keys.publicKey,audience:"local-lab",now:()=>100000});
  assert.equal(auth("Bearer "+r.token,routeBody(request.origin,request.target)).status,403);
  const grant=auth("Bearer "+r.token,routeBody(req().origin,req().target));assert.equal(grant.status,200);grant.release();
});
test("timeout holds capacity until noncooperative authority settles, no late credential",async()=>{
  let finish,signal;
  const issue=fixture((_session,_request,s)=>{signal=s;return new Promise(r=>{finish=r;});},{timeout:25,maxPending:1});
  const result=await issue({},req());assert.equal(result.status,503);assert.equal(signal.aborted,true);
  assert.equal((await issue({},req())).status,429);
  finish(proof());await Promise.resolve();await Promise.resolve();
  // A subsequent read can enter again; it must independently finish.
  const next=issue({},req());await Promise.resolve();finish(proof());
  assert.equal((await next).status,200);
});
test("authority errors and clock regression cannot sign",async()=>{
  assert.equal((await fixture(async()=>{throw Error("private");})({},req())).status,503);
  let t=100000;const issue=fixture(async()=>{t=99999;return proof();},{now:()=>t});
  assert.equal((await issue({},req())).status,503);
});
