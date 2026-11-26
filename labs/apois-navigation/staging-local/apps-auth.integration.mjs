import assert from 'node:assert/strict'
import {readFileSync,realpathSync} from 'node:fs'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {randomUUID,randomBytes} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createServer} from 'node:http'
import {createLoopbackFixtureSessionVerifier} from '../driver-broker/driver-local-session.mjs'
import {bearerToken} from '../production-contract/edge-session-v21.mjs'
import {createNavigationControl} from '../production-contract/navigation-control-v21.mjs'
import {createV21ExperimentalAction} from '../production-contract/v21-edge-adapter.mjs'
import {createDriverControl} from '../production-contract/driver-control-v21.mjs'
import {createVerifiedHostTransport} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/verified-host-transport.mjs'
import {createPassengerPanel} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/passenger-panel.mjs'
import {createDurableRideHost} from '../passenger-provenance-snapshot/experimental/apois-navigation/ui/durable-ride-host.mjs'
const target=realpathSync(process.argv[2]),temp=realpathSync(process.env.RUNNER_TEMP)
assert.equal(target,join(temp,'apois-navigation-local'))
const status=JSON.parse(readFileSync(join(target,'status.json'),'utf8'))
const url=status.API_URL,db=status.DB_URL,anon=status.ANON_KEY,service=status.SERVICE_ROLE_KEY
assert.ok(['http://127.0.0.1:54321','http://localhost:54321'].includes(url))
const dbUrl=new URL(db);assert.ok(['127.0.0.1','localhost'].includes(dbUrl.hostname)&&dbUrl.port==='54322')
assert.ok(typeof anon==='string'&&typeof service==='string'&&anon!==service)
const {createClient}=createRequire(join(target,'package.json'))('@supabase/supabase-js')
const client=(key=anon)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const admin=client(service)
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apois-navigation-local','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:s+';\n',encoding:'utf8',timeout:5000}).trim()
const lit=v=>"'"+String(v).replaceAll("'","''")+"'"
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const rpc=async(name,args,signal)=>{
 let call=admin.rpc(name,args)
 if(signal)call=call.abortSignal(signal)
 const {data,error}=await call
 if(error)throw Error('Local RPC failed: '+name+' '+error.code)
 return data
}
async function account(role){
 const email=role+'-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url')
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true})
 assert.ok(!error&&data.user?.id,'local account creation')
 const c=client(),login=await c.auth.signInWithPassword({email,password})
 assert.ok(!login.error&&login.data.session?.access_token,'real local password authentication')
 return {id:data.user.id,client:c,token:login.data.session.access_token}
}
const passenger=await account('passenger'),driver=await account('driver'),other=await account('other')
const passengerId=randomUUID(),profile=randomUUID(),driverId=randomUUID(),otherProfile=randomUUID(),otherDriver=randomUUID()
sql('insert into public.users(id,auth_user_id) values '+[[passengerId,passenger.id],[profile,driver.id],[otherProfile,other.id]].map(row=>'('+row.map(lit).join(',')+')').join(','))
sql("insert into public.drivers(id,user_id,approval_status,subscription_status,category,is_online) values "+[[driverId,profile],[otherDriver,otherProfile]].map(row=>'('+row.map(lit).join(',')+",'aprovado','active','carros',true)").join(','))
const issuer=JSON.parse(Buffer.from(passenger.token.split('.')[1],'base64url')).iss
assert.ok(['http://127.0.0.1:54321/auth/v1','http://localhost:54321/auth/v1'].includes(issuer),'unexpected Auth issuer')
const verify=createLoopbackFixtureSessionVerifier({projectUrl:issuer.slice(0,-8),sessionPolicyConfirmed:true,timeoutMs:2500,
 getUser:async token=>{const {data,error}=await client().auth.getUser(token);return error?null:data.user},
 sessionExists:async({authUserId,sessionId},signal)=>await rpc('apois_nav_lab_session_exists_v21',{p_auth_user:authUserId,p_session:sessionId},signal)===true
})
assert.equal(await verify(passenger.token,AbortSignal.timeout(3000)),passenger.id)
const digest='a'.repeat(64),control=createNavigationControl({confirmationEnabled:true,recoveryEnabled:true,catalogPolicy:{version:1,extractHash:digest},
 verifySession:t=>verify(t,AbortSignal.timeout(3000)),allowPilot:u=>u===passenger.id,rpc})
