import test from 'node:test'
import assert from 'node:assert/strict'
import {createPilotRuntime} from './pilot-runtime.mjs'
const account='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002'
function fixture(){
 let current=account,entry=null,active=null,closed=0,network=0
 const auth={getUser:async token=>({data:{user:{id:token?token.slice(10):current}}}),getSession:async()=>({data:{session:{user:{id:current},access_token:'synthetic-'+current}}})}
 const runtime=createPilotRuntime({installed:true,auth,invoke:async(_,options)=>{network++;assert.equal(options.body.action,'apois_navigation_active');return {data:{verified:true,ride:active}}},journalFactory:async()=>({read:async()=>entry,close:()=>closed++}),locks:{request:(_,__,work)=>work()}})
 return {runtime,setEntry:v=>entry=v,setActive:v=>active=v,setAccount:v=>current=v,stats:()=>({closed,network})}
}
test('default path invokes original once without touching auth, journal or locks',async()=>{
 const runtime=createPilotRuntime({installed:false,auth:null,journalFactory:()=>{throw Error('must not run')}})
 let calls=0;assert.equal(await runtime.legacy(async headers=>{assert.equal(headers,undefined);calls++;return 42}),42);assert.equal(calls,1);assert.equal(await runtime.pending(),false)
})
test('installed guard blocks pending journal and active rides; passes explicit verified token',async()=>{
 const f=fixture();let calls=0;const work=async headers=>{calls++;assert.equal(headers.Authorization,'Bearer synthetic-'+account);return 7}
 f.setEntry({requestKey:'pending'});assert.equal(await f.runtime.pending(account),true);await assert.rejects(()=>f.runtime.legacy(work,account));assert.equal(calls,0)
 f.setEntry(null);f.setActive({rideId:'ride'});await assert.rejects(()=>f.runtime.legacy(work,account));assert.equal(calls,0)
 f.setActive(null);assert.equal(await f.runtime.legacy(work,account),7);assert.equal(calls,1);assert.equal(f.stats().closed,4)
})
test('account mismatch and offline verification fail closed',async()=>{
 const f=fixture();f.setAccount(other);await assert.rejects(()=>f.runtime.legacy(async()=>{throw Error('unexpected')},account));assert.equal(f.stats().network,0)
 const runtime=createPilotRuntime({installed:true,auth:{getUser:async()=>{throw Error('offline')}}})
 await assert.rejects(()=>runtime.legacy(async()=>{throw Error('unexpected')}))
})
