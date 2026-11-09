// INV-057: real runtime fragment + report fixer on a disposable pinned hook.
// No Auth, browser, Supabase calls, notifications or APK.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const pin=resolve(root,"sources/apois-corridas-passageiro/src/hooks/rides/use-active-ride.tsx");
const runtime=resolve(root,"scripts/harden-corridas-superapp-runtime.mjs");
const fixer=resolve(root,"scripts/fix-report08-passenger-redispatch-v1.mjs");
const stamp=n=>"2026-11-09T10:"+String(n).padStart(2,"0")+":00.000000Z";
const ride=(status,minute,driver,accepted,id="same-ride")=>({
  id,status,updated_at:stamp(minute),driver_id:driver??undefined,
  driver_name:driver??undefined,accepted_at:accepted,
});
function runtimeHook(original){
 const code=readFileSync(runtime,"utf8");
 const start=code.indexOf("patch('.work/corridas/src/hooks/rides/use-active-ride.tsx'");
 const end=code.indexOf("\npatch('.work/corridas/src/hooks/use-push-notifications.tsx'",start);
 assert.ok(start>=0&&end>start);
 let out=original;
 new Function("patch",code.slice(start,end))((path,transform)=>{out=transform(out);});
 return out;
}
function logic(output){
 const start=output.indexOf("function report08RideVersion(");
 const end=output.indexOf("function readErrorMessage",start);
 assert.ok(start>=0&&end>start);
 const js=output.slice(start,end)
 .replace("function report08RideVersion(value: string): number | null {","function report08RideVersion(value) {")
 .replace("  previous: ActiveRide | null,","  previous,")
 .replace("  incoming: ActiveRide,","  incoming,")
 .replace("  authoritative: boolean,","  authoritative,")
 .replace('): "accept" | "ignore" | "reconcile" {',") {");
 const order={agendada:0,procurar_motorista:1,motorista_a_caminho:2,motorista_chegou:3,
  em_viagem:4,finalizada:5,cancelada_passageiro:5,cancelada_motorista:5,expired:5};
 return new Function("RIDE_STATUS_ORDER","isTerminalRideStatus",
  js+"return {report08RideVersion,report08RideDecision};")(order,
  s=>s==="finalizada"||s==="expired"||s.startsWith("cancelada"));
}
test("INV-057: real pinned hook accepts legitimate new assignment, rejects stale/terminal",()=>{
 assert.ok(existsSync(pin),"locked passenger source required");
 const original=readFileSync(pin,"utf8");
 const old=runtimeHook(original);
 assert.match(old,/RIDE_STATUS_ORDER\[updatedRide\.status\] < RIDE_STATUS_ORDER\[previousStatus\]/);
 const workspace=mkdtempSync(join(tmpdir(),"apois-report08-"));
 try{
  const target=resolve(workspace,"src/hooks/rides/use-active-ride.tsx");
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,old,"utf8");
  const apply=()=>{
    const done=spawnSync(process.execPath,[fixer],{cwd:root,encoding:"utf8",
      env:{...process.env,APOIS_CORRIDAS_WORKSPACE:workspace}});
    assert.equal(done.status,0,done.stderr+done.stdout);
  };
  apply();
  const result=readFileSync(target,"utf8");
  for(const required of [
   "APOIS_REPORT08_PASSENGER_REDISPATCH_V1",
   "handleUpdate(data, true)","handleUpdate(latestRide, true)",
   "handleUpdate(activeRide, true)","activeRideService.getRideById(activeId, userId)",
   "currentRideIdRef.current !== activeId","reconcilePromiseRef.current === pending",
   "requestSequence !== requestSequenceRef.current",
  ])assert.ok(result.includes(required),"missing "+required);
  apply();assert.equal(readFileSync(target,"utf8"),result,"idempotent");
  assert.equal(readFileSync(pin,"utf8"),original,"locked source unchanged");
  const {report08RideDecision:decide,report08RideVersion:version}=logic(result);
  const a=ride("motorista_a_caminho",1,"A",stamp(0));
  const arrived=ride("motorista_chegou",2,"A",stamp(0));
  const search=ride("procurar_motorista",3,null,undefined);
  const b=ride("motorista_a_caminho",4,"B","2026-11-09T10:03:30.123456Z");
  const bArrived=ride("motorista_chegou",5,"B",b.accepted_at);
  const cases=[
   [null,a,false,"accept","first"],[a,arrived,false,"accept","A arrived"],
   [arrived,search,false,"accept","return to search"],[search,b,false,"accept","B accepted"],
   [b,bArrived,false,"accept","B arrived"],[b,arrived,false,"ignore","late A"],
   [b,{...arrived,id:"wrong-ride",updated_at:stamp(6)},false,"ignore","foreign ride"],
   [arrived,b,false,"accept","B direct after missed search"],
   [arrived,ride("motorista_a_caminho",4,"A",stamp(0)),false,"reconcile","same-driver regression"],
   [arrived,ride("motorista_a_caminho",4,"A",stamp(0)),true,"ignore","server invalid regression"],
   [ride("em_viagem",4,"A",stamp(0)),search,false,"ignore","started trip rollback"],
   [ride("finalizada",4,"A",stamp(0)),search,false,"ignore","finished resurrection"],
   [ride("cancelada_motorista",4,null),search,false,"ignore","cancelled resurrection"],
   [arrived,{...search,driver_id:"A"},false,"reconcile","invalid search event"],
   [arrived,{...search,driver_id:"A"},true,"ignore","invalid search server"],
   [arrived,{...search,updated_at:arrived.updated_at},false,"reconcile","same version event"],
   [arrived,{...search,updated_at:arrived.updated_at},true,"ignore","same version server"],
   [arrived,arrived,false,"ignore","duplicate event"],
   [arrived,arrived,true,"accept","authoritative same state"],
  ];
  for(const [previous,next,auth,wanted,label] of cases) assert.equal(decide(previous,next,auth),wanted,label);
  assert.ok(version("2026-11-09T10:03:00.123451Z")>version("2026-11-09T10:03:00.123450Z"));
  assert.equal(version("invalid"),null);
  const service=readFileSync(resolve(root,
   "sources/apois-corridas-passageiro/src/services/rides/active-ride-service.ts"),"utf8");
  assert.match(service,/if \(isNewer \|\| \(isSameUpdate && isForwardTransition\)\)/);
 }finally{rmSync(workspace,{recursive:true,force:true});}
});
