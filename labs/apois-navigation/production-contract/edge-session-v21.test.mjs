import test from 'node:test'
import assert from 'node:assert/strict'
import {bearerToken,createV21EdgeSession} from './edge-session-v21.mjs'
const url='https://abcdefghijklmnopqrst.supabase.co',uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002'
const token=['e30',Buffer.from(JSON.stringify({iss:url+'/auth/v1',aud:'authenticated',role:'authenticated',sub:uid,session_id:sid,iat:90,exp:200})).toString('base64url'),'synthetic-signature'].join('.')
const signal=()=>new AbortController().signal
test('exact Bearer format, not arbitrary identities or extra credentials',()=>{
 assert.equal(bearerToken('Bearer '+token),token)
 for(const x of [null,'Bearer '+uid,'Bearer  '+token,'Bearer '+token+'\n','bearer '+token,'Bearer '+token+' extra'])assert.equal(bearerToken(x),null)
})
test('verified token binds the restricted session RPC; deletion and mismatch fail closed',async()=>{
 let active=true,calls=0,identity=uid
 const opts={projectUrl:url,sessionPolicyConfirmed:true,now:()=>100000,
  authClient:{auth:{getUser:async t=>{assert.equal(t,token);return {data:{user:{id:identity}}}}}},
  serviceClient:{rpc:(name,args)=>{calls++;assert.equal(name,'apois_nav_lab_session_exists_v21');assert.deepEqual(args,{p_auth_user:uid,p_session:sid});return {abortSignal:async s=>{assert.ok(s instanceof AbortSignal);return {data:active}}}}}}
 assert.throws(()=>createV21EdgeSession({...opts,sessionPolicyConfirmed:false}))
 const verify=createV21EdgeSession(opts)
 assert.equal(await verify(token,signal()),uid)
 active=false;assert.equal(await verify(token,signal()),null)
 identity=sid;assert.equal(await verify(token,signal()),null);assert.equal(calls,2)
})
test('RPC failure is unavailable rather than an authorized session',async()=>{
 const v=createV21EdgeSession({projectUrl:url,sessionPolicyConfirmed:true,now:()=>100000,
 authClient:{auth:{getUser:async()=>({data:{user:{id:uid}}})}},
 serviceClient:{rpc:()=>({abortSignal:async()=>({data:true,error:{code:'fixture_failure'}})})}})
 await assert.rejects(v(token,signal()),{message:'Session verification unavailable'})
})
