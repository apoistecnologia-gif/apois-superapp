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

test("matching native Back clears session; unrelated or replay events do not",async()=>{
  let opens=0;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    openNative:async()=>({state:"opened",sessionId:"s"+(++opens)})});
  assert.equal(await x.launch(request()),"internal");
  for(const e of [{sessionId:"s2",rideId,revision:0,action:"SESSION_CLOSED"},
    {sessionId:"s1",rideId:"wrong",revision:0,action:"SESSION_CLOSED"},
    {sessionId:"s1",rideId,revision:1,action:"SESSION_CLOSED"},
    {sessionId:"s1",rideId,revision:0,action:"FINISH"}]){
    assert.equal(x.onNativeClosed(e),false);assert.equal(await x.launch(request()),"busy");
  }
  assert.equal(x.onNativeClosed({sessionId:"s1",rideId,revision:0,action:"SESSION_CLOSED"}),true);
  assert.equal(await x.launch(request()),"internal");
});
test("Back before open acknowledgement never leaves a ghost native session",async()=>{
  const entered=deferred(),d=deferred();
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),openNative:()=>{entered.resolve();return d.promise;}});
  const p=x.launch(request());await entered.promise;
  assert.equal(x.onNativeClosed({sessionId:"s1",rideId,revision:0,action:"SESSION_CLOSED"}),true);
  d.resolve({state:"opened",sessionId:"s1"});
  assert.equal(await p,"stale");assert.equal(await x.recheck(),"idle");
});
test("active session recheck revokes missing row, phase or ownership; no auto fallback",async()=>{
  for(const next of [null,proof("motorista_chegou"),proof("motorista_a_caminho",identity.authUserId),
    {...proof(),identity:{...identity,authUserId:identity.profileUserId}}]){
    let reads=0,closed=0;const x=new ConfirmedNavigationLaunch({enabled:true,
      verify:async()=>++reads===1?proof():next,openNative:async()=>({state:"opened",sessionId:"s"}),
      closeNative:async()=>{closed++;return true;}});
    assert.equal(await x.launch(request()),"internal");assert.equal(await x.recheck(),"revoked");
    assert.equal(closed,1);assert.equal(await x.recheck(),"idle");
  }
});
test("current proof preserves session; UI mismatch only triggers recheck",async()=>{
  let reads=0;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>{reads++;return proof();},
    openNative:async()=>({state:"opened",sessionId:"s"})});
  await x.launch(request());await x.observeRide(null,null);
  assert.equal(reads,2);assert.equal(await x.launch(request()),"busy");
  await x.observeRide(rideId,"motorista_a_caminho");assert.equal(reads,2);
});
test("late recheck cannot revoke newer session",async()=>{
  const d=deferred();let reads=0,opens=0,closes=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:()=>++reads===2?d.promise:Promise.resolve(proof()),
    openNative:async()=>({state:"opened",sessionId:"s"+(++opens)}),closeNative:async()=>{closes++;return true;}});
  await x.launch(request());const old=x.recheck();await x.invalidate();await x.launch(request());
  d.resolve(null);assert.equal(await old,"stale");assert.equal(closes,1);assert.equal(await x.launch(request()),"busy");
});

