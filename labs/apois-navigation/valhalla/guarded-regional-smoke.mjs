// Real local Valhalla + PostgreSQL authority and guarded SQLite admission.
// The ride, session, catalog evidence and GPS fixes are synthetic; the three
// public geographic routes use the verified regional graph. No real accounts.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {generateKeyPairSync,randomBytes} from 'node:crypto'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDriverAuthority} from '../passenger-provenance-snapshot/driver-authority.mjs'
import {createGuardedAuthorization} from '../passenger-provenance-snapshot/guarded-authorization.mjs'
import {fixtureBarrier} from '../passenger-provenance-snapshot/postgres-revocation-barrier.mjs'
import {MotoristaAuthority} from '../host-compat/motorista-authority.mjs'
import {createRouteIssuer,routeBody} from './route-issuer.mjs'
import {createRouteGateway} from './route-gateway.mjs'
import {openRouteReplayStore} from './route-replay-store.mjs'
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0')
const ride=id(91),actor=id(61),driver=id(71),profile=id(51),passenger=id(1),passengerAuth=id(11),requestKey=id(93)
const P={lat:-9.403901,lon:-40.5040233},J={lat:-9.4165,lon:-40.5035},W={lat:-9.3990,lon:-40.5220}
const sql=s=>execFileSync('docker',['exec','-i','apois-provenance-fixture','psql','-X','-qAt','-U','postgres','-d','apois_navigation_fixture','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',timeout:4000,maxBuffer:65536}).trim()
sql(`insert into apois_nav_lab.catalog values
 ('${id(81)}',1,'node',81,repeat('a',64),'Fixture pickup',${J.lat},${J.lon},true),
 ('${id(82)}',1,'node',82,repeat('a',64),'Fixture destination',${P.lat},${P.lon},true);
 set role service_role;
 do $$ declare s jsonb; begin
 s:=apois_nav_lab.confirm_selection('${passengerAuth}','${requestKey}','${id(81)}',1,'${id(82)}',1);
 if s is null or apois_nav_lab.prepare_selection('${passengerAuth}',(s->>'selectionId')::uuid,'${requestKey}') is null then raise exception 'fixture selection failed'; end if;
 insert into public.rides(id,passenger_id,request_key,category,status,origin_lat,origin_lng,destination_lat,destination_lng,waypoints)
 values('${ride}','${passenger}','${requestKey}','carros','procurar_motorista',${J.lat},${J.lon},${P.lat},${P.lon},'[]');
 if not apois_nav_lab.bind_selection('${passengerAuth}',(s->>'selectionId')::uuid,'${ride}') then raise exception 'fixture bind failed'; end if;
 update public.rides set driver_id='${driver}',accepted_driver_id='${driver}',accepted_at=clock_timestamp(),status='motorista_a_caminho' where id='${ride}';
 end $$;`)
