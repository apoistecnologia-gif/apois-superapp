// INV-054/055/056: no network, accounts, offers, payments or database writes.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(p),"utf8");
const driver=read((process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista")+"/src/lib/driverRideLifecycle.mobile.ts");
const finish=read("supabase/functions/driver-finish-redispatch/index.ts");
const cancel=read("supabase/functions/driver-cancel-redispatch/index.ts");
const reject=read("supabase/functions/driver-reject-redispatch/index.ts");
const dispatch=read("supabase/functions/dispatch-ride/index.ts");
const recovery=read("supabase/functions/driver-redispatch-recovery/index.ts");
const migration=read("supabase/corridas-forward-migrations/20261109_report07_no_show_reason_code_QA_NOT_APPLIED.sql");

test("INV-054: integrated source is not proof of deployed endpoints",()=>{
 for(const slug of ["driver-cancel-redispatch","driver-reject-redispatch","dispatch-ride"]){
   assert.match((slug==="dispatch-ride"?dispatch:slug==="driver-cancel-redispatch"?cancel:reject),/Deno\.serve\(/);
 }
 assert.match(driver,/Operação de corrida temporariamente indisponível/);
 assert.doesNotMatch(driver,/callRpc\("driver_cancel_ride"/);
 assert.doesNotMatch(driver,/callRpc\("driver_reject_ride"/);
 assert.match(cancel,/driverClient\.rpc\("driver_cancel_ride"/);
 assert.match(reject,/driverClient\.rpc\("driver_reject_ride"/);
 assert.match(cancel,/redispatch: "deferred"/);
 assert.match(reject,/redispatch: "deferred"/);
});
test("INV-056: no-show requires explicit contract + arrival and original wait",()=>{
 assert.match(driver,/reason_code: reasonCode/);
 assert.match(cancel,/driver_no_show_contract_unavailable/);
 assert.match(cancel,/ride\.driver_no_show_code_v1/);
 assert.match(cancel,/APOIS_NO_SHOW_V1:/);
 assert.match(migration,/QA_NOT_APPLIED/);
 assert.match(migration,/APOIS_NO_SHOW_V1:/);
 assert.match(migration,/não apareceu/);
 assert.match(migration,/nao apareceu/);
 assert.match(migration,/nã£o apareceu/);
 assert.match(migration,/no_show_requires_driver_arrival/);
 assert.match(migration,/driver_no_show_wait_not_elapsed/);
 assert.match(migration,/v_no_show_wait_minutes numeric:=2/);
 assert.match(migration,/ride\.driver_cancelled_for_redispatch/);
 assert.match(migration, /\$function\$;/);
});
test("INV-055: released-queue dispatch keeps confirmed completion distinct",()=>{
 assert.match(finish,/driverClient\.rpc\("driver_finish_ride"/);
 assert.match(finish,/released_queued_ride_id/);
 assert.match(finish,/promoted_queued_ride_id/);
 assert.match(finish,/completion:"confirmed"/);
 assert.match(finish,/redispatch:"deferred"/);
 assert.match(finish,/recheck_ride_state:true/);
 assert.match(finish,/mode:"initial"/);
 assert.match(dispatch,/APOIS_REPORT07_DISPATCH_CAS_V1/);
 assert.match(dispatch,/\.eq\("dispatch_attempts", Number\(rawRide\.dispatch_attempts \?\? 0\)\)/);
 assert.match(dispatch,/if \(rawRide\.request_expires_at\)/);
 assert.match(recovery,/auth!==SERVICE/);
 assert.match(recovery,/ride\.queued_released_ineligible_driver/);
 assert.match(recovery,/ride\.driver_cancelled_for_redispatch/);
 assert.match(recovery,/scan_limited/);
});
test("INV-055: post-commit dispatcher success, server failure and network loss (mocks)",async()=>{
 const start=finish.indexOf("async function continueReleasedQueue(");
 const opening=finish.indexOf("{\n",start);
 const stop=finish.indexOf("\n}\n\nDeno.serve",opening);
 assert.ok(start>=0&&opening>=0&&stop>opening);
 const raw=finish.slice(opening+2,stop).replace(/ as \{ok\?:boolean;action\?:string\}/g,"");
 const invoke=new Function("fetch","URL","SERVICE","console","rideId",`return (async()=>{${raw}})()`);
 const rideId="00000000-0000-4000-8000-000000000001";
 let calls=0;
 const good=await invoke(async(url,init)=>{
   calls++;assert.match(url,/dispatch-ride$/);
   assert.equal(JSON.parse(init.body).mode,"initial");
   assert.equal(JSON.parse(init.body).ride_id,rideId);
   return {ok:true,status:200,json:async()=>({ok:true,action:"offered"})};
 },"https://example.test","service-test",{error:()=>{}},rideId);
 assert.equal(good.redispatch,"offered");assert.equal(calls,1);
 const bad=await invoke(async()=>({ok:false,status:503,json:async()=>({error:"unavailable"})}),
   "https://example.test","service-test",{error:()=>{}},rideId);
 assert.deepEqual(bad,{redispatch:"deferred",status:503});
 const offline=await invoke(async()=>{throw Error("offline")},
   "https://example.test","service-test",{error:()=>{}},rideId);
 assert.deepEqual(offline,{redispatch:"deferred",status:null});
});
