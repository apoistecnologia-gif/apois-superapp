import assert from 'node:assert/strict'
import test from 'node:test'
import {createDirectLocalDriverEdge} from './driver-direct-edge-v21.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(1),driver=id(2),profile=id(3),ride=id(4),other=id(5),token='e30.e30.synthetic'
const body={action:'target',rideId:ride,phase:'PICKUP'}
const proof=()=>({authUserId:actor,profileUserId:profile,driverId:driver,rideId:ride,status:'motorista_a_caminho',assignedDriverId:driver,acceptedDriverId:driver,category:'carros',intermediateStops:0,verifiedAt:Date.now(),targetEvidence:{id:id(6),version:1,rideId:ride,phase:'PICKUP',source:'INDEPENDENT_OSM',point:{lat:-9.4,lon:-40.5}}})
const request=(b=body,t=token)=>new Request('https://fixture.invalid/driver',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(b)})
const options={enabled:true,verifySession:async t=>t===token?actor:null,allowPilot:u=>u===actor,readLimited:async()=>({limited:false,proof:proof()})}
test('target-only, exact identity, no broker and no client coordinates',async()=>{
 let reads=0
 const handle=createDirectLocalDriverEdge({...options,readLimited:async p=>{reads++;assert.deepEqual(p,{authUserId:actor,rideId:ride,phase:'PICKUP'});return {limited:false,proof:proof()}}})
 assert.equal((await handle(request({action:'permit',rideId:ride,phase:'PICKUP'}))).status,409)
 assert.equal((await handle(request({...body,authUserId:actor}))).status,422)
 assert.equal((await handle(request(body,'bad'))).status,401)
 assert.equal(reads,0)
 const r=await handle(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).target.evidence.point,{lat:-9.4,lon:-40.5});assert.equal(reads,1)
 assert.equal((await createDirectLocalDriverEdge()(request())).status,409)
})
test('rate denial, revocation after proof, wrong identity and stale target',async()=>{
 assert.equal((await createDirectLocalDriverEdge({...options,readLimited:async()=>({limited:true,proof:null})})(request())).status,429)
 let checks=0
 assert.equal((await createDirectLocalDriverEdge({...options,verifySession:async()=>++checks===1?actor:null})(request())).status,401)
 assert.equal((await createDirectLocalDriverEdge({...options,readLimited:async()=>({limited:false,proof:{...proof(),authUserId:other}})})(request())).status,403)
 assert.equal((await createDirectLocalDriverEdge({...options,readLimited:async()=>({limited:false,proof:{...proof(),verifiedAt:Date.now()-6000}})})(request())).status,403)
})
test('bounded underlying requests cannot multiply after timeout',async()=>{
 let release;const held=new Promise(r=>{release=r})
 const handle=createDirectLocalDriverEdge({...options,timeoutMs:50,maxPending:1,readLimited:()=>held})
 assert.equal((await handle(request())).status,503)
 assert.equal((await handle(request())).status,429)
 release({limited:false,proof:proof()})
})