const session='synthetic-motorista-a'
const readProof=({authUserId,rideId,phase})=>{
 assert.match(authUserId,/^[a-f0-9-]{36}$/);assert.equal(rideId,ride);assert.ok(['PICKUP','TRIP'].includes(phase))
 const out=sql("set role service_role; select apois_nav_lab.read_driver_proof('"+authUserId+"','"+rideId+"','"+phase+"');")
 return out?JSON.parse(out):null
}
const authority=createDriverAuthority({verifySession:async s=>s===session?actor:s==='synthetic-motorista-b'?id(62):null,readDriverProof:async p=>readProof(p)})
const host=new MotoristaAuthority()
assert.equal(host.bind({authUserId:actor,profileUserId:profile,driverId:driver}),true)
let revision=0
function refreshHost(){
 const row=JSON.parse(sql("select jsonb_build_object('id',id,'driver_id',driver_id,'accepted_driver_id',accepted_driver_id,'status',status) from public.rides where id='"+ride+"';"))
 assert.equal(host.accept(row,{authUserId:actor,driverId:driver,epoch:host.epoch,revision:++revision}),true)
}
refreshHost()
const keys=generateKeyPairSync('ed25519'),principalKey=randomBytes(32),audience='apois-guarded-regional-fixture'
const dir=mkdtempSync(join(tmpdir(),'apois-guarded-regional-'))
const store=openRouteReplayStore({path:join(dir,'route.sqlite'),initialize:true,requireIssued:true,requireScoped:true})
const issue=createRouteIssuer({privateKey:keys.privateKey,principalKey,audience,readAuthority:authority,issuanceStore:store,scopedIssuance:true})
let down=false
const authorize=createGuardedAuthorization({publicKey:keys.publicKey,audience,principalKey,store,withBarrier:(signal,work)=>{if(down)throw Error('fixture authority unavailable');return fixtureBarrier(signal,work)}})
const gateway=createRouteGateway({authorize})
const output=[]
try{
 await new Promise((r,j)=>{gateway.once('error',j);gateway.listen(0,'127.0.0.1',r)})
 const url='http://127.0.0.1:'+gateway.address().port+'/route'
 const post=(token,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
 const req=(origin,target)=>({rideId:ride,phase:host.snapshot.phase,origin,target})
 async function permit(request){
   const before=host.snapshot
   assert.ok(['PICKUP','TRIP'].includes(before.phase))
   const r=await issue(session,request)
   assert.equal(host.snapshot,before)
   assert.equal(r.status,200)
   return r.token
 }
 async function saveRoute(name,token,request){
   const body=routeBody(request.origin,request.target)
   const response=await post(token,body);assert.equal(response.status,200)
   const data=await response.json();assert.equal(data.code,'Ok')
   const route=data.routes[0];assert.ok(route.distance>500&&route.distance<25000)
   const steps=route.legs.flatMap(l=>l.steps)
   const voice=steps.flatMap(s=>s.voiceInstructions??[]).map(v=>v.announcement).filter(Boolean)
   assert.ok(voice.some(v=>/\b(vire|siga|continue|chegou|destino|direita|esquerda|metros|pegue|mantenha|dirija)\b/i.test(v)))
   assert.ok(steps.some(s=>s.bannerInstructions?.length))
   writeFileSync(join(process.argv[2],'guarded_'+name+'.json'),JSON.stringify(data))
   assert.equal((await post(token,body)).status,403)
   output.push({name,distanceM:route.distance,voiceCount:voice.length})
 }
 const pickup=req(P,J)
 assert.equal((await issue('synthetic-motorista-b',pickup)).status,403)
 assert.equal((await post(null,routeBody(P,J))).status,401)
 const token=await permit(pickup)
 assert.equal((await post(token,routeBody(W,J))).status,403)
 down=true;assert.equal((await post(token,routeBody(P,J))).status,503);down=false
 await saveRoute('pickup',token,pickup)
 const reroute=req(W,J)
 await saveRoute('reroute',await permit(reroute),reroute)
 const pending=await permit(pickup)
 sql("update public.rides set status='motorista_chegou' where id='"+ride+"';")
 refreshHost();assert.equal(host.snapshot.phase,'WAITING_PIN')
 assert.equal((await post(pending,routeBody(P,J))).status,403)
 assert.equal((await issue(session,pickup)).status,403)
 sql("update public.rides set status='em_viagem' where id='"+ride+"';")
 refreshHost();assert.equal(host.snapshot.phase,'TRIP')
 const trip=req(J,P)
 await saveRoute('trip',await permit(trip),trip)
 const outstanding=await permit(trip)
 sql("update public.rides set status='cancelada_passageiro' where id='"+ride+"';")
 refreshHost();assert.equal(host.snapshot.phase,'CANCELLED')
 assert.equal((await post(outstanding,routeBody(J,P))).status,403)
 assert.equal((await issue(session,trip)).status,403)
 writeFileSync(join(process.argv[2],'guarded-regional-report.json'),JSON.stringify({routes:output,authority:'disposable PostgreSQL',auth:'synthetic',gateway:'guarded SQLite',phaseChange:true,cancellation:true,authorityFailure:true,replayRejected:true},null,2))
 console.log('APOIS_GUARDED_REGIONAL_OK',JSON.stringify(output))
}finally{host.close();gateway.closeAllConnections();await new Promise(r=>gateway.close(r));store.close();rmSync(dir,{recursive:true,force:true})}
