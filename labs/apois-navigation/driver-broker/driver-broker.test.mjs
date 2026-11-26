import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,generateKeyPairSync} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDriverBroker} from './driver-broker.mjs'
import {createDriverProxy} from './driver-proxy.mjs'
import {createDriverSigner} from './driver-protocol.mjs'
import {openRouteReplayStore} from '../valhalla/route-replay-store.mjs'
import {routeBody} from '../valhalla/route-issuer.mjs'
import {createRouteAuthorization} from '../valhalla/route-authorization.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(1),driver=id(2),profile=id(3),ride=id(4),evidence=id(5),p={lat:-9.4,lon:-40.5},origin={lat:-9.42,lon:-40.51}
test('authenticated proxy, HMAC, durable replay rejection, scoped route permits',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'apois-driver-broker-'))
 const key={keyId:'fixture',secret:randomBytes(32).toString('base64url')},keys=generateKeyPairSync('ed25519'),principalKey=randomBytes(32),audience='driver-broker-fixture'
 const path=join(dir,'admissions.db')
 let admissionStore=openRouteReplayStore({path,initialize:true,perMinute:30}),issuanceStore=openRouteReplayStore({path:join(dir,'issued.db'),initialize:true,requireIssued:true,requireScoped:true}),allowed=true,valid=true
 const allowPilot=u=>allowed&&u===actor
 const readDriverProof=async({authUserId,rideId,phase})=>valid&&authUserId===actor&&rideId===ride&&phase==='PICKUP'?{authUserId:actor,profileUserId:profile,driverId:driver,rideId:ride,status:'motorista_a_caminho',assignedDriverId:driver,acceptedDriverId:driver,category:'carros',intermediateStops:0,verifiedAt:Date.now(),targetEvidence:{id:evidence,version:1,rideId:ride,phase,source:'INDEPENDENT_OSM',point:p}}:null
 const open=()=>createDriverBroker({enabled:true,keys:[key],admissionStore,issuanceStore,allowPilot,readDriverProof,privateKey:keys.privateKey,principalKey,audience})
 let broker=await open(),last
 const endpoint='https://fixture.invalid/driver-control',target={action:'target',rideId:ride,phase:'PICKUP'}
 const proxy=createDriverProxy({enabled:true,endpoint,...key,allowPilot,verifySession:async t=>t==='private-login-jwt'?actor:null,fetcher:async(url,opts)=>{assert.equal(url.href,endpoint);assert.equal(opts.redirect,'error');assert.ok(!JSON.stringify(opts).includes('private-login-jwt'));last={...opts};return broker(new Request(url,opts))}})
 const request=(body,token='private-login-jwt')=>new Request('https://edge.invalid/driver',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)})
 try{
 assert.equal((await proxy(request(target,'bad'))).status,401)
 assert.equal((await proxy(request(target))).status,200)
 const replay=last;assert.equal((await broker(new Request(endpoint,replay))).status,403)
 admissionStore.close();admissionStore=openRouteReplayStore({path,perMinute:30});broker=await open()
 assert.equal((await broker(new Request(endpoint,replay))).status,403)
 const body={authUserId:actor,request:target},signed=await(await createDriverSigner({...key,authUserId:actor}))(body)
 assert.equal((await broker(new Request(endpoint,{method:'POST',headers:{Authorization:signed,'Content-Type':'application/json'},body:JSON.stringify({...body,authUserId:id(7)})}))).status,403)
 assert.equal((await proxy(request({...target,authUserId:actor}))).status,422)
 const permit=await proxy(request({action:'permit',rideId:ride,phase:'PICKUP',origin,evidenceId:evidence,evidenceVersion:1}))
 assert.equal(permit.status,200);const {token}=await permit.json()
 const authorize=createRouteAuthorization({publicKey:keys.publicKey,audience,store:issuanceStore})
 const lease=authorize('Bearer '+token,routeBody(origin,p));assert.equal(lease.status,200);lease.release();assert.equal(authorize('Bearer '+token,routeBody(origin,p)).status,403)
 valid=false;assert.equal((await proxy(request(target))).status,403)
 allowed=false;assert.equal((await proxy(request(target))).status,403)
 assert.equal((await createDriverProxy()(request(target))).status,409)
 console.log('APOIS_DRIVER_BROKER_OK')
 }finally{admissionStore.close();issuanceStore.close();rmSync(dir,{recursive:true,force:true})}
})

test('local-only authenticated proxy and broker run without signing or issuance store',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'apois-local-driver-'))
 const key={keyId:'fixture',secret:randomBytes(32).toString('base64url')}
 const admissionStore=openRouteReplayStore({path:join(dir,'admission.db'),initialize:true,perMinute:30})
 let reads=0,forwarded=0,valid=true
 const allowPilot=u=>u===actor
 const cfg={enabled:true,localOnly:true,keys:[key],admissionStore,allowPilot,readDriverProof:async({authUserId,rideId,phase})=>{
  reads++;return valid&&authUserId===actor&&rideId===ride&&phase==='PICKUP'?{authUserId:actor,profileUserId:profile,driverId:driver,rideId:ride,status:'motorista_a_caminho',assignedDriverId:driver,acceptedDriverId:driver,category:'carros',intermediateStops:0,verifiedAt:Date.now(),targetEvidence:{id:evidence,version:1,rideId:ride,phase,source:'INDEPENDENT_OSM',point:p}}:null
 }}
 try{
  await assert.rejects(createDriverBroker({...cfg,privateKey:'not-allowed'}))
  const broker=await createDriverBroker(cfg),endpoint='https://fixture.invalid/driver-control'
  const proxy=createDriverProxy({enabled:true,localOnly:true,endpoint,...key,allowPilot,verifySession:async t=>t==='jwt'?actor:null,fetcher:async(url,opts)=>{forwarded++;return broker(new Request(url,opts))}})
  const target={action:'target',rideId:ride,phase:'PICKUP'}
  const request=body=>new Request('https://edge.invalid/driver',{method:'POST',headers:{Authorization:'Bearer jwt','Content-Type':'application/json'},body:JSON.stringify(body)})
  const permit={action:'permit',rideId:ride,phase:'PICKUP',origin,evidenceId:evidence,evidenceVersion:1}
  assert.equal((await proxy(request(permit))).status,409);assert.equal(forwarded,0)
  assert.equal((await proxy(request({...target,origin}))).status,422);assert.equal(forwarded,0)
  const r=await proxy(request(target));assert.equal(r.status,200);assert.deepEqual((await r.json()).target.evidence.point,p);assert.equal(reads,1)
  const body={authUserId:actor,request:permit},signed=await(await createDriverSigner({...key,authUserId:actor}))(body)
  assert.equal((await broker(new Request(endpoint,{method:'POST',headers:{Authorization:signed,'Content-Type':'application/json'},body:JSON.stringify(body)}))).status,409)
  assert.equal(reads,1)
  valid=false;assert.equal((await proxy(request(target))).status,403)
 }finally{admissionStore.close();rmSync(dir,{recursive:true,force:true})}
})
