import test from 'node:test'
import assert from 'node:assert/strict'
import {createNavigationControl} from './navigation-control-v21.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const req={action:'apois_navigation_confirm',requestKey:id(2),pickup:{id:id(3),version:1},destination:{id:id(4),version:1}}
test('disabled by default; explicit pilot; no client-supplied coordinates or auth ID',async()=>{
 assert.equal((await createNavigationControl()('s',req)).status,409)
 let calls=0,allow=false
 const policy={version:1,extractHash:'a'.repeat(64)}
 const control=createNavigationControl({confirmationEnabled:true,recoveryEnabled:true,catalogPolicy:policy,verifySession:async s=>s==='s'?id(1):null,allowPilot:()=>allow,rpc:async(name,p)=>{calls++;assert.equal(p.p_auth_user,id(1));if(name.endsWith('active_v21'))return {verified:true,ride:null};assert.equal(name,'apois_nav_lab_confirm_catalog_v21');assert.deepEqual(p,{p_auth_user:id(1),p_version:1,p_extract:policy.extractHash,p_request_key:id(2),p_pickup:id(3),p_destination:id(4)});return {selectionId:id(5),requestKey:id(2),expiresAt:new Date(Date.now()+60000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:'A'},destination:{lat:-9.42,lng:-40.51,label:'B'}}}})
 assert.equal((await control('s',req)).status,403);assert.equal(calls,0)
 allow=true;assert.equal((await control('bad',req)).status,401)
 assert.equal((await control('s',{...req,pickup:{...req.pickup,lat:0,lng:0}})).status,422)
 assert.equal((await control('s',{...req,authUserId:id(9)})).status,422)
 assert.equal((await control('s',req)).body.selectionId,id(5));assert.equal(calls,1)
 allow=false;assert.equal((await control('s',{action:'apois_navigation_active'})).body.verified,true)
})

test('catalog only exposes configured active public data, recovery independent of catalog configuration',async()=>{
 const policy={version:2,extractHash:'b'.repeat(64)}
 const row=n=>({id:id(n),version:2,extract_sha256:policy.extractHash,label:'Ponto '+n,lat:-9.4,lng:-40.5,active:true})
 let value={source:'OSM_PBF',version:2,extract_sha256:policy.extractHash,rows:[row(3),row(4)]},calls=0
 const opts={confirmationEnabled:true,recoveryEnabled:true,catalogPolicy:policy,verifySession:async s=>s==='ok'?id(1):null,allowPilot:u=>u===id(1),rpc:async(name,p)=>{calls++;if(name.endsWith('active_v21'))return {verified:true,ride:null};assert.equal(name,'apois_nav_lab_catalog_v21');assert.deepEqual(p,{p_auth_user:id(1),p_version:2,p_extract:policy.extractHash});return value}}
 const action=createNavigationControl(opts),req={action:'apois_navigation_catalog'}
 assert.equal((await action('bad',req)).status,401)
 assert.equal((await action('ok',{...req,version:1})).status,422)
 assert.equal((await action('ok',{action:'apois_navigation_confirm',requestKey:id(5),pickup:{id:id(3),version:1},destination:{id:id(4),version:1}})).status,422)
 assert.equal(calls,0)
 assert.equal((await action('ok',req)).body.catalog.rows.length,2)
 value={...value,rows:[row(3),{...row(4),active:false}]};assert.equal((await action('ok',req)).status,409)
 value={...value,rows:[row(3),{...row(4),passenger_id:id(1)}]};assert.equal((await action('ok',req)).status,409)
 value={...value,rows:[row(3),row(3)]};assert.equal((await action('ok',req)).status,409)
 const noCatalog=createNavigationControl({...opts,catalogPolicy:undefined})
 assert.equal((await noCatalog('ok',req)).status,503)
 assert.equal((await noCatalog('ok',{action:'apois_navigation_active'})).body.verified,true)
})

test('confirmation rejects malformed or out-of-region points and projects public response',async()=>{
 const base={selectionId:id(5),requestKey:req.requestKey,expiresAt:new Date(Date.now()+60000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:'A'},destination:{lat:-9.42,lng:-40.51,label:'B'}}
 let value=base
 const control=createNavigationControl({confirmationEnabled:true,catalogPolicy:{version:1,extractHash:'a'.repeat(64)},verifySession:async()=>id(1),allowPilot:()=>true,rpc:async()=>value})
 for(const origin of [{lat:0,lng:0,label:'A'},{lat:'-9.4',lng:-40.5,label:'A'},{...base.origin,authUserId:id(1)},{...base.origin,label:''}]){value={...base,origin};assert.equal((await control('s',req)).status,409)}
 value={...base,internal:id(7),ok:false};assert.deepEqual((await control('s',req)).body,{ok:true,...base})
})
