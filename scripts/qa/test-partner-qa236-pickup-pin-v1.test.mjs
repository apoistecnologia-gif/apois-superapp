// QA236 regression: the acceptance flow must never strand an active driver
// behind "Indo ao passageiro" without a way to enter PIN and start the trip.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
function read(p){const path=resolve(root,p);assert.ok(existsSync(path),"missing "+path);return readFileSync(path,"utf8");}
const driver=read("src/routes/motorista.app.tsx"),pin=read("src/components/ApoisPickupPin.tsx");

test("visible Iniciar corrida action in pickup phase, independent of arrival push and a single PIN confirmation",()=>{
 for(const token of [
  "APOIS_PARTNER_QA236_PICKUP_PIN_V1",
  'data-apois-qa236-start-ride="true"',
  "Iniciar corrida · Digitar PIN",
  "onStartPin={()=>setQa236PinOpen(true)}",
  'active.status === "motorista_a_caminho"',
  'qa236PinOpen && active',
  '<ApoisPickupPin onClose={()=>setQa236PinOpen(false)}',
  'data-apois-qa236-arrived-pin="true"',
  'onClick={onShowRoute}','onClick={onRecenter}'
 ])assert.ok(driver.includes(token),"driver "+token);
 assert.ok(!driver.includes("O passageiro será avisado automaticamente pelo GPS."),"no explanatory banner instead of action");
 assert.ok(!driver.includes('<ApoisSlideAction label="Confirmar chegada"'),"no obsolete manual arrive slider");
 assert.ok(!driver.includes('<ApoisSlideAction label="Iniciar corrida"'),"no double-slide before PIN");
});

test("PIN dialog readable, four numeric digits, one visible confirmation with handled failure",()=>{
 for(const token of [
  'data-apois-qa236-pin-dialog="true"',
  'data-apois-qa236-pin="true"',
  'type="text" inputMode="numeric"',
  'maxLength={4}',
  'replace(/\\D/g,"")',
  'role="alert"',
  'WebkitTextFillColor:"#111827"',
  'ApoisSlideAction label="Confirmar PIN e iniciar corrida"',
  'onSubmit(pin)',"onClose();"
 ])assert.ok(pin.includes(token),"PIN "+token);
 assert.ok(!pin.includes("Cheguei no embarque"),"no manual-arrival action on PIN");
});

test("pickup start uses fresh GPS, authentic server arrive and 4-digit start, never auto-start without PIN",()=>{
 const begin=driver.indexOf("qa236PinOpen && active");
 const end=driver.indexOf("{/* ===== Corrida ativa =====",begin);
 const action=driver.slice(begin,end);
 for(const token of [
  'Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:3000})',
  "distance>150",
  "accuracy>100",
  'await callArrive({data:{rideId:ride.id}});',
  '.select("status").eq("id",ride.id).maybeSingle()',
  'server?.status!=="motorista_chegou"',
  'await callStart({data:{rideId:ride.id,safety_code:code}});',
  'setQa236PinOpen(false)',
  'launchApoisNavigationAfterRideStart(ride.destination_lat,ride.destination_lng)'
 ])assert.ok(action.includes(token),"transactional action "+token);
 assert.ok(action.indexOf("await callArrive(")<action.indexOf("await callStart("),"arrive before ride start");
 assert.ok(action.indexOf("await callStart(")<action.indexOf("launchApoisNavigationAfterRideStart("),"external destination only after backend start");
 assert.ok(driver.includes("onConfirm={submitPin}"),"original arrived PIN screen remains");
 assert.ok(driver.includes("await onStart(pinCode);"),"original PIN flow stays");
});

test("existing foreground notification is enhanced, never hijack Waze/Google Maps",()=>{
 const native=readFileSync(resolve("scripts/install-partner-qa236-return-notification-v1.mjs"),"utf8");
 const integration=readFileSync(resolve("scripts/install-partner-launcher.mjs"),"utf8");
 const nav=readFileSync(resolve("superapp/partner-shell/shared/ApoisExternalNavigation.tsx"),"utf8");
 for(const token of [
  'qa236PickupReady=true',
  'manager.notify(NOTIFICATION_ID,buildNotification())',
  '"INICIAR CORRIDA • PIN"',
  'pendingIntent',
  '"em_viagem".equals(stage)',
  'qa235SendPush("ride.driver_arrived",rideId)',
  'driver_mark_arrived'
 ])assert.ok(native.includes(token),"return notification "+token);
 assert.ok(!native.includes("startForegroundService("),"no extra foreground service");
 assert.ok(!native.includes("startActivity("),"no Android background Activity launch bypass");
 assert.ok(integration.includes("import './install-partner-qa236-return-notification-v1.mjs';"));
 assert.ok(nav.includes("stage?:string"),"native operation stage stops outdated pickup prompt once trip started");
});
