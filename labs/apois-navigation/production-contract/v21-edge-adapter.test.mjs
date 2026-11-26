import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {loadFare} from './observed-fare-v21.ts'
import {createV21ExperimentalAction,localValhallaMetrics} from './v21-edge-adapter.mjs'
const reference=readFileSync(new URL('./observed-request-ride-v21.ts',import.meta.url),'utf8')
const candidate=readFileSync(new URL('./candidate-request-ride-v21.ts',import.meta.url),'utf8')
const patch="\n\n    // APOIS_NAVIGATION_LAB_V21: opt-in verified pilot, private HTTPS quote only.\n    // The existing request path below is unchanged.\n    if (body?.action === \"apois_navigation_quote\" || body?.action === \"apois_navigation_create\") {\n      if (Deno.env.get(\"APOIS_NAVIGATION_EXPERIMENTAL_ENABLED\") !== \"true\") return json({ok:false,error_code:\"experimental_navigation_disabled\"},409);\n      if (!pilotAllowed(auth.id,Deno.env.get(\"APOIS_NAVIGATION_PILOT_AUTH_IDS\"))) return json({ok:false,error_code:\"pilot_not_allowed\"},403);\n      const token=bearerToken(req.headers.get(\"authorization\"));\n      if(!token)return json({ok:false,error_code:\"unauthorized\"},401);\n      try{\n        if(await verifiedExperimentalSession(url,serviceRole)(token,req.signal)!==auth.id)return json({ok:false,error_code:\"unauthorized\"},401);\n      }catch{return json({ok:false,error_code:\"session_verification_unavailable\"},503);}\n      const handle = createV21ExperimentalAction({\n        enabled: true,\n        admin, authUserId: auth.id, passengerId: userRow.id,\n        independentMetrics: pilotRemoteQuoteMetrics({authUserId:auth.id,readEnv:(name:string)=>Deno.env.get(name)}),\n        loadFare: (categoryId: string, category: string, km: number, min: number, details: Record<string, unknown>) =>\n          loadFare(admin, categoryId, category, km, min, details),\n        dispatchInitial: dispatch,\n        verifyCurrentSession: async()=>await verifiedExperimentalSession(url,serviceRole)(token,req.signal)===auth.id,\n      });\n      const result = await handle(body);\n      return json(result.body, result.status);\n    }\n",imp="import { createV21ExperimentalAction } from \"./v21-edge-adapter.mjs\";\nimport { pilotRemoteQuoteMetrics, pilotAllowed } from \"./pilot-remote-quote.mjs\";\nimport { bearerToken, createV21EdgeSession } from \"./edge-session-v21.mjs\";\n",helper="// Only the experimental quote/create path uses this extra session gate.\nlet experimentalVerifier:ReturnType<typeof createV21EdgeSession>|null=null;\nfunction verifiedExperimentalSession(url:string,serviceRole:string){\n const anon=Deno.env.get(\"SUPABASE_ANON_KEY\")??\"\";\n return experimentalVerifier??=createV21EdgeSession({projectUrl:url,\n  sessionPolicyConfirmed:Deno.env.get(\"APOIS_NAVIGATION_SESSION_POLICY\")===\"existence-not-after-reviewed\",\n  authClient:createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),\n  serviceClient:createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})});\n}\n\n",serve="Deno.serve(async (req: Request) => {",anchor="    const body = await req.json();"
test('candidate changes only three explicit insertion points; fare source exactly matches observed v21',()=>{
 assert.equal(reference.split(anchor).length,2)
 assert.equal(reference.split(serve).length,2)
 assert.equal(candidate,imp+reference.replace(serve,helper+serve).replace(anchor,anchor+patch))
 const rounded=reference.split('\n').find(l=>l.startsWith('const rounded = '))
 const fare=rounded+'\n\n'+reference.slice(reference.indexOf('function extraFare('),reference.indexOf('// APOIS_BACKEND_UNIFIED_DISPATCH_V1')).replace('async function loadFare(','export async function loadFare(')
 assert.equal(readFileSync(new URL('./observed-fare-v21.ts',import.meta.url),'utf8'),fare)
 console.log('APOIS_V21_SOURCE_SHA256',createHash('sha256').update(reference).digest('hex'))
})
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const req={action:'apois_navigation_quote',selectionId:id(3),requestKey:id(4),payment_method:'cash'}
const response={code:'Ok',routes:[{distance:2100,duration:432}]}
test('server action retains exact existing fare formula and dispatches only after private committed RPC',async()=>{
 let committed=false,dispatch=0,blocked=false,readCalls=0
 const admin={
  from(table){const q={select(){return q},eq(){return q},async maybeSingle(){return table==='passenger_wallets'?{data:{is_blocked:blocked}}:{data:{id:id(9),code:'carros'}}},then(resolve){resolve({data:[{city:'petrolina',base_fare:3,per_km:2,per_min:0.5,min_fare:10}]})}};return q},
  async rpc(name,args){assert.equal(args.p_auth_user,id(1));assert.equal(args.p_selection,id(3));assert.equal(args.p_request_key,id(4))
   if(name==='apois_nav_lab_read_selection_v21'){readCalls++;return {data:committed?{linked:true}:{linked:false,origin:{lat:-9.4,lng:-40.5},destination:{lat:-9.42,lng:-40.51},expiresAt:new Date(Date.now()+60000).toISOString()}}}
   assert.equal(name,'apois_nav_lab_create_ride_v21')
   const reused=committed
   if(!reused){assert.equal(args.p_payload.estimated_price,11.2);assert.equal(args.p_payload.duration_min,8);committed=true}
   return {data:{rideId:id(5),status:'procurar_motorista',estimated_price:11.2,fare_amount_cents:1120,payment_status:'pending',reused}}
  }
 }
 const route=localValhallaMetrics(async(url,options)=>{assert.equal(url,'http://127.0.0.1:8002/route');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body).locations,[{lat:-9.4,lon:-40.5},{lat:-9.42,lon:-40.51}]);return new Response(JSON.stringify(response))})
 const handler=createV21ExperimentalAction({enabled:true,admin,authUserId:id(1),passengerId:id(2),independentMetrics:route,loadFare:(...args)=>loadFare(admin,...args),dispatchInitial:async()=>{assert.ok(committed);dispatch++;return [id(6)]},verifyCurrentSession:async()=>true})
 assert.equal((await createV21ExperimentalAction()(req)).status,409)
 blocked=true;assert.equal((await handler(req)).status,403);assert.equal(readCalls,0);blocked=false
 const quote=await handler(req);assert.equal(quote.body.fare_amount_cents,1120);assert.equal(committed,false)
 const create={...req,action:'apois_navigation_create',expected_price_cents:1120}
 assert.equal((await handler(create)).body.rideId,id(5));assert.equal(dispatch,1)
 assert.equal((await handler(create)).body.reused,true);assert.equal(dispatch,1)
})
test('route adapter rejects invalid data and oversized response',async()=>{
 const a={lat:-9.4,lng:-40.5},b={lat:-9.42,lng:-40.51}
 assert.equal(await localValhallaMetrics(async()=>new Response(JSON.stringify({code:'NoRoute'})))(a,b),null)
 assert.equal(await localValhallaMetrics(async()=>new Response('x'.repeat(1048577)))(a,b),null)
})

