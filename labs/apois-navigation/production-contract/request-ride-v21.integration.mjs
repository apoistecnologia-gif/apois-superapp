import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createExperimentalRequestHandler} from './request-ride-v21.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const query=(statement,values=[])=>new Promise((resolve,reject)=>{
 const args=['exec','-i','apois-v21-fixture','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
 values.forEach((v,i)=>args.push('-v','p'+(i+1)+'='+v))
 const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err=''
 child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x)
 child.on('error',reject);child.stdin.on('error',reject)
 child.on('close',code=>{try{if(code)throw Error(err);resolve(out.trim()?JSON.parse(out):null)}catch(e){reject(e)}})
 child.stdin.end("set role service_role;\n"+statement.replace(/\$(\d+)/g,(_,n)=>":'p"+n+"'")+";\n")
})
const actor=id(11),key=id(32)
const s=await query('select apois_nav_lab.confirm_selection($1,$2,$3,1,$4,1)',[actor,key,id(21),id(22)])
assert.ok(s?.selectionId)
let routes=0,quotes=0,dispatch=0,price=12.34,offline=false
const handle=createExperimentalRequestHandler({enabled:true,
 authorize:async session=>session==='fixture'?{allowed:true,authUserId:actor,categoryId:id(90)}:null,
 readSelection:({authUserId,selectionId,requestKey})=>query('select apois_nav_lab.read_selection_v21($1,$2,$3)',[authUserId,selectionId,requestKey]),
 independentMetrics:async (a,b)=>{routes++;assert.deepEqual(a,{lat:-9.4,lng:-40.5});assert.deepEqual(b,{lat:-9.42,lng:-40.51});return offline?null:{source:'OSM_VALHALLA_LAB',distanceKm:2.10,durationMin:7.2}},
 loadFare:async (cat,kind,km,min,details)=>{quotes++;assert.deepEqual([cat,kind,km,min,details],[id(90),'carros',2.1,8,{}]);return price},
 createAtomic:({authUserId,selectionId,requestKey},payload)=>query('select apois_nav_lab.create_passenger_ride_v21($1,$2,$3,$4::jsonb)',[authUserId,selectionId,requestKey,JSON.stringify(payload)]),
 dispatchInitial:async ride=>{dispatch++;assert.equal(await query("select to_jsonb(count(*)) from public.rides where id=$1 and status='procurar_motorista'",[ride.id]),1);return [id(71)]}
})
const body={action:'apois_navigation_quote',selectionId:s.selectionId,requestKey:key,payment_method:'cash'}
assert.equal((await createExperimentalRequestHandler()('fixture',body)).status,409)
assert.equal((await handle('wrong',body)).status,403)
assert.equal((await handle('fixture',{...body,origin:{lat:0,lng:0}})).status,422)
offline=true;assert.equal((await handle('fixture',body)).status,503);offline=false
const quote=await handle('fixture',body);assert.equal(quote.body.fare_amount_cents,1234)
const request={...body,action:'apois_navigation_create',expected_price_cents:1234}
price=13.34;assert.equal((await handle('fixture',request)).body.error_code,'price_changed')
assert.equal(await query('select to_jsonb(count(*)) from public.rides where request_key=$1',[key]),0)
price=12.34
const results=await Promise.all([handle('fixture',request),handle('fixture',request)])
assert.ok(results.every(r=>r.status===200));assert.equal(results[0].body.rideId,results[1].body.rideId)
assert.equal(results.filter(r=>r.body.reused===false).length,1);assert.equal(dispatch,1)
const before=routes, beforeQuotes=quotes
price=99.99;const retry=await handle('fixture',request);assert.equal(retry.body.reused,true);assert.equal(retry.body.estimated_price,12.34)
assert.equal(routes,before);assert.equal(quotes,beforeQuotes);assert.equal(dispatch,1)
console.log('APOIS_V21_REQUEST_HANDLER_SQL_OK',{actualPostgres:true,serviceRole:true,syntheticAuth:true,syntheticMetrics:true,priceChange:true,concurrentReuse:true,dispatchAfterCommit:true})
