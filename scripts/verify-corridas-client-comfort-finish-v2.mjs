// APOIS_CLIENT_COMFORT_FINISH_V2 regression gate: no database or network.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const review=read("src/routes/_authenticated.revisar-solicitacao.tsx");
const ride=read("src/routes/_authenticated.corrida.$rideId.tsx");
const comfortStart=review.indexOf('<section data-apois-ride-comfort-prefs-v1');
const comfortEnd=review.indexOf('</section>',comfortStart);
assert.ok(comfortStart>0&&comfortEnd>comfortStart, "Comfort UI intact");
const section=review.slice(comfortStart,comfortEnd+'</section>'.length);
for(const v of [
  'data-apois-comfort-readable-v2',
  'bg-white p-5 text-[#111827]',
  'text-base font-extrabold text-[#111827]',
  'text-xs font-medium leading-5 text-[#4B5563]',
  'style={{colorScheme:"light"}}',
  'bg-white px-3 text-sm font-semibold text-[#111827]',
  '<option key={value} value={value} className="bg-white text-[#111827]"',
  'aria-label={"Preferência de "+label}',
  'value={comfort[key]}',
  'onChange={(event)=>setComfort',
  'selectedCategory?.code === "carros"',
])assert.ok(review.includes(v),"Comfort preference contract missing "+v);
for(const value of ['air_conditioning','conversation','music','Sem preferência','Prefiro silêncio','Pode conversar','Prefiro ligado','Prefiro desligado']){
 assert.ok(review.includes(value),"Original preference choice missing "+value);
}
assert.ok(!section.includes('text-white')&&!section.includes('text-zinc-300')&&!section.includes('bg-zinc-800'),
 "Comfort UI must not inherit unreadable dark theme");
assert.ok(review.includes('await confirmRide(comfort)'),"Must pass original comfort data to request, not modify tariff");
assert.ok(review.includes('pb-[max(2.5rem,env(safe-area-inset-bottom))]'),"Android nav clearance required");
const request=read("src/hooks/rides/use-ride-request.tsx");
assert.ok(request.includes('supabase.functions.invoke("request-ride"'),"Original dispatch preserved");
assert.ok(request.includes('ride_comfort_preferences: comfort'),"Original comfort payload preserved");

for(const m of ['data-apois-completed-summary-v2','Viagem concluída','Voltando automaticamente ao início...',
 'screenState !== "completed"','ride.id !== rideId','window.setTimeout','window.clearTimeout',
 'finishHomeActionRef.current()','resetFinishedTripUi();','clearDestination();','clearStops();',
 'clearRoute();','resetRequest();','<Home className="h-5 w-5"','onClick={handleReturnHome}',
 'to: "/inicio"','<PassengerMap','<DriverCard ride={ride} />','<VehicleCard ride={ride} />',
 'screenState === "active"','actionAvailability?.canCancel','<CancellationDialog']){
 assert.ok(ride.includes(m),"Ride lifecycle or completed UX missing: "+m);
}
const terminal=ride.indexOf('  if (screenState === "completed") {');
const map=ride.indexOf('<PassengerMap');
assert.ok(terminal>0 && terminal<map,"Terminal view must be an early return before live map");
const terminalEnd=ride.indexOf('  const hasDriverLocation =',terminal);
assert.ok(terminalEnd>terminal && !ride.slice(terminal,terminalEnd).includes('<PassengerMap'),
 "Completed screen must never display live map/driver card");
assert.ok(ride.includes('const hasTotal = Number.isFinite(paidTotal) && paidTotal >= 0;'),
 "Unreliable fare must never render NaN");
assert.ok(ride.includes('if (screenState !== "completed" || !ride?.id || ride.id !== rideId) return;'),
 "Only server-confirmed, matching ride may auto-return");
assert.ok(ride.includes('const timeout = window.setTimeout(() => finishHomeActionRef.current(), 3200);'),
 "Completion briefly confirms then navigates");
assert.ok(!ride.includes('functions.invoke("driver-ride-action"'),"Passenger must not finalize driver ride");
// Exercise the actual compiled effect body with fake timers, no account/network.
// A finished route must navigate, but active/cancelled routes must never auto-navigate.
const hookStart=ride.indexOf('  useEffect(() => {\n    if (screenState !== "completed" || !ride?.id || ride.id !== rideId) return;');
const hookEnd=ride.indexOf('  }, [screenState, ride?.id, rideId]);',hookStart);
assert.ok(hookStart>0 && hookEnd>hookStart,"Completion hook boundaries changed");
const snippet=ride.slice(hookStart,hookEnd+'  }, [screenState, ride?.id, rideId]);'.length);
const runHook=new Function("useEffect","screenState","ride","rideId","window","finishHomeActionRef",snippet);
function simulateTransition(state,rideRecord,paramRideId){
  const timers=[],clears=[];let home=0,cleanup=null;
  const fakeWindow={
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},
    clearTimeout(id){clears.push(id);}
  };
  runHook((callback)=>{cleanup=callback();},state,rideRecord,paramRideId,fakeWindow,{current:()=>{home++;}});
  return {timers,clears,get home(){return home;},dispose(){if(typeof cleanup==="function")cleanup();}};
}
for(const status of ["active","cancelled","loading","failed"]){
  const result=simulateTransition(status,{id:"ride-1"},"ride-1");
  assert.equal(result.timers.length,0,"No auto-return for "+status);
  assert.equal(result.home,0,"Cannot leave active/cancelled ride");
}
const different=simulateTransition("completed",{id:"ride-2"},"ride-1");
assert.equal(different.timers.length,0,"Cannot auto-return for a stale unrelated ride");
const finished=simulateTransition("completed",{id:"ride-1"},"ride-1");
assert.equal(finished.timers.length,1,"One server-confirmed terminal timer");
assert.equal(finished.timers[0].ms,3200,"Allow passenger to see completion");
assert.equal(finished.home,0,"No navigation before timeout");
finished.timers[0].fn();
assert.equal(finished.home,1,"Return home exactly after confirmation");
finished.dispose();
assert.deepEqual(finished.clears,[1],"Cancel scheduled timeout on unmount");
console.log("[OK] Ride terminal effect: server confirmed only, stale ride rejected, active trip protected, cleanup verified.");

console.log("[OK] Cliente Corridas: contrast, controls, original request/prefs, terminal summary, timed home return and live-ride lifecycle preserved.");
