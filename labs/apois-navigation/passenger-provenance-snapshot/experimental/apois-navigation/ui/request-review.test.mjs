import test from 'node:test'
import assert from 'node:assert/strict'
import {createExperimentalRideReview} from './request-review.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const t=Date.parse('2026-11-25T15:00:00Z'),expiresAt=new Date(t+60000).toISOString()
const selection={selectionId:id(1),requestKey:id(2),expiresAt,origin:{lat:-9.4,lng:-40.5}}
const quote=(value=1234)=>({ok:true,estimated_price:value/100,fare_amount_cents:value,distance_km:2.1,duration_min:8,expiresAt})
const created=(reused=false)=>({ok:true,rideId:id(3),status:'procurar_motorista',estimated_price:12.34,fare_amount_cents:1234,reused})
test('disabled by default; no coordinates or client fare in quote; explicit review required',async()=>{
 assert.equal(createExperimentalRideReview(),null)
 const calls=[];const review=createExperimentalRideReview({enabled:true,now:()=>t,transport:async body=>{calls.push(body);return {status:200,body:body.action.endsWith('quote')?quote():created()}}})
 assert.ok(review.begin(selection));assert.equal(await review.submit(true),null);assert.equal(calls.length,0)
 assert.ok(await review.requestQuote());assert.equal(await review.submit(),null)
 assert.deepEqual(calls[0],{action:'apois_navigation_quote',selectionId:id(1),requestKey:id(2),payment_method:'cash'})
 assert.equal((await review.submit(true)).rideId,id(3));assert.equal(calls[1].expected_price_cents,1234);assert.equal(review.cancel(),false)
})
test('price change requires another explicit confirmation',async()=>{
 let creates=0
 const r=createExperimentalRideReview({enabled:true,now:()=>t,transport:async body=>body.action.endsWith('quote')?{status:200,body:quote()}:(++creates===1?{status:409,body:{...quote(1334),ok:false,error_code:'price_changed'}}:{status:200,body:{...created(),estimated_price:13.34,fare_amount_cents:1334}})})
 r.begin(selection);await r.requestQuote();assert.equal(await r.submit(true),null)
 assert.equal(r.snapshot().quote.fare_amount_cents,1334);assert.equal(r.snapshot().state,'review');assert.equal(creates,1)
 assert.equal(await r.submit(false),null);assert.equal((await r.submit(true)).fare_amount_cents,1334)
})
test('cancel while quoting discards late response',async()=>{
 let finish,signal
 const r=createExperimentalRideReview({enabled:true,now:()=>t,transport:(_,s)=>{signal=s;return new Promise(resolve=>finish=resolve)}})
 r.begin(selection);const pending=r.requestQuote();assert.equal(r.cancel(),true);assert.ok(signal.aborted)
 finish({status:200,body:quote()});assert.equal(await pending,null);assert.equal(r.snapshot().state,'idle')
})
test('ambiguous create blocks return and retries same key even after expiry',async()=>{
 let clock=t,creates=0;const calls=[]
 const r=createExperimentalRideReview({enabled:true,now:()=>clock,transport:async body=>{calls.push(body);if(body.action.endsWith('quote'))return {status:200,body:quote()};if(++creates===1)throw Error('lost response');return {status:200,body:created(true)}}})
 r.begin(selection);await r.requestQuote();assert.equal(await r.submit(true),null)
 assert.equal(r.snapshot().state,'uncertain');assert.equal(r.cancel(),false);assert.equal(r.begin({...selection,requestKey:id(4)}),false)
 clock=t+61000;assert.equal((await r.submit(true)).rideId,id(3));assert.deepEqual(calls[1],calls[2])
})
test('expired unsent review cannot create',async()=>{
 let clock=t,calls=0;const r=createExperimentalRideReview({enabled:true,now:()=>clock,transport:async()=>{calls++;return {status:200,body:quote()}}})
 r.begin(selection);await r.requestQuote();clock=t+60000;assert.equal(await r.submit(true),null);assert.equal(calls,1);assert.equal(r.snapshot().state,'expired');assert.equal(r.cancel(),true)
})
