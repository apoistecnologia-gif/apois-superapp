import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidanceHandoff} from './guidance-handoff.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('legacy guidance disabled before stop, native lease only after acknowledgement',async()=>{
 const wait=deferred();const g=new GuidanceHandoff({stopLegacy:()=>wait.promise,stopNative:async()=>true});
 const p=g.acquire();assert.equal(g.legacyAllowed(),false);assert.equal(await g.acquire(),null);
 wait.resolve(true);const lease=await p;assert.ok(lease);assert.equal(g.current(lease),true);
 assert.equal(await g.release(lease),true);assert.equal(g.legacyAllowed(),true);assert.equal(g.current(lease),false);
});
test('alert revokes native lease synchronously, resumes only after both queues stopped',async()=>{
 const wait=deferred();const g=new GuidanceHandoff({stopLegacy:async()=>true,stopNative:()=>wait.promise});
 const lease=await g.acquire();const p=g.interruptForAlert();
 assert.equal(g.current(lease),false);assert.equal(g.legacyAllowed(),false);
 wait.resolve(true);assert.equal(await p,true);assert.equal(g.legacyAllowed(),true);
});
test('late acquisition cannot revive guidance after alert interrupts it',async()=>{
 const wait=deferred();let stops=0;
 const g=new GuidanceHandoff({stopLegacy:()=>++stops===1?wait.promise:Promise.resolve(true),stopNative:async()=>true});
 const p=g.acquire();const alert=g.interruptForAlert();assert.equal(g.legacyAllowed(),false);
 wait.resolve(true);assert.equal(await p,null);assert.equal(await alert,true);assert.equal(g.legacyAllowed(),true);
});
test('failed stop never grants conflicting voice ownership',async()=>{
 const g=new GuidanceHandoff({stopLegacy:async()=>false,stopNative:async()=>true});
 assert.equal(await g.acquire(),null);assert.equal(g.state,"blocked");assert.equal(g.legacyAllowed(),false);
 assert.equal(await g.interruptForAlert(),false);
});
test('old lease cannot stop a replacement lease',async()=>{
 const g=new GuidanceHandoff({stopLegacy:async()=>true,stopNative:async()=>true});
 const a=await g.acquire();await g.release(a);const b=await g.acquire();
 assert.equal(await g.release(a),false);assert.equal(g.current(b),true);
});