let dispatch=0,creates=0
const driverControl=createDriverControl({enabled:true,localOnly:true,allowPilot:u=>u===driver.id||u===other.id,authority:async(token,req,signal)=>{
 const user=await verify(token,signal);if(!user)return null
 const proof=await rpc('apois_nav_lab_driver_proof_v21',{p_auth_user:user,p_ride:req.rideId,p_phase:req.phase},signal)
 return await verify(token,signal)===user?proof:null
}})
const server=createServer(async(req,res)=>{
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
 try{
  if(req.method!=='POST')return send(405,{ok:false})
  const token=bearerToken(req.headers.authorization)
  if(!token)return send(401,{ok:false})
  let raw='',bytes=0
  for await(const b of req){bytes+=b.length;if(bytes>4096)return send(413,{ok:false});raw+=b.toString()}
  const body=JSON.parse(raw)
  const user=await verify(token,AbortSignal.timeout(3000))
  if(!user)return send(401,{ok:false})
  let result
  if(req.url==='/functions/v1/apois-navigation-control')result=await control(token,body)
  else if(req.url==='/functions/v1/request-ride'){
   if(user!==passenger.id)return send(403,{ok:false})
   if(body.action==='apois_navigation_create')creates++
   const action=createV21ExperimentalAction({enabled:true,admin,authUserId:user,passengerId,
    independentMetrics:async()=>({source:'OSM_VALHALLA_LAB',distanceKm:2.1,durationMin:7.2}),
    loadFare:async()=>12.34,dispatchInitial:async()=>{dispatch++;return []},
    verifyCurrentSession:async()=>await verify(token,AbortSignal.timeout(3000))===user})
   result=await action(body)
  }else if(req.url==='/functions/v1/apois-navigation-driver-control')result=await driverControl(token,body,AbortSignal.timeout(5000))
  else return send(404,{ok:false})
  return send(result.status,result.body)
 }catch{return send(503,{ok:false})}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
try{
 const base='http://127.0.0.1:'+server.address().port+'/functions/v1/'
 let lose=true
 const invoke=async(name,{body,headers})=>{
  const response=await fetch(base+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)})
  if(body.action==='apois_navigation_create'&&response.ok&&lose){lose=false;await response.arrayBuffer();throw Error('CI lost response after committed creation')}
  return response.ok?{data:await response.json()}:{error:{context:response}}
 }
 const adapter=createVerifiedHostTransport({enabled:true,account:passenger.id,auth:passenger.client.auth,invoke,controlFunction:'apois-navigation-control'})
 const catalog=await adapter.readCatalog({version:1,extractHash:digest},AbortSignal.timeout(12000));assert.equal(catalog.rows.length,2)
 const key=randomUUID(),panel=createPassengerPanel({enabled:true,catalog,newKey:()=>key,confirm:adapter.confirm})
 assert.ok(panel.open());assert.ok(panel.selectSearch(catalog.rows.find(r=>r.id===id(21)).label,id(21)));assert.ok(panel.focus('destination'));assert.ok(panel.selectSearch(catalog.rows.find(r=>r.id===id(22)).label,id(22)));assert.ok(await panel.confirm())
 let record=null
 const journal={read:async()=>record,reserve:async(_,e)=>{if(record)return false;record={...e};return true},clear:async(_,e)=>{if(JSON.stringify(record)!==JSON.stringify(e))return false;record=null;return true}}
 const first=createDurableRideHost({enabled:true,journal,...adapter});assert.ok(await first.open());assert.ok(first.begin(panel.confirmedInput()));assert.ok(await first.quote())
 assert.equal(await first.submit(true),null);assert.ok(record);first.invalidate()
 const next=createDurableRideHost({enabled:true,journal,...adapter});assert.ok(await next.open());assert.ok(await next.recover())
 const ride=next.snapshot().ride.rideId;assert.ok(ride);assert.equal(dispatch,1);assert.equal(creates,1)
 const driverCall=async(actor,phase)=>fetch(base+'apois-navigation-driver-control',{method:'POST',headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify({action:'target',rideId:ride,phase})})
 assert.equal((await driverCall(driver,'PICKUP')).status,403)
 sql("update public.rides set status='motorista_a_caminho',driver_id="+lit(driverId)+",accepted_driver_id="+lit(driverId)+",accepted_at=clock_timestamp() where id="+lit(ride))
 assert.equal((await driverCall(other,'PICKUP')).status,403)
 const pickup=await driverCall(driver,'PICKUP');assert.equal(pickup.status,200);assert.deepEqual((await pickup.json()).target.evidence.point,{lat:-9.4,lon:-40.5})
 sql("update public.rides set status='motorista_chegou',driver_arrived_at=clock_timestamp() where id="+lit(ride))
 assert.equal((await driverCall(driver,'PICKUP')).status,403)
 sql("update public.rides set status='em_viagem',started_at=clock_timestamp() where id="+lit(ride))
 const trip=await driverCall(driver,'TRIP');assert.equal(trip.status,200);assert.deepEqual((await trip.json()).target.evidence.point,{lat:-9.42,lon:-40.51})
 const denied=await passenger.client.rpc('apois_nav_lab_driver_proof_v21',{p_auth_user:driver.id,p_ride:ride,p_phase:'TRIP'});assert.ok(denied.error,'client direct service-only RPC must be denied')
 const sessionId=JSON.parse(Buffer.from(driver.token.split('.')[1],'base64url')).session_id
 sql('delete from auth.sessions where id='+lit(sessionId)+' and user_id='+lit(driver.id))
 assert.equal((await driverCall(driver,'TRIP')).status,401)
 sql("update public.rides set status='finalizada',completed_at=clock_timestamp() where id="+lit(ride))
 assert.ok(await next.recover());assert.equal(record,null);assert.equal(creates,1)
 console.log('APOIS_LOCAL_AUTH_APPS_CONTRACT_OK',JSON.stringify({realAuth:true,realPostgREST:true,actualSql:true,httpTransport:true,passengerRecovery:true,driverPickup:true,trip:true,sessionRevoked:true,terminalRelease:true,dispatchFixture:true,routeMetricsFixture:true,fareFixture:true}))
}finally{await new Promise(resolve=>server.close(resolve))}
