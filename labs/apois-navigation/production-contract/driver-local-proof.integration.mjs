// Disposable PostgreSQL v21 fixture + actual authenticated broker protocol.
// No live Auth, production database, signing key for routes, or GPS data.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDriverBroker} from '../driver-broker/driver-broker.mjs'
import {createDriverProxy} from '../driver-broker/driver-proxy.mjs'
import {openRouteReplayStore} from '../valhalla/route-replay-store.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(61),other=id(62),driver=id(71),profile=id(51),account=id(501),passenger=id(502),key=id(503)
const p=id(21),q=id(22)
const args=['exec','-i','apois-v21-fixture','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
const lit=v=>"'"+String(v).replaceAll("'","''")+"'"
const sql=(statement,service=true)=>{
 const x=execFileSync('docker',args,{input:(service?'set role service_role;\n':'')+statement+';\n',encoding:'utf8',timeout:5000}).trim()
 return x?JSON.parse(x):null
}
sql('insert into public.users(id,auth_user_id) values('+lit(passenger)+','+lit(account)+')',false)
const selection=sql('select apois_nav_lab.confirm_selection('+[account,key,p].map(lit).join(',')+',1,'+lit(q)+',1)')
assert.ok(selection?.selectionId)
const payload={origin:{lat:-9.4,lng:-40.5},destination:{lat:-9.42,lng:-40.51},category:'carros',intermediates:[],payment_method:'cash',estimated_price:12.34,distance_km:2.1,duration_min:8,expected_price_cents:1234}
const created=sql('select public.apois_nav_lab_create_ride_v21('+[account,selection.selectionId,key,JSON.stringify(payload)].map(lit).join(',')+'::jsonb)')
const ride=created?.rideId;assert.ok(ride)
const dir=mkdtempSync(join(tmpdir(),'apois-local-proof-'))
const secret={keyId:'fixture',secret:randomBytes(32).toString('base64url')}
const admissionStore=openRouteReplayStore({path:join(dir,'admission.db'),initialize:true,perMinute:50})
let reads=0,forwarded=0
const allowPilot=u=>[actor,other].includes(u)
const broker=await createDriverBroker({enabled:true,localOnly:true,keys:[secret],admissionStore,allowPilot,readDriverProof:async({authUserId,rideId,phase},signal)=>{
 if(signal.aborted)return null
 reads++
 return sql('select public.apois_nav_lab_driver_proof_v21('+[authUserId,rideId,phase].map(lit).join(',')+')')
}})
const proxy=createDriverProxy({enabled:true,localOnly:true,endpoint:'https://fixture.invalid/driver-control',...secret,allowPilot,verifySession:async token=>token==='driver'?actor:token==='other'?other:null,fetcher:async(url,opts)=>{forwarded++;return broker(new Request(url,opts))}})
const request=(phase='PICKUP',token='driver',body={action:'target',rideId:ride,phase})=>proxy(new Request('https://edge.invalid/driver',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}))
try{
 assert.equal((await request()).status,403) // searching, not assigned
 sql("update public.rides set status='motorista_a_caminho',driver_id="+lit(driver)+",accepted_driver_id="+lit(driver)+",accepted_at=clock_timestamp() where id="+lit(ride))
 assert.equal((await request('PICKUP','other')).status,403)
 assert.equal((await request('PICKUP','invalid')).status,401)
 const pickup=await request();assert.equal(pickup.status,200)
 const a=(await pickup.json()).target
 assert.deepEqual(a.identity,{authUserId:actor,profileUserId:profile,driverId:driver})
 assert.deepEqual(a.evidence.point,{lat:-9.4,lon:-40.5})
 assert.equal(a.evidence.id,selection.selectionId)
 const prior=forwarded
 assert.equal((await request('PICKUP','driver',{action:'permit',rideId:ride,phase:'PICKUP',origin:{lat:-9.4,lon:-40.5},evidenceId:a.evidence.id,evidenceVersion:a.evidence.version})).status,409)
 assert.equal(forwarded,prior)
 sql("update public.rides set status='motorista_chegou',driver_arrived_at=clock_timestamp() where id="+lit(ride))
 assert.equal((await request()).status,403)
 sql("update public.rides set status='em_viagem',started_at=clock_timestamp() where id="+lit(ride))
 const trip=await request('TRIP');assert.equal(trip.status,200)
 assert.deepEqual((await trip.json()).target.evidence.point,{lat:-9.42,lon:-40.51})
 sql("update public.drivers set is_online=false where id="+lit(driver))
 assert.equal((await request('TRIP')).status,403)
 sql("update public.drivers set is_online=true where id="+lit(driver))
 assert.equal((await request('TRIP')).status,403) // durable tombstone
 sql("update public.rides set status='finalizada',completed_at=clock_timestamp() where id="+lit(ride))
 assert.equal((await request('TRIP')).status,403)
 console.log('APOIS_V21_LOCAL_DRIVER_SQL_OK',JSON.stringify({actualPostgres:true,actualHmac:true,actualReplayStore:true,syntheticAuth:true,pickup:true,trip:true,remotePermitBlocked:true,revocationDurable:true,reads}))
}finally{admissionStore.close();rmSync(dir,{recursive:true,force:true})}
