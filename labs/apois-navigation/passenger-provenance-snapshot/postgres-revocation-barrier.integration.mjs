// Runs only after sql-issuer-integration.mjs in the disposable fixture.
// Proves the original race and compares both orderings with real PostgreSQL
// transactions and a private SQLite store; no live Supabase, no real sessions.
import assert from 'node:assert/strict'
import {execFileSync,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {generateKeyPairSync,randomBytes} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDriverAuthority} from './driver-authority.mjs'
import {createRouteIssuer,routeBody} from '../valhalla/route-issuer.mjs'
import {openRouteReplayStore} from '../valhalla/route-replay-store.mjs'
import {createRevocationReconciler} from './revocation-reconciler.mjs'
import {createReconciledAuthorization} from './reconciled-authorization.mjs'
import {createGuardedAuthorization} from './guarded-authorization.mjs'
import {fixtureBarrier} from './postgres-revocation-barrier.mjs'
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0')
const ride=id(41),driver=id(71),actor=id(61)
const args=['exec','-i','apois-provenance-fixture','psql','-X','-qAt','-U','postgres','-d','apois_navigation_fixture','-v','ON_ERROR_STOP=1']
const sql=s=>execFileSync('docker',[...args,'-c',s],{encoding:'utf8',timeout:4500}).trim()
const reset=()=>sql("begin; update public.rides set status='motorista_a_caminho',driver_id='"+driver+"',accepted_driver_id='"+driver+"' where id='"+ride+"'; truncate apois_nav_lab.revoked_leg; commit;")
const cancel="update public.rides set status='cancelada' where id='"+ride+"'"
const reassign="update public.rides set driver_id='"+id(72)+"',accepted_driver_id='"+id(72)+"' where id='"+ride+"'"
const snapshot=()=>JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('rideId',ride_id,'phase',phase)),'[]'::jsonb) from apois_nav_lab.revoked_leg"))
const request={rideId:ride,phase:'PICKUP',origin:{lat:-9.41,lon:-40.505},target:{lat:-9.4,lon:-40.5}}
const body=routeBody(request.origin,request.target)
const authority=createDriverAuthority({verifySession:async s=>s==='fixture-driver-a'?actor:null,
 readDriverProof:async ({authUserId,rideId,phase})=>{
  const out=sql("set role service_role; select apois_nav_lab.read_driver_proof('"+authUserId+"','"+rideId+"','"+phase+"')")
  return out?JSON.parse(out):null
 }})