test("audio scope is not touched in default external mode",async()=>{
  const x=new ConfirmedNavigationLaunch({prepareAudio:()=>{throw Error("must not stop");}});
  assert.equal(await x.launch(request()),"external");
});
test("failed audio preparation never attempts native opening",async()=>{
  let opens=0;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio:async()=>null,openNative:async()=>{opens++;}});
  assert.equal(await x.launch(request()),"unverified");assert.equal(opens,0);
});
test("audio scope follows confirmed session closure, not unrelated events",async()=>{
  let releases=0;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio:async()=>()=>{releases++;},
    openNative:async()=>({state:"opened",sessionId:"audio"})});
  assert.equal(await x.launch(request()),"internal");assert.equal(releases,0);
  assert.equal(x.onNativeClosed({sessionId:"old",rideId,revision:0,action:"SESSION_CLOSED"}),false);
  assert.equal(releases,0);
  assert.equal(x.onNativeClosed({sessionId:"audio",rideId,revision:0,action:"SESSION_CLOSED"}),true);
  assert.equal(releases,1);
});
test("definitive unavailable releases audio before original external callback",async()=>{
  let released=false;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    prepareAudio:async()=>()=>{released=true;},openNative:async()=>({state:"unavailable"})});
  assert.equal(await x.launch(request(async()=>assert.equal(released,true))),"external");
});
test("ambiguous native opening and failed close retain audio suppression",async()=>{
  let releases=0;const prepareAudio=async()=>()=>{releases++;};
  const a=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio,openNative:async()=>{throw Error("timeout");}});
  assert.equal(await a.launch(request()),"uncertain");assert.equal(releases,0);
  const b=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio,
    openNative:async()=>({state:"opened",sessionId:"audio"}),closeNative:async()=>false});
  assert.equal(await b.launch(request()),"internal");assert.equal(await b.invalidate(),false);assert.equal(releases,0);
});
test("revocation while preparing audio releases scope without opening native",async()=>{
  const entered=deferred(),d=deferred();let releases=0,opens=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio:()=>{entered.resolve();return d.promise;},openNative:async()=>{opens++;}});
  const p=x.launch(request());await entered.promise;await x.invalidate();d.resolve(()=>{releases++;});
  assert.equal(await p,"stale");assert.equal(releases,1);assert.equal(opens,0);
});
test("confirmed close acknowledgement releases audio once",async()=>{
  let releases=0;const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),prepareAudio:async()=>()=>{releases++;},
    openNative:async()=>({state:"opened",sessionId:"audio"}),closeNative:async()=>true});
  await x.launch(request());assert.equal(await x.invalidate(),true);
  assert.equal(releases,1);assert.equal(x.onNativeClosed({sessionId:"audio",rideId,revision:0,action:"SESSION_CLOSED"}),false);
  assert.equal(releases,1);
});

test("logout during native preparation cancels exact request, then closes late opening",async()=>{
  const d=deferred(),entered=deferred(),cancelled=[],closed=[];let external=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    openNative:()=>{entered.resolve();return d.promise;},
    cancelNativePreparation:async r=>{cancelled.push(r);return true;},
    closeNative:async id=>{closed.push(id);return true;}});
  const p=x.launch(request(async()=>{external++;}));await entered.promise;
  assert.equal(await x.invalidate(),false);
  assert.deepEqual(cancelled,[{rideId,phase:"PICKUP",revision:0}]);
  d.resolve({state:"opened",sessionId:"late"});
  assert.equal(await p,"stale");assert.deepEqual(closed,["late"]);assert.equal(external,0);
});
test("late listener setup observes revoked epoch before starting native",async()=>{
  const d=deferred(),entered=deferred();let opens=0,external=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    openNative:async(_r,current)=>{entered.resolve();await d.promise;if(!current())return {state:"unavailable"};opens++;return {state:"opened",sessionId:"late"};},
    cancelNativePreparation:async()=>false});
  const p=x.launch(request(async()=>{external++;}));await entered.promise;
  await x.invalidate();d.resolve();
  assert.equal(await p,"stale");assert.equal(opens,0);assert.equal(external,0);
});
test("failed cancellation does not unlock ambiguous open",async()=>{
  const d=deferred(),entered=deferred();let external=0;
  const x=new ConfirmedNavigationLaunch({enabled:true,verify:async()=>proof(),
    openNative:()=>{entered.resolve();return d.promise;},cancelNativePreparation:async()=>{throw Error("unavailable");}});
  const p=x.launch(request(async()=>{external++;}));await entered.promise;
  await x.invalidate();d.reject(Error("timeout"));
  assert.equal(await p,"stale");assert.equal(await x.launch(request()),"uncertain");assert.equal(external,0);
});
