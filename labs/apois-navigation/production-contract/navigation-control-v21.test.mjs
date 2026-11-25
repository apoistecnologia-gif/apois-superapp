import test from 'node:test'
import assert from 'node:assert/strict'
import {createNavigationControl} from './navigation-control-v21.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const req={action:'apois_navigation_confirm',requestKey:id(2),pickup:{id:id(3),version:1},destination:{id:id(4),version:1}}
test('disabled by default; explicit pilot; no client-supplied coordinates or auth ID',async()=>{
 assert.equal((await createNavigationControl()('s',req)).status,409)
 let calls=0,allow=false
 const control=createNavigationControl({confirmationEnabled:true,recoveryEnabled:true,verifySession:async s=>s==='s'?id(1):null,allowPilot:()=>allow,rpc:async(name,p)=>{calls++;assert.equal(p.p_auth_user,id(1));if(name.endsWith('active_v21'))return {verified:true,ride:null};assert.equal(name,'apois_nav_lab_confirm_v21');assert.deepEqual(p,{p_auth_user:id(1),p_request_key:id(2),p_pickup:id(3),p_pickup_version:1,p_destination:id(4),p_destination_version:1});return {selectionId:id(5),requestKey:id(2),expiresAt:new Date(Date.now()+60000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:'A'},destination:{lat:-9.42,lng:-40.51,label:'B'}}}})
 assert.equal((await control('s',req)).status,403);assert.equal(calls,0)
 allow=true;assert.equal((await control('bad',req)).status,401)
 assert.equal((await control('s',{...req,pickup:{...req.pickup,lat:0,lng:0}})).status,422)
 assert.equal((await control('s',{...req,authUserId:id(9)})).status,422)
 assert.equal((await control('s',req)).body.selectionId,id(5));assert.equal(calls,1)
 allow=false;assert.equal((await control('s',{action:'apois_navigation_active'})).body.verified,true)
})
