import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createNavigationControl} from './navigation-control-v21.mjs'
import {createExperimentalRequestHandler} from './request-ride-v21.mjs'
import {createPassengerPanel} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/passenger-panel.mjs'
import {createVerifiedHostTransport} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/verified-host-transport.mjs'
import {createDurableRideHost} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/durable-ride-host.mjs'
import {createCreationInterlock} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/creation-interlock.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),account=id(241),passenger=id(251),key=id(261)
const args=['exec','-i','apois-v21-fixture','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
const lit=v=>"'"+String(v).replaceAll("'","''")+"'"
const sql=(statement,service=true)=>{const x=execFileSync('docker',args,{input:(service?'set role service_role;\n':'')+statement+';\n',encoding:'utf8',timeout:5000}).trim();return x?JSON.parse(x):null}
sql("insert into public.users(id,auth_user_id) values("+lit(passenger)+","+lit(account)+")",false)
const digest='a'.repeat(64)
const rpc=async(name,p)=>{
 assert.equal(p.p_auth_user,account)
 if(name==='apois_nav_lab_active_v21')return sql('select public.'+name+'('+lit(account)+')')
 if(name==='apois_nav_lab_catalog_v21')return sql('select public.'+name+'('+lit(account)+','+p.p_version+','+lit(p.p_extract)+')')
 if(name==='apois_nav_lab_confirm_catalog_v21')return sql('select public.'+name+'('+[account,p.p_request_key,p.p_pickup,p.p_destination].map(lit).join(',')+','+p.p_version+','+lit(p.p_extract)+')')
 if(name==='apois_nav_lab_reconcile_v21')return sql('select public.'+name+'('+[account,p.p_selection,p.p_request_key].map(lit).join(',')+','+p.p_seal+')')
 throw Error('unexpected RPC')
}
const control=createNavigationControl({confirmationEnabled:true,recoveryEnabled:true,catalogPolicy:{version:1,extractHash:digest},verifySession:async token=>token==='synthetic-token'?account:null,allowPilot:u=>u===account,rpc})
let dispatch=0,createdRequests=0,lost=true
const req=createExperimentalRequestHandler({enabled:true,authorize:async token=>token==='synthetic-token'?{allowed:true,authUserId:account,categoryId:id(90)}:null,
 readSelection:({authUserId,selectionId,requestKey})=>sql('select public.apois_nav_lab_read_selection_v21('+[authUserId,selectionId,requestKey].map(lit).join(',')+')'),
 independentMetrics:async()=>({source:'OSM_VALHALLA_LAB',distanceKm:2.1,durationMin:7.2}),loadFare:async()=>12.34,
 createAtomic:({authUserId,selectionId,requestKey},payload)=>sql('select public.apois_nav_lab_create_ride_v21('+[authUserId,selectionId,requestKey,JSON.stringify(payload)].map(lit).join(',')+'::jsonb)'),
 dispatchInitial:async()=>{dispatch++;return []}})
const auth={getSession:async()=>({data:{session:{user:{id:account},access_token:'synthetic-token'}}}),getUser:async token=>({data:{user:token==='synthetic-token'?{id:account}:null}})}
const invoke=async(name,{body,headers})=>{
 const token=headers.Authorization.slice(7)
 const result=await (name==='request-ride'?req:control)(token,body)
 if(body.action==='apois_navigation_create'){createdRequests++;if(lost){lost=false;throw Error('simulated transport loss after commit')}}
 return result.status===200?{data:result.body}:{error:{context:new Response(JSON.stringify(result.body),{status:result.status})}}
}
const adapter=createVerifiedHostTransport({enabled:true,account,auth,invoke,controlFunction:'apois-navigation-control'})
const catalogResult=await control('synthetic-token',{action:'apois_navigation_catalog'})
assert.equal(catalogResult.status,200)
const catalog=catalogResult.body.catalog;assert.equal(catalog.rows.length,2)
const panel=createPassengerPanel({enabled:true,catalog,newKey:()=>key,confirm:adapter.confirm})
assert.ok(panel.open());assert.ok(panel.selectSearch(catalog.rows.find(r=>r.id===id(21)).label,id(21)));assert.ok(panel.focus('destination'));assert.ok(panel.selectSearch(catalog.rows.find(r=>r.id===id(22)).label,id(22)))
assert.ok(await panel.confirm())
let record=null
const journal={read:async()=>record,reserve:async(_,e)=>{if(record)return false;record={...e};return true},clear:async(_,e)=>{if(JSON.stringify(record)!==JSON.stringify(e))return false;record=null;return true}}
const make=()=>createDurableRideHost({enabled:true,journal,...adapter})
const interlock=createCreationInterlock({enabled:true,journal,...adapter,locks:{request:(_,__,work)=>work()}})
const first=make();assert.ok(await first.open());assert.ok(first.begin(panel.confirmedInput()));assert.ok(await first.quote())
assert.equal(await interlock.experimental(()=>first.submit(true)),null);assert.ok(record);assert.equal(first.snapshot().state,'recovery')
assert.equal(await interlock.canReturn(),false);first.invalidate();panel.close()
const second=make();assert.ok(await second.open());assert.equal(second.snapshot().state,'recovery')
assert.ok(await second.recover());assert.equal(second.snapshot().state,'active');assert.equal(dispatch,1);assert.equal(createdRequests,1)
const ride=second.snapshot().ride.rideId
sql("update public.rides set status='cancelada_passageiro',cancelled_by='passenger',cancelled_at=clock_timestamp() where id="+lit(ride))
assert.ok(await second.recover());assert.equal(record,null);assert.ok(await interlock.canReturn());assert.equal(createdRequests,1)
console.log('APOIS_V21_VERIFIED_HOST_TO_SQL_OK',JSON.stringify({confirmed:true,quote:true,committedLostResponse:true,reopened:true,trackedExisting:true,terminalReleased:true,createdRequests,dispatch}))
