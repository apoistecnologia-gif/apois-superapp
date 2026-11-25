import test from 'node:test';
import assert from 'node:assert/strict';
import {MotoristaAuthority} from './motorista-authority.mjs';
import {MotoristaIntentDispatcher} from './motorista-intent-dispatcher.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const identity={authUserId:id(1),profileUserId:id(2),driverId:id(3)};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
function setup({verify=async()=>true,handlers={},status="em_viagem"}={}){
 const g=new MotoristaAuthority();g.bind(identity);
 const update=(status,revision)=>g.accept({id:id(4),driver_id:id(3),status},{epoch:g.epoch,authUserId:id(1),driverId:id(3),revision});
 update(status,1);const d=new MotoristaIntentDispatcher(g,{verify,handlers});assert.equal(d.attach("native-1"),true);
 const event=(action,extras={})=>({sessionId:"native-1",rideId:id(4),revision:g.snapshot?.revision,action,...extras});
 return {g,d,update,event};
}
test('original finish handler receives only authorized intent, no price or PIN',async()=>{
 let got;const {g,d,event}=setup({handlers:{FINISH:t=>{got=t;return true;}}});
 assert.equal(await d.receive(event("FINISH",{price:99,pin:"0000"})),"handled");
 assert.deepEqual(Object.keys(got).sort(),["action","epoch","revision","rideId"].sort());
 assert.equal(g.snapshot.phase,"TRIP");
});
test('late verification after account switch cannot invoke handler',async()=>{
 const wait=deferred();let calls=0;const {g,d,event}=setup({verify:()=>wait.promise,handlers:{FINISH:()=>{calls++;return true;}}});
 const pending=d.receive(event("FINISH"));g.bind({...identity,authUserId:id(8)});wait.resolve(true);
 assert.equal(await pending,"stale");assert.equal(calls,0);
});
test('native close during verification prevents action and old close cannot detach new session',async()=>{
 const wait=deferred();const {d,event}=setup({verify:()=>wait.promise,handlers:{FINISH:()=>assert.fail()}});
 const pending=d.receive(event("FINISH"));assert.equal(await d.receive(event("SESSION_CLOSED")),"closed");
 assert.equal(d.attach("native-2"),false);wait.resolve(true);assert.equal(await pending,"stale");
 assert.equal(d.attach("native-2"),true);assert.equal(await d.receive(event("SESSION_CLOSED")),"ignored");
});
test('snapshot update during verification invalidates ticket',async()=>{
 const wait=deferred();const {d,event,update}=setup({verify:()=>wait.promise,handlers:{FINISH:()=>assert.fail()}});
 const pending=d.receive(event("FINISH"));update("cancelada_passageiro",2);wait.resolve(true);
 assert.equal(await pending,"stale");
});
test('serializes handlers across authoritative revision changes',async()=>{
 const wait=deferred(),entered=deferred();let calls=0;
 const {d,event,update}=setup({handlers:{FINISH:()=>{calls++;entered.resolve();return wait.promise;}}});
 const pending=d.receive(event("FINISH"));await entered.promise;update("em_viagem",2);
 assert.equal(await d.receive(event("FINISH")),"blocked");
 wait.resolve(true);assert.equal(await pending,"stale");assert.equal(calls,1);
});
test('ambiguous finish requires newer authoritative state and explicit retry',async()=>{
 const {d,g,event,update}=setup({handlers:{FINISH:()=>{throw Error("transport");}}});
 assert.equal(await d.receive(event("FINISH")),"reconcile");
 assert.equal(await d.receive(event("FINISH")),"blocked");
 assert.equal(d.acknowledgeFinishReconciled({epoch:g.epoch,rideId:id(4),revision:1,explicitRetry:true}),false);
 update("em_viagem",2);
 assert.equal(d.acknowledgeFinishReconciled({epoch:g.epoch,rideId:id(4),revision:2}),false);
 assert.equal(d.acknowledgeFinishReconciled({epoch:g.epoch,rideId:id(4),revision:2,explicitRetry:true}),true);
});
test('failed verification and invalid action cannot invoke original handler',async()=>{
 const {d,event}=setup({verify:async()=>false,handlers:{FINISH:()=>assert.fail(),OPEN_PIN:()=>assert.fail()}});
 assert.equal(await d.receive(event("OPEN_PIN")),"blocked");
 assert.equal(await d.receive(event("FINISH")),"stale");
});
test('PIN is UI-only and rating is typed',async()=>{
 const {d,event,update}=setup({status:"motorista_chegou",handlers:{OPEN_PIN:t=>{assert.equal(t.action,"OPEN_PIN");assert.equal(t.pin,undefined);return true;},RATE:t=>{assert.equal(t.rating,5);return true;}}});
 assert.equal(await d.receive(event("OPEN_PIN",{pin:"0000"})),"handled");
 update("em_viagem",2);update("finalizada",3);
 assert.equal(await d.receive(event("RATE",{rating:5})),"handled");
});