test('pilot allowlist defaults to deny and private HTTPS quote has no fallback',async()=>{
 const {pilotAllowed,pilotRemoteQuoteMetrics}=await import('./pilot-remote-quote.mjs')
 assert.equal(pilotAllowed(id(1),undefined),false)
 assert.equal(pilotAllowed(id(1),id(2)),false)
 assert.equal(pilotAllowed(id(1),' '+id(1)+','+id(2)),true)
 let calls=0
 const a={lat:-9.4,lng:-40.5},b={lat:-9.42,lng:-40.51}
 const env={APOIS_NAVIGATION_QUOTE_ENDPOINT:'https://router.example.test/quote/route',APOIS_NAVIGATION_QUOTE_KEY_ID:'pilot',APOIS_NAVIGATION_QUOTE_SECRET:'A'.repeat(43)}
 const metrics=pilotRemoteQuoteMetrics({authUserId:id(1),readEnv:n=>env[n],fetcher:async(url,opts)=>{
  calls++;assert.equal(url,env.APOIS_NAVIGATION_QUOTE_ENDPOINT);assert.equal(opts.redirect,'error')
  assert.match(opts.headers.authorization,/^APOISQuote /);return new Response(JSON.stringify(response))
 }})
 assert.deepEqual(await metrics(a,b),{source:'OSM_VALHALLA_LAB',distanceKm:2.1,durationMin:7.2})
 delete env.APOIS_NAVIGATION_QUOTE_SECRET;assert.equal(await metrics(a,b),null);assert.equal(calls,1)
 env.APOIS_NAVIGATION_QUOTE_SECRET='A'.repeat(43);env.APOIS_NAVIGATION_QUOTE_ENDPOINT='http://router.example.test/quote/route';assert.equal(await metrics(a,b),null);assert.equal(calls,1)
})

 test('revocation during independent routing blocks quote and atomic creation; recovery also checks session',async()=>{
 const {createExperimentalRequestHandler}=await import('./request-ride-v21.mjs')
 let live=true,linked=false,writes=0,routes=0
 const handler=createExperimentalRequestHandler({enabled:true,authorize:async()=>({authUserId:id(1),categoryId:id(9),allowed:true}),readSelection:async()=>linked?{linked:true}:{linked:false,origin:{lat:-9.4,lng:-40.5},destination:{lat:-9.42,lng:-40.51},expiresAt:new Date(Date.now()+60000).toISOString()},independentMetrics:async()=>{routes++;live=false;return {source:'OSM_VALHALLA_LAB',distanceKm:2.1,durationMin:7.2}},loadFare:async()=>11.2,createAtomic:async()=>{writes++;throw Error('must not write')},dispatchInitial:async()=>{throw Error('must not dispatch')},revalidate:async()=>live})
 assert.equal((await handler(null,req)).body.error_code,'session_not_current')
 live=true;const create={...req,action:'apois_navigation_create',expected_price_cents:1120}
 assert.equal((await handler(null,create)).body.error_code,'session_not_current')
 linked=true;assert.equal((await handler(null,create)).body.error_code,'session_not_current')
 assert.equal(writes,0);assert.equal(routes,2)
 })

