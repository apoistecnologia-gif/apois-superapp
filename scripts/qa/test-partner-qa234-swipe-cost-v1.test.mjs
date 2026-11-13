// QA234: scoped, fail-closed regression suite for both Partner workspaces.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(".work/partner-"+(process.env.APOIS_QA234_ROLE||"motorista"));
const swipe=readFileSync(resolve("superapp/partner-shell/shared/ApoisSwipeControls.tsx"),"utf8");
const navigator=readFileSync(resolve("superapp/partner-shell/shared/ApoisExternalNavigation.tsx"),"utf8");
const patch=readFileSync(resolve("scripts/install-partner-qa234-swipe-cost-v1.mjs"),"utf8");
function readGenerated(file){const p=resolve(root,file);assert.ok(existsSync(p),"missing "+p);return readFileSync(p,"utf8");}

test("shared one-direction swipe requires real pointer gesture with threshold and keyboard access",()=>{
 for(const s of [
  "APOIS_PARTNER_QA234_SWIPE_CONTROLS_V1",
  "export function ApoisSlideAction","threshold=0.79",
  "onPointerDown={onDown}","onPointerMove={onMove}","onPointerUp={onUp}",
  "setPointerCapture(e.pointerId)","e.currentTarget.releasePointerCapture",
  "aria-label","e.key===\"Enter\"","e.key===\" \"",
  "lock.current=true","finally {lock.current=false;setPending(false);move(0);}",
 ])assert.ok(swipe.includes(s),"swipe contract missing "+s);
});

test("two-direction offer swipe selects left rejection or right acceptance without tapping buttons",()=>{
 for(const s of [
  "export function ApoisOfferSwipe","Math.abs(p)>=threshold","p>0?1:-1",
  "e.key===\"ArrowRight\"","e.key===\"ArrowLeft\"",
  "onAccept,onReject","dir===1?onAccept:onReject",
  "onLostPointerCapture={cancel}","disabled={busy}",
 ])assert.ok(swipe.includes(s),"offer slider contract missing "+s);
});

test("preferred navigator can reopen on demand, while ride start auto-launch requires validated coords",()=>{
 for(const s of [
   "launchApoisNavigationAfterRideStart(latitude",
   "validNavigationCoordinate(latitude, longitude)",
   'const provider = readPreferred() ?? "google";',
   "NativeNavigation.open({provider, latitude: Number(latitude), longitude: Number(longitude)})",
   "<ApoisSlideAction","onConfirm={launch}","label=\"Iniciar navegação\"",
   'aria-label="Escolher aplicativo de navegação"', '<span>Trocar</span>'
 ])assert.ok(navigator.includes(s),"external navigator missing "+s);
 assert.ok(!navigator.includes("computeDriverRoute"),"no paid Routes request in shared external launcher");
});

test("QA234 remains post-QA233 and generated modules share the same component bytes",()=>{
 const release=readFileSync(resolve("scripts/build-partner-release.sh"),"utf8");
 for(const role of ["motorista","entregador"]){
  const older=release.indexOf('install-partner-external-navigation-ui.mjs" '+role);
  const applied=release.indexOf('install-partner-qa234-swipe-cost-v1.mjs" '+role);
  assert.ok(older>0&&applied>older,"QA234 must follow protected external-nav integration "+role);
 }
 const copy=readFileSync(resolve("scripts/install-partner-external-navigation-ui.mjs"),"utf8");
 assert.ok(copy.includes("copyFileSync(swipeSource,swipeTarget)"));
 assert.equal(readGenerated("src/components/ApoisSwipeControls.tsx"),swipe);
});

