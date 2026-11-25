import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {createInterface} from 'node:readline'
import {createRecoveryAction} from './recovery-v21.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(11),passenger=id(1),wrong=id(12),key1=id(101),key2=id(102),key3=id(103)
const args=['exec','-i','apois-v21-fixture','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
const sql=(statement)=>{let x=execFileSync('docker',args,{input:statement+';\n',encoding:'utf8',timeout:5000}).trim();return x?JSON.parse(x):null}
const lit=v=>"'"+String(v).replaceAll("'","''")+"'"
function session(){
 const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']})
 let error='';child.stderr.on('data',c=>error+=c);child.stdin.on('error',()=>{})
 const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();let seq=0
 return {async cmd(statement){
  const mark='APOIS_DONE_'+(++seq)
  child.stdin.write(statement+';\n\\echo '+mark+'\n')
  let out=[]
  while(true){const {value,done}=await lines.next();if(done)throw Error(error||'psql ended');if(value===mark)return out.length?JSON.parse(out.join('\n')):null;out.push(value)}
 },close(){child.stdin.end('rollback;\n\\q\n');child.kill()}}
}
const payload=lit(JSON.stringify({origin:{lat:-9.4,lng:-40.5},destination:{lat:-9.42,lng:-40.51},category:'carros',intermediates:[],payment_method:'cash',estimated_price:12.34,distance_km:2.1,duration_min:8,expected_price_cents:1234}))
// Other tests created a searching ride for actor. Use fresh synthetic profiles.
sql("insert into public.users(id,auth_user_id) values ("+lit(id(201))+","+lit(id(211))+"),("+lit(id(202))+","+lit(id(212))+"),("+lit(id(203))+","+lit(id(213))+")")
const select=(a,k)=>sql("select apois_nav_lab.confirm_selection("+[a,k,id(21)].map(lit).join(',')+",1,"+lit(id(22))+",1)").selectionId
const a1=id(211),a2=id(212),a3=id(213)
const s1=select(a1,key1),s2=select(a2,key2),s3=select(a3,key3)
const lock=a=>"select public.apois_lock_passenger_ride_financial_gate("+lit(a)+")"
const create=(a,s,k)=>"select apois_nav_lab.create_passenger_ride_v21("+[a,s,k].map(lit).join(',')+","+payload+"::jsonb)"
const reconcile=(a,s,k,seal)=>"select public.apois_nav_lab.reconcile_selection_v21("+[a,s,k].map(lit).join(',')+","+seal+")"
const settle=async(first,second,firstSql,secondSql,appName)=>{
 await first.cmd('begin')
 const one=await first.cmd(firstSql)
 await second.cmd("set application_name="+lit(appName))
 const two=second.cmd(secondSql)
 let waited=false
 for(let n=0;n<80;n++){
  if(sql("select to_jsonb(count(*)) from pg_stat_activity where application_name="+lit(appName)+" and wait_event_type='Lock'")===1){waited=true;break}
  await new Promise(r=>setTimeout(r,25))
 }
 assert.ok(waited,'second transaction must wait on lock')
 await first.cmd('commit');return [one,await two]
}
const one=session(),two=session()
try{
 // Creation wins, sealing observes the same committed ride, never cancels it.
 let [r,z]=await settle(one,two,create(a1,s1,key1),reconcile(a1,s1,key1,true),'apois_seal_wait')
 assert.equal(z.state,'ride');assert.equal(z.ride.rideId,r.rideId)
 // Seal wins, later create sees sealed selection and inserts nothing.
 ;[z,r]=await settle(one,two,reconcile(a2,s2,key2,true),create(a2,s2,key2),'apois_create_wait')
 assert.equal(z.state,'sealed');assert.equal(r,null)
 assert.equal(sql("select to_jsonb(count(*)) from public.rides where request_key="+lit(key2)),0)
 assert.equal(sql(reconcile(wrong,s1,key1,false)),null)
 assert.equal(sql(reconcile(a2,s2,key2,false)).state,'sealed')
 // Existing ordinary active ride beats experimental create using the exact
 // observed financial lock + partial unique index in the fixture.
 const ordinary=id(104)
 const ordinarySql="insert into public.rides(passenger_id,category,status,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,origin_name,destination_name,estimated_price,payment_method,request_key) values ("+lit(id(203))+",'carros','procurar_motorista','{\"lat\":-9.4,\"lng\":-40.5}','{\"lat\":-9.42,\"lng\":-40.51}',-9.4,-40.5,-9.42,-40.51,'A','B',12.34,'cash',"+lit(ordinary)+") returning to_jsonb(id)"
 ;[r,z]=await settle(one,two,ordinarySql,create(a3,s3,key3),'apois_ordinary_wait')
 assert.ok(r);assert.equal(z,null)
 assert.equal(sql("select to_jsonb(count(*)) from public.rides where passenger_id="+lit(id(203))),1)
 assert.equal(sql("select apois_nav_lab.active_ride_v21("+lit(a3)+")").ride.rideId,r)
 const action=createRecoveryAction({enabled:true,verifySession:async s=>s==='a'?a1:null,rpc:async(name,p)=>sql(name.endsWith('active_v21')?"select public."+name+"("+lit(p.p_auth_user)+")":"select public."+name+"("+[p.p_auth_user,p.p_selection,p.p_request_key].map(lit).join(',')+","+p.p_seal+")")})
 assert.equal((await action('wrong',{action:'apois_navigation_active'})).status,401)
 assert.equal((await action('a',{action:'apois_navigation_recover',selectionId:s1,requestKey:key1,authUserId:wrong})).status,422)
 assert.equal((await action('a',{action:'apois_navigation_recover',selectionId:s1,requestKey:key1})).body.state,'ride')
 assert.equal((await action('a',{action:'apois_navigation_active'})).body.verified,true)
 assert.equal(sql("select to_jsonb(has_function_privilege('authenticated','public.apois_nav_lab_reconcile_v21(uuid,uuid,uuid,boolean)','execute'))"),false)
 console.log('APOIS_V21_RECOVERY_FENCE_OK',JSON.stringify({createWins:true,sealWins:true,ordinaryWins:true,wrongOwnerDenied:true,activeVerified:true}))
}finally{one.close();two.close()}