test('ride creation only returns the public SQL contract and never dispatches an invalid row',async()=>{
 const {createExperimentalRequestHandler}=await import('./request-ride-v21.mjs')
 const valid={rideId:id(5),status:'procurar_motorista',reused:false,estimated_price:11.2,fare_amount_cents:1120,payment_status:'pending'}
 let row=valid,dispatch=0
 const handler=createExperimentalRequestHandler({enabled:true,authorize:async()=>({authUserId:id(1),categoryId:id(9),allowed:true}),readSelection:async()=>({linked:true}),independentMetrics:async()=>null,loadFare:async()=>0,createAtomic:async()=>row,dispatchInitial:async()=>{dispatch++;return []},revalidate:async()=>true})
 const create={...req,action:'apois_navigation_create',expected_price_cents:1120}
 for(const status of ['unrecognized','finalizada']){row={...valid,status};assert.equal((await handler(null,create)).status,409)}
 row={...valid,payment_status:'unrecognized'};assert.equal((await handler(null,create)).status,409);assert.equal(dispatch,0)
 row={...valid,reused:true,status:'finalizada',privateField:'test',ok:false};assert.deepEqual((await handler(null,create)).body,{ok:true,...valid,reused:true,status:'finalizada',candidates:0});assert.equal(dispatch,0)
})

test('enabled request handlers require explicit session revalidation; disabled path stays inert',async()=>{
 const {createExperimentalRequestHandler}=await import('./request-ride-v21.mjs')
 const noop=async()=>null
 assert.throws(()=>createV21ExperimentalAction({enabled:true}),/explicit session verifier/)
 assert.throws(()=>createExperimentalRequestHandler({enabled:true,authorize:noop,readSelection:noop,independentMetrics:noop,loadFare:noop,createAtomic:noop,dispatchInitial:noop}),/Missing trusted server adapter/)
 assert.equal((await createV21ExperimentalAction()(req)).status,409)
})
