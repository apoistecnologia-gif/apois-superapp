import test from "node:test";
import assert from "node:assert/strict";
import {createRevocationReconciler} from "./revocation-reconciler.mjs";
import {routeLegScope} from "../valhalla/route-issuer.mjs";
const rideId="00000000-0000-4000-8000-000000000041",key=Buffer.alloc(32,1),audience="fixture";
const signal=()=>new AbortController().signal;
const fixture=patch=>createRevocationReconciler({readSnapshot:async()=>[{rideId,phase:"PICKUP"}],store:{revokeScope:()=>({status:200})},principalKey:key,audience,...patch});
test("reconciles opaque phase scope; repeated full read is safe",async()=>{
  const scopes=[];
  const r=fixture({store:{revokeScope:(scope)=>{scopes.push(scope);return {status:200};}}});
  assert.equal((await r(signal())).status,200);assert.equal((await r(signal())).status,200);
  assert.deepEqual(scopes,[routeLegScope(key,audience,rideId,"PICKUP"),routeLegScope(key,audience,rideId,"PICKUP")]);
});
test("failed, truncated, malformed or over-capacity snapshots refuse admission",async()=>{
  let calls=0;
  for(const readSnapshot of [async()=>{throw Error("db");},async()=>null,async()=>[{rideId,phase:"BAD"}],async()=>[{rideId,phase:"PICKUP"},{rideId,phase:"TRIP"}]]){
    const r=fixture({readSnapshot,maxRows:1,store:{revokeScope:()=>{calls++;return {status:200};}}});
    assert.equal((await r(signal())).status,503);
  }
  assert.equal(calls,0);
});
test("store failure denies; no concurrent or cancelled reconciliation",async()=>{
  assert.equal((await fixture({store:{revokeScope:()=>({status:503})}})(signal())).status,503);
  let resolve;const r=fixture({readSnapshot:()=>new Promise(r=>{resolve=r;})});const c=new AbortController();
  const work=r(c.signal);assert.equal((await r(signal())).status,503);c.abort();resolve([]);
  assert.equal((await work).status,503);
});