const dir=mkdtempSync(join(tmpdir(),'apois-barrier-'))
const keys=generateKeyPairSync('ed25519')
const principalKey=randomBytes(32),audience='postgres-barrier-fixture'
let index=0
const stores=[]
function setup(){
 const store=openRouteReplayStore({path:join(dir,'store-'+(++index)+'.sqlite'),initialize:true,requireIssued:true,requireScoped:true})
 stores.push(store)
 return {store,issue:createRouteIssuer({privateKey:keys.privateKey,principalKey,audience,readAuthority:authority,issuanceStore:store,scopedIssuance:true})}
}
const permit=async issue=>{const r=await issue('fixture-driver-a',request);assert.equal(r.status,200);return 'Bearer '+r.token}
const sig=()=>new AbortController().signal
const guarded=(store,withBarrier=fixtureBarrier)=>createGuardedAuthorization({publicKey:keys.publicKey,audience,principalKey,store,withBarrier})
try{
 reset()
 const old=setup(), token=await permit(old.issue)
 const reconcile=createRevocationReconciler({readSnapshot:async()=>{const rows=snapshot();sql(cancel);return rows},store:old.store,principalKey,audience})
 const legacy=createReconciledAuthorization({publicKey:keys.publicKey,audience,store:old.store,reconcile})
 const raced=await legacy(token,body,sig())
 assert.equal(raced.status,200,'reproduce committed revocation after snapshot before SQLite')
 raced.release()
 assert.equal(snapshot().length,1)
 console.log('APOIS_REVOCATION_RACE_REPRODUCED')
 // Writer wins: committed cancellation or reassignment must deny.
 for(const mutation of [cancel,reassign]){
  reset();const {store,issue}=setup();const header=await permit(issue)
  sql(mutation)
  assert.equal((await guarded(store)(header,body,sig())).status,403)
  assert.equal((await issue('fixture-driver-a',request)).status,403)
 }
 // Admission wins: independent writer must actually wait for the lock.
 reset();const {store,issue}=setup();const first=await permit(issue),second=await permit(issue)
 let writer,waited=false
 const withWriter=(signal,work)=>fixtureBarrier(signal,async read=>{
  return work(async(limit,s)=>{
   const rows=await read(limit,s)
   writer=promisify(execFile)('docker',[...args.slice(0,2),'-e','PGAPPNAME=apois-barrier-writer',...args.slice(2),'-c',cancel],{timeout:6000})
   writer.catch(()=>{})
   for(let i=0;i<20;i++){
    if(sql("select count(*) from pg_stat_activity where application_name='apois-barrier-writer' and wait_event_type='Lock'")==='1'){waited=true;break}
    await new Promise(r=>setTimeout(r,20))
   }
   assert.equal(waited,true,'writer did not wait for PostgreSQL lock')
   return rows
  })
 })
 const admitted=await guarded(store,withWriter)(first,body,sig())
 assert.equal(admitted.status,200)
 admitted.release()
 await writer
 assert.equal(snapshot().length,1)
 assert.equal((await guarded(store)(second,body,sig())).status,403)
 // A lost COMMIT acknowledgement after a successful SQLite admission burns
 // that permit, releases its lease, and must not return a forwarding grant.
 reset();const loss=setup(),lost=await permit(loss.issue)
 const failed=guarded(loss.store,async(s,work)=>{await fixtureBarrier(s,work);throw Error('simulated lost acknowledgement')})
 assert.equal((await failed(lost,body,sig())).status,503)
 assert.equal((await guarded(loss.store)(lost,body,sig())).status,403)
 assert.equal((await guarded(loss.store,async()=>{throw Error('down')})(await permit(loss.issue),body,sig())).status,503)
 // Loss of an authority record is not limited to status updates.
 reset()
 const deletedDriver=setup(),driverPermit=await permit(deletedDriver.issue)
 sql("delete from public.drivers where id='"+driver+"'")
 assert.equal(snapshot().length,1)
 assert.equal((await guarded(deletedDriver.store)(driverPermit,body,sig())).status,403)
 assert.equal((await deletedDriver.issue('fixture-driver-a',request)).status,403)
 sql("insert into public.drivers(id,user_id,approval_status,subscription_status,category) values('"+driver+"','"+id(51)+"','aprovado','active','carros')")
 reset()
 const changed=setup(),changedPermit=await permit(changed.issue)
 const change="update apois_nav_lab.selection set pickup_id='"+id(23)+"' where ride_id='"+ride+"'"
 assert.equal(sql("begin; "+change+"; select count(*) from apois_nav_lab.revoked_leg; rollback;"),'1')
 assert.equal(snapshot().length,0)
 sql(change)
 assert.equal((await guarded(changed.store)(changedPermit,body,sig())).status,403)
 sql("update apois_nav_lab.selection set pickup_id='"+id(21)+"' where ride_id='"+ride+"'")
 reset()
 const removed=setup(),removedPermit=await permit(removed.issue)
 sql("delete from apois_nav_lab.selection where ride_id='"+ride+"'")
 assert.equal(snapshot().length,1)
 assert.equal((await guarded(removed.store)(removedPermit,body,sig())).status,403)
 assert.equal((await removed.issue('fixture-driver-a',request)).status,403)
 console.log('APOIS_AUTHORITY_RECORD_LOSS_OK',{deletedDriver:true,changedSelection:true,deletedSelection:true,selectionRollback:true})
 console.log('APOIS_POSTGRES_SQLITE_BARRIER_OK',{raceReproduced:true,writerWaited:waited,cancellation:true,reassignment:true,commitAckLoss:true,authorityFailure:true})
}finally{for(const store of stores)store.close();rmSync(dir,{recursive:true,force:true})}
