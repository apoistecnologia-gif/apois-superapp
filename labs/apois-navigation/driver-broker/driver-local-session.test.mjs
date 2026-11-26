import test from 'node:test'
import assert from 'node:assert/strict'
import {createLocalDriverSessionVerifier} from './driver-local-session.mjs'
const url='https://abcdefghijklmnopqrst.supabase.co',user='00000000-0000-4000-8000-000000000061',sid='00000000-0000-4000-8000-000000000081'
const token=(patch={})=>['e30',Buffer.from(JSON.stringify({iss:url+'/auth/v1',aud:'authenticated',role:'authenticated',sub:user,session_id:sid,iat:90,exp:200,...patch})).toString('base64url'),'synthetic-signature'].join('.')
const signal=()=>new AbortController().signal
const options={projectUrl:url,sessionPolicyConfirmed:true,now:()=>100000,getUser:async()=>({id:user}),sessionExists:async()=>true}
test('requires explicit supported session policy',()=>{
 assert.throws(()=>createLocalDriverSessionVerifier({...options,sessionPolicyConfirmed:false}))
 assert.throws(()=>createLocalDriverSessionVerifier({...options,projectUrl:'https://fixture.invalid'}))
})
test('verified exact token plus current private session',async()=>{
 const t=token()
 const v=createLocalDriverSessionVerifier({...options,getUser:async x=>{assert.equal(x,t);return {id:user}},sessionExists:async q=>{assert.deepEqual(q,{authUserId:user,sessionId:sid});return true}})
 assert.equal(await v(t,signal()),user)
})
test('invalid claims, mismatched Auth, deleted or expired session fail closed',async()=>{
 let calls=0
 const v=createLocalDriverSessionVerifier({...options,getUser:async()=>{calls++;return {id:user}}})
 for(const t of ['bad',token({exp:100}),token({iss:'https://other.invalid/auth/v1'}),token({session_id:null}),token({role:'service_role'}),token({is_anonymous:true})])assert.equal(await v(t,signal()),null)
 assert.equal(calls,0)
 for(const patch of [{getUser:async()=>({id:sid})},{getUser:async()=>null},{sessionExists:async()=>false},{sessionExists:async()=>({active:true})}])assert.equal(await createLocalDriverSessionVerifier({...options,...patch})(token(),signal()),null)
})
test('revocation/timeout never forwards a late auth result; bounded pending',async()=>{
 let release,reads=0
 const v=createLocalDriverSessionVerifier({...options,timeoutMs:50,maxPending:1,getUser:()=>new Promise(r=>release=r),sessionExists:async()=>{reads++;return true}})
 await assert.rejects(v(token(),signal()),{message:'Session verification unavailable'})
 await assert.rejects(v(token(),signal()),{message:'Session verification unavailable'})
 release({id:user});await new Promise(r=>setImmediate(r));assert.equal(reads,0)
 const ctrl=new AbortController()
 const c=createLocalDriverSessionVerifier({...options,sessionExists:async()=>{ctrl.abort();return true}})
 await assert.rejects(c(token(),ctrl.signal),{message:'Session verification unavailable'})
})
test('expiry while checking cannot issue proof',async()=>{
 let time=100000
 const v=createLocalDriverSessionVerifier({...options,now:()=>time,sessionExists:async()=>{time=200000;return true}})
 assert.equal(await v(token(),signal()),null)
})
