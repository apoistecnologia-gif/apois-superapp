// Full v21 experimental chain: real public OSM catalog + Valhalla graph,
// observed PostgreSQL columns/gates, exact v21 fare function (synthetic tariffs),
// private RPC, synthetic dispatch/auth/GPS, guarded driver route and replay.
// Never run against a remote DB or with customer data.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {generateKeyPairSync,randomBytes} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPassengerPanel} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/passenger-panel.mjs'
import {createExperimentalRideReview} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/request-review.mjs'
import {createV21ExperimentalAction} from './v21-edge-adapter.mjs'
import {startRegionalQuoteTls} from './regional-private-quote.mjs'
import {createNavigationControl} from './navigation-control-v21.mjs'
import {createVerifiedHostTransport} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/verified-host-transport.mjs'
import {createDurableRideHost} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/durable-ride-host.mjs'
import {loadFare} from './observed-fare-v21.ts'
import {createDriverAuthority} from '../passenger-provenance-snapshot/driver-authority.mjs'
import {createGuardedAuthorization} from '../passenger-provenance-snapshot/guarded-authorization.mjs'
import {fixtureBarrier} from '../passenger-provenance-snapshot/postgres-revocation-barrier.mjs'
import {createRouteIssuer,routeBody} from '../valhalla/route-issuer.mjs'
import {createRouteGateway} from '../valhalla/route-gateway.mjs'
import {openRouteReplayStore} from '../valhalla/route-replay-store.mjs'
import {MotoristaAuthority} from '../host-compat/motorista-authority.mjs'
const out=process.argv[2]
const manifest=JSON.parse(readFileSync(join(out,'catalog.json'),'utf8'))
assert.equal(manifest.source,'OSM_PBF')
assert.equal(manifest.count,manifest.rows.length)
assert.ok(manifest.rows.every(r=>r.active===false&&r.extract_sha256===manifest.extract_sha256))
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const passengerAuth=id(11),passengerId=id(1),driverAuth=id(61),driver=id(71),profile=id(51),key=id(91)
const nearest=(lat,lng)=>manifest.rows.map(r=>({r,d:Math.hypot(r.lat-lat,r.lng-lng)})).sort((a,b)=>a.d-b.d)[0]
const p=nearest(-9.4165,-40.5035),d=nearest(-9.403901,-40.5040233)
assert.ok(p.d<0.015&&d.d<0.015&&p.r.id!==d.r.id)
const pickup={...p.r,active:true},destination={...d.r,active:true}
const catalog={...manifest,count:2,rows:[pickup,destination]}
const sql=(statement,values=[],role=true)=>{
 const args=['exec','-i','apois-provenance-fixture','psql','-X','-qAt','-U','postgres','-d','apois_navigation_fixture','-v','ON_ERROR_STOP=1']
 values.forEach((v,i)=>args.push('-v','p'+(i+1)+'='+v))
 const input=(role?'set role service_role;\n':'')+statement.replace(/\$(\d+)/g,(_,n)=>":'p"+n+"'")+";\n"
 const result=execFileSync('docker',args,{input,encoding:'utf8',timeout:4000,maxBuffer:65536}).trim()
 return result?JSON.parse(result):null
}
sql("insert into apois_nav_lab.catalog(id,version,osm_kind,osm_id,extract_sha256,label,lat,lng,active) select id,version,osm_kind,osm_id,extract_sha256,label,lat,lng,active from jsonb_to_recordset($1::jsonb) as x(id uuid,version int,osm_kind text,osm_id bigint,extract_sha256 text,label text,lat float8,lng float8,active bool)",[JSON.stringify(catalog.rows)],false)
const quoteTls=await startRegionalQuoteTls({authUserId:passengerAuth,certificate:process.env.APOIS_LAB_CERT,keyFile:process.env.APOIS_LAB_CERT_KEY,origin:pickup,destination})
try{
let dispatches=0
const admin={
 from(table){const q={select(){return q},eq(){return q},async maybeSingle(){return table==='passenger_wallets'?{data:{is_blocked:false}}:{data:{id:id(90),code:'carros'}}},then(resolve){assert.equal(table,'tariff_rules');resolve({data:[{city:'petrolina',base_fare:3,per_km:2,per_min:0.5,min_fare:10}]})}};return q},
 async rpc(name,args){
  const values=[args.p_auth_user,args.p_selection,args.p_request_key]
  if(name==='apois_nav_lab_read_selection_v21')return {data:sql('select public.apois_nav_lab_read_selection_v21($1,$2,$3)',values)}
  assert.equal(name,'apois_nav_lab_create_ride_v21')
  return {data:sql('select public.apois_nav_lab_create_ride_v21($1,$2,$3,$4::jsonb)',[...values,JSON.stringify(args.p_payload)])}
 }
}
const handle=createV21ExperimentalAction({enabled:true,admin,authUserId:passengerAuth,passengerId,independentMetrics:quoteTls.metrics,loadFare:(...args)=>loadFare(admin,...args),dispatchInitial:async({id:rideId})=>{assert.equal(sql("select to_jsonb(count(*)) from public.rides where id=$1 and status='procurar_motorista'",[rideId]),1);dispatches++;return [profile]}})
const control=createNavigationControl({confirmationEnabled:true,recoveryEnabled:true,catalogPolicy:{version:1,extractHash:manifest.extract_sha256},verifySession:async s=>s==='synthetic-regional-passenger'?passengerAuth:null,allowPilot:u=>u===passengerAuth,rpc:async(name,p)=>{
 assert.equal(p.p_auth_user,passengerAuth)
 if(name==='apois_nav_lab_catalog_v21')return sql('select public.apois_nav_lab_catalog_v21($1,$2,$3)',[passengerAuth,p.p_version,p.p_extract])
 if(name==='apois_nav_lab_confirm_catalog_v21')return sql('select public.apois_nav_lab_confirm_catalog_v21($1,$2,$3,$4,$5,$6)',[passengerAuth,p.p_request_key,p.p_pickup,p.p_destination,p.p_version,p.p_extract])
 if(name==='apois_nav_lab_active_v21')return sql('select public.apois_nav_lab_active_v21($1)',[passengerAuth])
 if(name==='apois_nav_lab_reconcile_v21')return sql('select public.apois_nav_lab_reconcile_v21($1,$2,$3,$4)',[passengerAuth,p.p_selection,p.p_request_key,p.p_seal])
 throw Error('Unexpected control RPC')
}})
let sent=0
const auth={getSession:async()=>({data:{session:{user:{id:passengerAuth},access_token:'synthetic-regional-passenger'}}}),getUser:async token=>({data:{user:token==='synthetic-regional-passenger'?{id:passengerAuth}:null}})}
const adapter=createVerifiedHostTransport({enabled:true,account:passengerAuth,auth,controlFunction:'apois-navigation-control',invoke:async(name,{body,headers})=>{
 const token=headers.Authorization.slice(7);assert.equal(token,'synthetic-regional-passenger')
 const result=await (name==='request-ride'?handle(body):control(token,body))
 if(body.action==='apois_navigation_create'){sent++;throw Error('synthetic lost response after actual fixture creation')}
 return result.status===200?{data:result.body}:{error:{context:new Response(JSON.stringify(result.body),{status:result.status})}}
}})
const delivered=await adapter.readCatalog({version:1,extractHash:manifest.extract_sha256},AbortSignal.timeout(10000));assert.equal(delivered.rows.length,2)
const panel=createPassengerPanel({enabled:true,catalog:delivered,newKey:()=>key,confirm:adapter.confirm})
assert.ok(panel.open())
assert.equal(panel.suggestTap({lat:pickup.lat,lng:pickup.lng}).id,pickup.id)
assert.ok(panel.acceptSuggestion());assert.ok(panel.focus('destination'))
assert.ok(panel.selectSearch(destination.label,destination.id))
assert.ok(await panel.confirm())
let record=null
const journal={read:async()=>record,reserve:async(_,e)=>{if(record)return false;record={...e};return true},clear:async(_,e)=>{if(JSON.stringify(e)!==JSON.stringify(record))return false;record=null;return true}}
const make=()=>createDurableRideHost({enabled:true,journal,...adapter})
const first=make();assert.ok(await first.open());assert.ok(first.begin(panel.confirmedInput()))
const quote=await first.quote();assert.ok(quote&&quote.distance_km>0.5)
assert.equal(await first.submit(true),null);assert.equal(first.snapshot().state,'recovery');assert.ok(record);first.invalidate()
const recovered=make();assert.ok(await recovered.open());assert.equal(recovered.snapshot().state,'recovery')
assert.ok(await recovered.recover());assert.equal(recovered.snapshot().state,'active');assert.equal(sent,1);assert.equal(dispatches,1)
const ride=recovered.snapshot().ride.rideId
assert.equal(quoteTls.stats().metricRequests,2)
assert.equal(sql("select to_jsonb(count(*)) from public.rides where id=$1 and fare_amount_cents=$2 and payment_method='cash' and pickup_source='osm_lab'",[ride,quote.fare_amount_cents]),1)
sql("update public.rides set driver_id=$1,accepted_driver_id=$1,accepted_at=clock_timestamp(),status='motorista_a_caminho' where id=$2",[driver,ride])
const authority=createDriverAuthority({verifySession:async s=>s==='driver-a'?driverAuth:s==='driver-b'?id(62):null,readDriverProof:async({authUserId,rideId,phase})=>sql('select apois_nav_lab.read_driver_proof_v21($1,$2,$3)',[authUserId,rideId,phase])})
const host=new MotoristaAuthority();assert.ok(host.bind({authUserId:driverAuth,profileUserId:profile,driverId:driver}))
let revision=0
const refresh=()=>assert.ok(host.accept(sql("select jsonb_build_object('id',id,'driver_id',driver_id,'accepted_driver_id',accepted_driver_id,'status',status) from public.rides where id=$1",[ride]),{authUserId:driverAuth,driverId:driver,epoch:host.epoch,revision:++revision}))
refresh()
const keys=generateKeyPairSync('ed25519'),principalKey=randomBytes(32),audience='apois-v21-regional-fixture'
const dir=mkdtempSync(join(tmpdir(),'apois-v21-region-')),store=openRouteReplayStore({path:join(dir,'replay.sqlite'),initialize:true,requireIssued:true,requireScoped:true})
const issue=createRouteIssuer({privateKey:keys.privateKey,principalKey,audience,readAuthority:authority,issuanceStore:store,scopedIssuance:true})
const authorize=createGuardedAuthorization({publicKey:keys.publicKey,audience,principalKey,store,withBarrier:fixtureBarrier})
const gateway=createRouteGateway({authorize})
const routes=[]
try{
 await new Promise((res,rej)=>{gateway.once('error',rej);gateway.listen(0,'127.0.0.1',res)})
 const endpoint='http://127.0.0.1:'+gateway.address().port+'/route'
 const post=(token,request)=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(routeBody(request.origin,request.target)),signal:AbortSignal.timeout(15000)})
 const point=r=>({lat:r.lat,lon:r.lng})
 const request=(origin,target)=>({rideId:ride,phase:host.snapshot.phase,origin,target})
 async function permit(req){const result=await issue('driver-a',req);assert.equal(result.status,200);return result.token}
 async function route(name,req){
  const token=await permit(req),response=await post(token,req);assert.equal(response.status,200)
  const data=await response.json();assert.equal(data.code,'Ok')
  const r=data.routes[0],steps=r.legs.flatMap(l=>l.steps),voice=steps.flatMap(s=>s.voiceInstructions??[]).map(v=>v.announcement).filter(Boolean)
  assert.ok(r.distance>500&&r.distance<25000)
  assert.ok(voice.some(v=>/\b(vire|siga|continue|chegou|destino|direita|esquerda|metros|pegue|mantenha|dirija)\b/i.test(v)))
  writeFileSync(join(out,'v21_'+name+'.json'),JSON.stringify(data))
  assert.equal((await post(token,req)).status,403)
  routes.push({name,distanceM:r.distance,voiceCount:voice.length})
 }
 const pickupReq=request({lat:-9.3990,lon:-40.5220},point(pickup))
 assert.equal((await issue('driver-b',pickupReq)).status,403)
 await route('pickup',pickupReq)
 await route('reroute',request({lat:-9.403901,lon:-40.5040233},point(pickup)))
 const pending=await permit(pickupReq)
 sql("update public.rides set status='motorista_chegou',driver_arrived_at=clock_timestamp() where id=$1",[ride]);refresh()
 assert.equal((await post(pending,pickupReq)).status,403)
 sql("update public.rides set status='em_viagem',started_at=clock_timestamp() where id=$1",[ride]);refresh()
 const trip=request(point(pickup),point(destination));await route('trip',trip)
 const finalPending=await permit(trip)
 sql("update public.rides set status='finalizada',completed_at=clock_timestamp() where id=$1",[ride]);refresh()
 assert.equal((await post(finalPending,trip)).status,403)
 assert.equal((await issue('driver-a',trip)).status,403)
 assert.ok(await recovered.recover());assert.equal(record,null);assert.ok(recovered.canReturnToLegacy());assert.equal(sent,1)
 const report={privateQuote:quoteTls.stats(),recoveredWithoutDuplicate:true,source:'OSM_PBF',extract_sha256:manifest.extract_sha256,selectedPublicNodes:2,auth:'synthetic',dispatch:'synthetic after commit',tariffs:'synthetic inputs to observed v21 formula',quote,driverAuthority:'v21 fixture',routes}
 writeFileSync(join(out,'v21-regional-report.json'),JSON.stringify(report,null,2))
 console.log('APOIS_V21_OSM_TO_FERROSTAR_INPUT_OK',JSON.stringify(report))
}finally{panel.close();host.close();gateway.closeAllConnections();await new Promise(res=>gateway.close(res));store.close();rmSync(dir,{recursive:true,force:true})}

}finally{await quoteTls.close()}
