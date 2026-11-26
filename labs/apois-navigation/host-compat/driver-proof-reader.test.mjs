import test from 'node:test'
import assert from 'node:assert/strict'
import {createDriverProofReader} from './driver-proof-reader.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const request={rideId:id(1),phase:'PICKUP'},auth=id(2),driver=id(3),profile=id(4)
const valid={getSession:async()=>({userId:auth,token:'synthetic-token'}),getUser:async t=>{assert.equal(t,'synthetic-token');return auth},readProfile:async()=>({id:driver,user_id:profile}),readRide:async()=>({id:request.rideId,status:'motorista_a_caminho',driver_id:driver,accepted_driver_id:driver,category:'carros'})}
test('exact session and ride proof return only typed identity and row',async()=>{
 const p=await createDriverProofReader(valid)(request)
 assert.deepEqual(p.identity,{authUserId:auth,driverId:driver,profileUserId:profile})
 assert.equal(p.row.id,request.rideId);assert.equal('token' in p,false)
})
test('token rotation, logout, wrong identity and wrong phase fail closed',async()=>{
 let n=0
 const r=createDriverProofReader({...valid,getSession:async()=>({userId:auth,token:++n===1?'synthetic-token':'changed'})})
 assert.equal(await r(request),null)
 assert.equal(await createDriverProofReader({...valid,getUser:async()=>id(9)})(request),null)
 assert.equal(await createDriverProofReader(valid)({...request,phase:'TRIP'}),null)
 assert.equal(await createDriverProofReader({...valid,readRide:async()=>null})(request),null)
})
test('hung underlying read is bounded and not allowed to publish a late result',async()=>{
 let release,calls=0
 const r=createDriverProofReader({...valid,timeoutMs:50,maxPending:1,getSession:()=>{calls++;return new Promise(resolve=>release=resolve)}})
 assert.equal(await r(request),null)
 assert.equal(await r(request),null);assert.equal(calls,1)
 release({userId:auth,token:'synthetic-token'});await new Promise(r=>setImmediate(r))
})
