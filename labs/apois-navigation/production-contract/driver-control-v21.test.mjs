import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,randomBytes} from 'node:crypto'
import {createDriverControl} from './driver-control-v21.mjs'
import {createDriverAuthority} from '../passenger-provenance-snapshot/driver-authority.mjs'
import {createRouteIssuer,routeBody} from '../valhalla/route-issuer.mjs'
import {createRouteAuthorization} from '../valhalla/route-authorization.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(1),driver=id(2),profile=id(3),ride=id(4),evidence=id(5),p={lat:-9.4,lon:-40.5},origin={lat:-9.42,lon:-40.51}
function fixture(){
 let allowed=true,valid=true,version=1,reads=0,changeDuringIssuance=false
 const authority=createDriverAuthority({verifySession:async s=>s==='synthetic-session'?actor:null,readDriverProof:async({authUserId,rideId,phase})=>{
  reads++
  if(!valid||authUserId!==actor||rideId!==ride||phase!=='PICKUP')return null
  if(changeDuringIssuance&&reads===2)return null
  return {authUserId:actor,profileUserId:profile,driverId:driver,rideId:ride,status:'motorista_a_caminho',assignedDriverId:driver,acceptedDriverId:driver,category:'carros',intermediateStops:0,verifiedAt:Date.now(),targetEvidence:{id:evidence,version,rideId:ride,phase,source:'INDEPENDENT_OSM',point:p}}
 }})
 const keys=generateKeyPairSync('ed25519'),audience='driver-control-ci'
 const issuer=createRouteIssuer({privateKey:keys.privateKey,principalKey:randomBytes(32),audience,readAuthority:authority})
 const control=createDriverControl({enabled:true,authority,issuePermit:issuer,allowPilot:u=>allowed&&u===actor})
 return {control,authorize:createRouteAuthorization({publicKey:keys.publicKey,audience}),allow:v=>allowed=v,valid:v=>valid=v,version:v=>version=v,change:v=>changeDuringIssuance=v,reads:()=>reads}
}
const target={action:'target',rideId:ride,phase:'PICKUP'}
const permit={action:'permit',rideId:ride,phase:'PICKUP',origin,evidenceId:evidence,evidenceVersion:1}
test('disabled by default; reject forged client identity/target and wrong account',async()=>{
 const f=fixture()
 assert.equal((await createDriverControl()('synthetic-session',target)).status,409)
 assert.equal((await f.control('bad',target)).status,403)
 assert.equal((await f.control('synthetic-session',{...target,driverId:driver})).status,422)
 assert.equal((await f.control('synthetic-session',{...permit,target:p})).status,422)
 assert.equal((await f.control('synthetic-session',{...target,phase:'TRIP'})).status,403)
 f.allow(false);assert.equal((await f.control('synthetic-session',target)).status,403)
})
test('proof and permit only for independently confirmed ride, exact route, single use',async()=>{
 const f=fixture()
 const read=await f.control('synthetic-session',target);assert.equal(read.status,200)
 assert.deepEqual(read.body.target.identity,{authUserId:actor,profileUserId:profile,driverId:driver})
 assert.deepEqual(read.body.target.evidence.point,p)
 const issued=await f.control('synthetic-session',permit);assert.equal(issued.status,200);assert.equal(f.reads(),3)
 const header='Bearer '+issued.body.token
 assert.equal(f.authorize(header,routeBody(p,origin)).status,403)
 const used=f.authorize(header,routeBody(origin,p));assert.equal(used.status,200);used.release()
 assert.equal(f.authorize(header,routeBody(origin,p)).status,403)
 f.version(2);assert.equal((await f.control('synthetic-session',permit)).status,409)
 f.valid(false);assert.equal((await f.control('synthetic-session',target)).status,403)
})
test('revocation between target lookup and issuer authority read denies permit',async()=>{
 const f=fixture();f.change(true);assert.equal((await f.control('synthetic-session',permit)).status,403);assert.equal(f.reads(),2)
})

test('non-cooperative read times out, occupies capacity, cannot issue later',async()=>{
 let unblock,issued=0
 const f=createDriverControl({enabled:true,timeout:15,maxPending:1,allowPilot:()=>true,authority:()=>new Promise(r=>unblock=r),issuePermit:async()=>{issued++;return {status:503}}})
 assert.equal((await f('synthetic-session',permit)).status,503)
 assert.equal((await f('synthetic-session',target)).status,429)
 unblock(null);await new Promise(r=>setImmediate(r));assert.equal(issued,0)
})

test('local-only target contract needs no route key and refuses permit before authority',async()=>{
 let reads=0,time=10000,lag=0
 const proof={authUserId:actor,profileUserId:profile,driverId:driver,rideId:ride,status:'motorista_a_caminho',assignedDriverId:driver,acceptedDriverId:driver,category:'carros',intermediateStops:0,verifiedAt:10000,targetEvidence:{id:evidence,version:1,rideId:ride,phase:'PICKUP',source:'INDEPENDENT_OSM',point:p}}
 const cfg={enabled:true,localOnly:true,now:()=>time,authority:async()=>{reads++;return proof},allowPilot:()=>{time+=lag;return true}}
 assert.throws(()=>createDriverControl({...cfg,issuePermit:async()=>({})}))
 const f=createDriverControl(cfg)
 assert.equal((await f('synthetic-session',permit)).status,409);assert.equal(reads,0)
 assert.equal((await f('synthetic-session',{...target,origin})).status,422);assert.equal(reads,0)
 const r=await f('synthetic-session',target);assert.equal(r.status,200);assert.equal(r.body.target.evidence.id,evidence);assert.equal(reads,1)
 lag=5001;assert.equal((await f('synthetic-session',target)).status,403)
})
