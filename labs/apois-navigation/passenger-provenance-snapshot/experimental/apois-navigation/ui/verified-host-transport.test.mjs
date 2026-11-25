import test from 'node:test'
import assert from 'node:assert/strict'
import {createVerifiedHostTransport} from './verified-host-transport.mjs'
import {createCreationInterlock} from './creation-interlock.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const a=id(1),b=id(2)
test('host uses captured verified token; account switch never forwards another account',async()=>{
 let account=a,invocations=[],mode='ok'
 const auth={getSession:async()=>({data:{session:{user:{id:account},access_token:'synthetic-'+account}}}),getUser:async token=>({data:{user:{id:token.slice(10)}}})}
 const adapter=createVerifiedHostTransport({enabled:true,account:a,auth,controlFunction:'apois-navigation-control',invoke:async(name,options)=>{
  invocations.push([name,options]);if(mode==='switch')account=b
  if(mode==='price')return {error:{context:new Response(JSON.stringify({ok:false,error_code:'price_changed'}),{status:409})}}
  if(options.body.action==='apois_navigation_confirm')return {data:{ok:true,selectionId:id(8),requestKey:options.body.requestKey,expiresAt:new Date(Date.now()+60000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:'A'},destination:{lat:-9.42,lng:-40.51,label:'B'}}}
  return {data:{verified:true,ride:null}}
 }})
 assert.equal(await adapter.verifyIdentity(),a)
 assert.deepEqual(await adapter.activeRide(a),{verified:true,ride:null})
 assert.equal(invocations[0][0],'apois-navigation-control')
 assert.equal(invocations[0][1].headers.Authorization,'Bearer synthetic-'+a)
 const input={requestKey:id(3),pickup:{id:id(4),version:1},destination:{id:id(5),version:1},confirmed:true}
 assert.equal(await adapter.confirm({...input,confirmed:false}),null)
 assert.equal((await adapter.confirm(input)).selectionId,id(8))
 assert.deepEqual(invocations[1][1].body,{action:'apois_navigation_confirm',requestKey:id(3),pickup:input.pickup,destination:input.destination})
 mode='price';assert.equal((await adapter.transport({action:'apois_navigation_create'})).status,409)
 assert.equal(invocations[2][0],'request-ride')
 mode='switch';await assert.rejects(()=>adapter.transport({action:'apois_navigation_create'}))
 const count=invocations.length;await assert.rejects(()=>adapter.transport({action:'apois_navigation_create'}));assert.equal(invocations.length,count)
})
test('legacy default no-op and same-account lock serializes both creation paths',async()=>{
 assert.equal(await createCreationInterlock().legacy(()=>7),7)
 let tail=Promise.resolve(),pending=null,active=null,legacy=0,account=a
 const locks={request:(name,opts,work)=>{assert.equal(name,'apois-ride-submit-v1:'+a);const p=tail.then(work);tail=p.catch(()=>{});return p}}
 const guard=createCreationInterlock({enabled:true,locks,journal:{read:async()=>pending},verifyIdentity:async()=>account,activeRide:async()=>({verified:true,ride:active})})
 let release;const p=guard.experimental(async()=>{pending={selectionId:id(3)};await new Promise(r=>release=r);active={rideId:id(5),status:'procurar_motorista'}})
 const q=guard.legacy(()=>{legacy++}).then(()=>false,()=>true)
 while(!release)await Promise.resolve()
 release();await p;assert.equal(await q,true);assert.equal(legacy,0)
 assert.equal(await guard.canReturn(),false)
 pending=null;active=null;assert.equal(await guard.canReturn(),true)
 assert.equal(await guard.legacy(()=>++legacy),1)
})
test('missing lock implementation and uncertain active lookup fail closed',async()=>{
 assert.throws(()=>createCreationInterlock({enabled:true,locks:null,journal:{read:async()=>null},verifyIdentity:async()=>a,activeRide:async()=>null}))
 const guard=createCreationInterlock({enabled:true,locks:{request:(_,__,f)=>f()},journal:{read:async()=>null},verifyIdentity:async()=>a,activeRide:async()=>({verified:false})})
 assert.equal(await guard.canReturn(),false);await assert.rejects(()=>guard.legacy(()=>{throw Error('must not run')}))
})
