import test from 'node:test'
import assert from 'node:assert/strict'
import {createDurableRideHost} from './durable-ride-host.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const a=id(1),b=id(2),selection={selectionId:id(3),requestKey:id(4),expiresAt:new Date(Date.now()+60000).toISOString()}
function memory(){
 const rows=new Map()
 return {rows,async read(scope){return rows.get(scope)??null},async reserve(scope,e){const old=rows.get(scope);if(old)return JSON.stringify(old)===JSON.stringify(e);rows.set(scope,{...e});return true},async clear(scope,e){if(JSON.stringify(rows.get(scope))!==JSON.stringify(e))return false;rows.delete(scope);return true}}
}
function setup(){
 const journal=memory();let account=a,active=null,server='open',calls=[],owner=10,verified=true,createMode='lost'
 const transport=async(body)=>{
  calls.push(body)
  const common={selectionId:body.selectionId,requestKey:body.requestKey}
  if(body.action.endsWith('quote'))return {status:200,body:{ok:true,estimated_price:12.34,fare_amount_cents:1234,distance_km:2,duration_min:8,expiresAt:selection.expiresAt}}
  if(body.action.endsWith('create')){
   assert.ok(journal.rows.has(account),'write ahead required')
   if(createMode==='lost'){server='ride';active={rideId:id(5),status:'procurar_motorista'};throw Error('response lost')}
   throw Error('offline before create')
  }
  if(server==='ride')return {status:200,body:{ok:true,...common,state:'ride',ride:active??{rideId:id(5),status:'finalizada'}}}
  if(body.action.endsWith('seal'))server='sealed'
  return {status:200,body:{ok:true,...common,state:server}}
 }
 const make=()=>createDurableRideHost({enabled:true,journal,verifyIdentity:async()=>account,activeRide:async()=>({verified,ride:active}),transport,newOwner:()=>id(owner++)})
 return {journal,calls,make,account:v=>account=v,active:v=>active=v,mode:v=>createMode=v,verified:v=>verified=v}
}
async function attempt(h){assert.ok(await h.open());assert.ok(h.begin(selection));assert.ok(await h.quote());assert.equal(await h.submit(true),null)}
test('restart after committed lost response never creates again; terminal reconciliation clears journal',async()=>{
 const s=setup(),first=s.make();await attempt(first);assert.equal(first.snapshot().state,'recovery');assert.equal(first.canReturnToLegacy(),false)
 first.invalidate()
 const restarted=s.make();assert.ok(await restarted.open());assert.equal(restarted.snapshot().state,'recovery')
 assert.equal(await restarted.recover(),true);assert.equal(restarted.snapshot().ride.rideId,id(5));assert.equal(restarted.canReturnToLegacy(),false)
 s.active(null);assert.equal(await restarted.recover(),true);assert.equal(s.journal.rows.size,0);assert.equal(restarted.canReturnToLegacy(),true)
 assert.equal(s.calls.filter(c=>c.action.endsWith('create')).length,1)
})
test('offline before creation requires server seal; unrelated account cannot inspect pending attempt',async()=>{
 const s=setup();s.mode('offline');await attempt(s.make());s.account(b)
 const other=s.make();assert.ok(await other.open());assert.equal(other.snapshot().pending,false);assert.equal(other.canReturnToLegacy(),true)
 s.account(a);const restarted=s.make();assert.ok(await restarted.open());assert.equal(await restarted.recover(),false);assert.equal(restarted.canReturnToLegacy(),false)
 assert.equal(await restarted.recover({seal:true}),true);assert.equal(s.journal.rows.size,0);assert.equal(restarted.canReturnToLegacy(),true)
})
test('two hosts cannot both submit; storage failure prevents transmission',async()=>{
 const s=setup(),x=s.make(),y=s.make();await x.open();await y.open();x.begin(selection);y.begin({...selection,requestKey:id(9)});await x.quote();await y.quote()
 await Promise.all([x.submit(true),y.submit(true)])
 assert.equal(s.calls.filter(c=>c.action.endsWith('create')).length,1)
 assert.equal(x.canReturnToLegacy(),false);assert.equal(y.canReturnToLegacy(),false)
 const q=setup();q.journal.reserve=async()=>{throw Error('quota')}
 await attempt(q.make());assert.equal(q.calls.filter(c=>c.action.endsWith('create')).length,0)
})
test('active query must be authoritative; invalid account and account switch fail closed',async()=>{
 const s=setup();s.verified(false);const h=s.make();assert.equal(await h.open(),false);assert.equal(h.canReturnToLegacy(),false)
 const q=setup(),x=q.make();await x.open();x.begin(selection);await x.quote();q.account(b);await x.submit(true);assert.equal(q.calls.filter(c=>c.action.endsWith('create')).length,0);assert.equal(x.canReturnToLegacy(),false)
})

test('price change retains journal, allows explicit seal without closing the panel',async()=>{
 let pending=null,creates=0,seals=0
 const host=createDurableRideHost({
  enabled:true,verifyIdentity:async()=>a,activeRide:async()=>({verified:true,ride:null}),
  journal:{read:async()=>pending,reserve:async(_,e)=>{pending={...e};return true},clear:async()=>{pending=null;return true}},
  transport:async body=>{
   if(body.action==='apois_navigation_quote')return {status:200,body:{ok:true,estimated_price:12.34,fare_amount_cents:1234,distance_km:2,duration_min:7,expiresAt:selection.expiresAt}}
   if(body.action==='apois_navigation_create'){creates++;return {status:409,body:{ok:false,error_code:'price_changed',estimated_price:13.34,fare_amount_cents:1334,distance_km:2,duration_min:7,expiresAt:selection.expiresAt}}}
   if(body.action==='apois_navigation_seal'){seals++;return {status:200,body:{ok:true,state:'sealed',requestKey:body.requestKey,selectionId:body.selectionId}}}
   throw Error('unexpected')
  }
 })
 assert.ok(await host.open());assert.ok(host.begin(selection));assert.ok(await host.quote());assert.equal(await host.submit(true),null)
 assert.equal(host.snapshot().state,'ready');assert.equal(host.snapshot().review.quote.fare_amount_cents,1334);assert.equal(host.snapshot().pending,true)
 assert.equal(host.canReturnToLegacy(),false);assert.ok(await host.recover({seal:true}));assert.equal(host.snapshot().state,'ready-to-reopen')
 assert.equal(host.canReturnToLegacy(),true);assert.equal(creates,1);assert.equal(seals,1);assert.equal(pending,null)
})
