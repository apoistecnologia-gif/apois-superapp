import assert from "node:assert/strict";
import test from "node:test";
import {ConfirmedNavigationLaunch} from "./confirmed-navigation-launch.mjs";
const rideId="00000000-0000-4000-8000-000000000001";
const driverId="00000000-0000-4000-8000-000000000002";
const identity={authUserId:"00000000-0000-4000-8000-000000000003",profileUserId:"00000000-0000-4000-8000-000000000004",driverId};
const proof=(status="motorista_a_caminho",owner=driverId)=>({identity:{...identity},row:{id:rideId,status,driver_id:owner,accepted_driver_id:owner}});
const request=(openExternal=async()=>{},phase="PICKUP")=>({rideId,phase,openExternal});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
test("disabled preserves original external call and does not query or touch native",async()=>{
  let ext=0;const never=()=>{throw Error("must not run");};
  const x=new ConfirmedNavigationLaunch({verify:never,openNative:never,closeNative:never});
  assert.equal(await x.launch(request(async()=>{ext++;})),"external");
  assert.equal(ext,1);
  await assert.rejects(x.launch(request(async()=>{throw Error("original");})),/original/);
});
test("reject unassigned, queued, wrong phase, conflicting owners and missing identity",async()=>{
  for(const p of [null,proof("procurar_motorista"),proof("em_viagem"),proof("motorista_a_caminho",identity.authUserId),
    {...proof(),identity:{}},{...proof(),row:{...proof().row,driver_id:identity.authUserId}}]){
    const never=()=>{throw Error("must not run");};
    const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>p,openNative:never,closeNative:never});
    assert.equal(await x.launch(request(never)),"unverified");
  }
});
test("PIN-confirmed TRIP passes minimal payload, duplicate open blocked and logout closes",async()=>{
  const closed=[];let payload;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof("em_viagem"),
    openNative:async r=>{payload=r;return {state:"opened",sessionId:"s1"};},
    closeNative:async s=>{closed.push(s);return true;}});
  assert.equal(await x.launch(request(async()=>{throw Error("external");},"TRIP")),"internal");
  assert.deepEqual(payload,{rideId,phase:"TRIP",revision:0});
  assert.equal(await x.launch(request()),"busy");
  assert.equal(await x.invalidate(),true);
  assert.deepEqual(closed,["s1"]);
});
test("only definite unavailable permits fallback after fresh verification",async()=>{
  let ext=0,verifies=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>{verifies++;return proof();},
    openNative:async()=>({state:"unavailable"})});
  assert.equal(await x.launch(request(async()=>{ext++;})),"external");
  assert.equal(ext,1);assert.equal(verifies,2);
});
test("account or ownership change during native attempt prevents fallback",async()=>{
  for(const second of [proof("motorista_chegou"),proof("motorista_a_caminho",identity.authUserId),
    {...proof(),identity:{...identity,authUserId:identity.profileUserId}}]){
    let reads=0,external=0;
    const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>++reads===1?proof():second,
      openNative:async()=>({state:"unavailable"})});
    assert.equal(await x.launch(request(async()=>{external++;})),"unverified");
    assert.equal(external,0);
  }
});
test("logout during verification blocks stale response",async()=>{
  const d=deferred();let native=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:()=>d.promise,openNative:async()=>{native++;}});
  const launch=x.launch(request());await x.invalidate();d.resolve(proof());
  assert.equal(await launch,"stale");assert.equal(native,0);
});
test("late native acknowledgement after revocation closes that session only",async()=>{
  const d=deferred(),entered=deferred(),closed=[];
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    openNative:()=>{entered.resolve();return d.promise;},closeNative:async s=>{closed.push(s);return true;}});
  const p=x.launch(request());await entered.promise;
  assert.equal(await x.launch(request()),"busy");
  await x.invalidate();d.resolve({state:"opened",sessionId:"late"});
  assert.equal(await p,"stale");assert.deepEqual(closed,["late"]);
});
test("ambiguous native response or rejection blocks fallback and future openings",async()=>{
  for(const openNative of [async()=>{throw Error("timeout");},async()=>({state:"opened"}),async()=>null]){
    let ext=0;
    const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),openNative});
    assert.equal(await x.launch(request(async()=>{ext++;})),"uncertain");
    assert.equal(await x.launch(request(async()=>{ext++;})),"uncertain");
    assert.equal(await x.invalidate(),false);assert.equal(ext,0);
  }
});
test("failed closure prevents another navigator session",async()=>{
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),openNative:async()=>({state:"opened",sessionId:"s"}),closeNative:async()=>false});
  assert.equal(await x.launch(request()),"internal");
  assert.equal(await x.invalidate(),false);
  assert.equal(await x.launch(request()),"uncertain");
});