if(process.env.APOIS_QA234_ROLE==="motorista"){
 test("driver offer, arrival, PIN and completion are swipes without losing original RPC callbacks",()=>{
  const s=readGenerated("src/routes/motorista.app.tsx");
  for(const marker of [
    "APOIS_PARTNER_QA234_SWIPE_COST_V1",
    '<ApoisOfferSwipe acceptLabel="Aceitar corrida"',
    'onAccept={onAccept} onReject={onReject}',
    'label="Iniciar corrida" onConfirm={() =>',
    'label="Confirmar PIN e iniciar corrida" onConfirm={submitPin}',
    'label="Confirmar chegada" onConfirm={handleArrive}',
    'label="Finalizar corrida" onConfirm={handleComplete}',
    'disabled={pinBusy || pinCode.length !== 4}',
    'onClick={onShowRoute}', 'onClick={onRecenter}',
    'data-apois-qa220-pin-digit-v1', 'data-apois-qa221-trip-hud',
    'useApoisOperationalNotification("motorista", Boolean(active))',
  ])assert.ok(s.includes(marker),"driver regression "+marker);
  for(const no of ["onClick={onAccept}", "onClick={onReject}", "onClick={submitPin}"])assert.ok(!s.includes(no),"obsolete action tap "+no);
 });

 test("PIN must be accepted by backend before auto-launch; navigation failure cannot reject ride",()=>{
  const s=readGenerated("src/routes/motorista.app.tsx");
  const fragment=s.slice(s.indexOf("  async function submitPin()"),s.indexOf("  const phase = ride.status;",s.indexOf("  async function submitPin()")));
  const rpc=fragment.indexOf("await onStart(pinCode);");
  const close=fragment.indexOf("setPinOpen(false);",rpc);
  const launch=fragment.indexOf("launchApoisNavigationAfterRideStart(",rpc);
  assert.ok(rpc>=0 && close>rpc && launch>close,"external navigation only after confirmed original ride RPC");
  assert.ok(fragment.includes(".catch((error) => {"),"map errors handled outside ride rejection");
  assert.ok(fragment.includes("Corrida iniciada. Use Iniciar navegação"),"retry visible if external app fails");
  assert.ok(fragment.includes("setPinError("),"PIN errors still owned by original validation");
  assert.ok(s.includes("await callStart({ data: { rideId: active.id, safety_code: code } })"),"server validation not bypassed");
 });

 test("paid driver Routes frequency reduced without weakening business plausibility or fallback",()=>{
  const s=readGenerated("src/routes/motorista.app.tsx");
  for(const marker of [
    "elapsedMs >= 900000 && movedKm >= 1.5",
    "elapsedMs >= 180000 && prior?.failed === true && prior.failures < 2",
    "res.distanceMeters < directMeters * 0.55",
    "setLegKm(null); setEtaSeconds(null);",
    "setPolyline(points)",
  ])assert.ok(s.includes(marker),"driver route evidence "+marker);
  assert.ok(!s.includes("elapsedMs >= 180000 && (movedKm >= 0.45"),"old paid periodic route trigger");
 });
}

if(process.env.APOIS_QA234_ROLE==="entregador"){
 test("actual courier offer modal and collection/confirmation use swipes while existing backend callbacks survive",()=>{
  const premium=readGenerated("src/components/CourierPremiumViews.tsx");
  const offers=readGenerated("src/components/CourierOfferOverlay.tsx");
  const app=readGenerated("src/routes/courier.tsx");
  const map=readGenerated("src/components/CourierRouteMap.tsx");
  for(const mark of [
   "APOIS_PARTNER_QA234_SWIPE_COST_V1",
   '<ApoisOfferSwipe acceptLabel="Aceitar entrega"',
   'onAccept={() => respond("accept")} onReject={() => respond("reject")}',
   'const respond = async (action: "accept" | "reject") =>',
   "accept_delivery_offer", "reject_delivery_offer",
  ])assert.ok(offers.includes(mark),"Courier real offer modal "+mark);
  assert.ok(!offers.includes('onClick={() => void respond("accept")}'),"offer no longer touch-to-accept");
  assert.ok(!offers.includes('onClick={() => void respond("reject")}'),"offer no longer touch-to-reject");
  for(const mark of [
    "APOIS_COURIER_SIMPLE_FLOW_V1",
    'onConfirm={() => onTransition("picked_up")}',
    'label="Confirmar entrega" disabled={busy || pin.length !== 4}',
    'onConfirm={onComplete}',
    'onSubmit={(event) => { event.preventDefault(); if (!busy) void onComplete(); }}',
    'grid grid-cols-1 gap-2',
    "pin.length !== 4",
  ])assert.ok(premium.includes(mark),"Courier active delivery "+mark);
  assert.ok(!premium.includes('onClick={() => void onTransition("picked_up")}'),"old pickup tap replaced");
  for(const mark of [
    "onTransition={transitionDelivery}","onComplete={completeDelivery}",
    'useApoisOperationalNotification("entregador", Boolean(activeJob))',
    "CourierLocationTracker"
  ])assert.ok(app.includes(mark),"Courier lifecycle "+mark);
  for(const mark of [
    "ApoisExternalNavigation latitude={target.lat}",
    "job.pickup_latitude","job.delivery_latitude",
    "update_courier_delivery_route_metrics",
    "VITE_APOIS_ENTREGAS_LIVE_ROUTING",
    "elapsed < 900_000 || moved < 1500",
    'routingPreference: "TRAFFIC_UNAWARE"'
  ])assert.ok(map.includes(mark),"Courier budget/track "+mark);
  assert.ok(!map.includes("elapsed < 180_000 || moved < 500"),"original 3-minute paid refresh removed");
  assert.ok(!map.includes('routingPreference: "TRAFFIC_AWARE"'),"Pro traffic route not paid for operation");
 });
}

test("QA234 patch cannot mutate Supabase, price, Maps API key or Android service setup",()=>{
 for(const forbidden of [
  "create table","alter table","DROP TABLE","supabase.rpc(","google-services.json",
  "onClick={() => void onReport()}","DriverLocationService.java"
 ])assert.ok(!patch.includes(forbidden),"QA234 transform must not introduce infra change: "+forbidden);
});
