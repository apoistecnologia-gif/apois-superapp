// QA235: evidence-based regression checks after QA234 for generated Partner workspaces.
// Does not claim a physical GPS/FCM test.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const role=process.env.APOIS_QA235_ROLE;
assert.ok(["motorista","entregador"].includes(role));
const root=resolve(".work/partner-"+role);
function read(rel){const p=resolve(root,rel);assert.ok(existsSync(p),"missing "+p);return readFileSync(p,"utf8");}
const nav=read("src/components/ApoisExternalNavigation.tsx");

test("only one primary action: navigation retry is a normal button, never a second swipe",()=>{
 for(const t of [
  'aria-label={"Reabrir navegação "+stage}',
  'onClick={launch}',
  "Reabrir mapa",
  'onClick={() => { setChooser(true); setMessage(""); }}',
  'Google Maps','Waze',
 ])assert.ok(nav.includes(t),"navigation retry "+t);
 assert.ok(!nav.includes("<ApoisSlideAction"),"navigation retry must not add redundant swipe");
});
test("shared navigation still offers correct GPS and preference, never another paid route API",()=>{
 const shared=read("src/components/ApoisSwipeControls.tsx");
 assert.ok(shared.includes("ApoisSlideAction"),"single primary slider exists");
 assert.ok(shared.includes("threshold=0.79"),"deliberate slide threshold");
 assert.ok(shared.includes('bg-[#C91429]'),"single slider revised APOIS design");
 assert.ok(nav.includes("https://waze.com/ul?ll="));
 assert.ok(nav.includes("https://www.google.com/maps/dir/?api=1&destination="));
 assert.ok(!nav.includes("computeDriverRoute"),"external navigator not billed through APOIS");
});
if(role==="motorista"){
 test("accept ride invokes exact existing backend confirmation BEFORE auto opening pickup",()=>{
  const s=read("src/routes/motorista.app.tsx");
  const section=s.slice(s.indexOf("async function handleAccept()"),s.indexOf("async function handleReject()"));
  for(const t of [
   'const r = await callAccept({ data: { rideId: offer.id } });',
   'if ((accepted as any).queued_after_ride_id',
   'setActive(accepted);',
   'await setApoisOperationalNotification("motorista", true, accepted.id, accepted.origin_lat, accepted.origin_lng);',
   'await launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng);',
   'toast.info("Corrida aceita. Use Reabrir mapa se necessário.");'
  ])assert.ok(section.includes(t),"backend confirmed auto launch: "+t);
  assert.ok(section.indexOf("await callAccept(")<section.indexOf("await launchApoisNavigationAfterRideStart("));
  assert.ok(section.indexOf("if ((accepted as any).queued_after_ride_id")<section.indexOf("launchApoisNavigationAfterRideStart("));
  assert.ok(section.includes("} catch (e) {"),"accept errors keep offer actionable");
 });
 test("driver does not duplicate Waze/Google voice or show two swipes",()=>{
  const s=read("src/routes/motorista.app.tsx");
  const voice=read("src/lib/voiceNav.ts");
  for(const mark of [
   "APOIS_PARTNER_QA235_ONE_NAVIGATION_V1",
   "setApoisExternalNavigationOwnsVoice(true)",
   "setApoisExternalNavigationOwnsVoice(current)",
   'if(qa235ExternalVoice)return;',
   'NativeDriverVoice.stop()',
   'onConfirm={onAccept}',
   'onClick={onReject}',
   'data-apois-automatic-arrival="true"',
   'label="Iniciar corrida"',
   'label="Confirmar PIN e iniciar corrida"',
   'onConfirm={handleComplete}',
   'onClick={onRecenter}',
   'onClick={onShowRoute}',
   "if(!immediate)return;"
  ])assert.ok((s+"\n"+voice).includes(mark),"driver voice/controls "+mark);
  assert.ok(!s.includes('<ApoisOfferSwipe'),"ambiguous 2-way slider removed");
  assert.ok(!s.includes('<ApoisSlideAction label="Confirmar chegada"'),"driver need not report arrival");
  assert.ok(!s.includes('<DriverVoiceToggle'),"no duplicate internal voice controls");
 });
 test("GPS auto arrival is authenticated, bounded and retains existing passenger push",()=>{
  const driver=read("src/routes/motorista.app.tsx");
  const api=read("src/lib/driverRideLifecycle.mobile.ts");
  for(const t of [
   'active.status!=="motorista_a_caminho"',
   'gpsStatus!=="granted"',
   'distance>85',
   "now-record.firstAt<6500",
   "record.count<3",
   'record.retryAfter=Date.now()+30000',
   'void callArrive({data:{rideId}})',
   'activeRef.current?.id===rideId',
   'active?.status === "motorista_a_caminho" ? active.id : undefined',
  ])assert.ok(driver.includes(t),"auto arrival invariant "+t);
  for(const t of ['callRpc("driver_mark_arrived"', 'notifyPassenger(data.rideId, "ride.driver_arrived")'])
   assert.ok(api.includes(t),"existing backend contract "+t);
  assert.ok(driver.includes("await onStart(pinCode);"),"PIN still required before trip");
 });
}else{
 test("courier offer has one main swipe plus small reject; collection/delivery remain original",()=>{
  const offers=read("src/components/CourierOfferOverlay.tsx");
  const premium=read("src/components/CourierPremiumViews.tsx");
  const app=read("src/routes/courier.tsx");
  for(const t of [
   'onConfirm={() => respond("accept")}',
   'onClick={() => void respond("reject")}',
   'accept_delivery_offer','reject_delivery_offer'
  ])assert.ok(offers.includes(t),"courier safe offer "+t);
  assert.ok(!offers.includes("<ApoisOfferSwipe"),"no confusing dual slider");
  for(const t of [
   'onConfirm={() => onTransition("picked_up")}',
   'onConfirm={onComplete}',
   "pin.length !== 4"
  ])assert.ok(premium.includes(t),"courier original action "+t);
  for(const t of ["onTransition={transitionDelivery}","onComplete={completeDelivery}",
    'useApoisOperationalNotification("entregador", Boolean(activeJob))'
  ])assert.ok(app.includes(t),"courier lifecycle "+t);
 });
}
test("Android GPS extension uses only existing FGS, authenticated RPC + push and strict GPS confidence",()=>{
 const native=readFileSync(resolve("scripts/install-partner-qa235-native-auto-arrival.mjs"),"utf8");
 const plugin=readFileSync(resolve("scripts/android/APOISExternalNavigationPlugin.java"),"utf8");
 const installer=readFileSync(resolve("scripts/install-partner-launcher.mjs"),"utf8");
 for(const mark of [
  "qa235CheckPickupArrival(location)",
  "getAccuracy()>65f",
  "now-capturedAt(location)>15000L",
  "location.distanceTo(pickup)>85f",
  "qa235Fixes<3",
  "now-qa235FirstAt<6500L",
  "/rest/v1/rpc/driver_mark_arrived",
  "/functions/v1/send-ride-push",
  'qa235SendPush("ride.driver_arrived",rideId)',
  "refreshSession()",
  'QA235_ARRIVAL_PREFS',
  'START_REDELIVER_INTENT',
  "ContextCompat.registerReceiver",
 ])assert.ok(native.includes(mark),"native proximity contract "+mark);
 assert.ok(installer.includes("import './install-partner-qa235-native-auto-arrival.mjs';"));
 assert.ok(plugin.includes("sendBroadcast(update)"),"same private service broadcast");
 assert.ok(!native.includes("startForegroundService(")&&!native.includes("startService("),
  "no extra Android location foreground services");
});
