// APOIS_PARTNER_EXTERNAL_NAV_V1 — code and generated-workspace regression gates.
// Run: node --test scripts/qa/test-partner-external-navigation-v1.test.mjs motorista|entregador
// No Android simulator, network, paid Maps request or Supabase mutation.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const role=process.env.APOIS_EXTERNAL_NAV_ROLE || null;
const base=resolve(".work/partner-"+(role||"motorista"));
const shared=readFileSync(resolve("superapp/partner-shell/shared/ApoisExternalNavigation.tsx"),"utf8");
const installer=readFileSync(resolve("scripts/install-partner-external-navigation-ui.mjs"),"utf8");

test("one shared navigator for Motorista and Entregador, official Android Activity and HTTPS fallback",()=>{
 for(const t of [
  'registerPlugin<ExternalPlugin>("APOISExternalNavigation")',
  "validNavigationCoordinate(", "externalMapUrl(",
  "https://www.google.com/maps/dir/?api=1&destination=",
  "https://waze.com/ul?ll=",
  '&travelmode=driving&dir_action=navigate',
  '&navigate=yes',
  'provider: ApoisNavigator; latitude: number; longitude: number',
  '"INICIAR NAVEGAÇÃO"', '"Google Maps"', '"Waze"',
  'setOperation({ role, active })', '"apois-parceiro:external-navigator:v1"',
  "window.localStorage.setItem", "window.localStorage.removeItem",
  'role="group"', 'disabled={busy || !coordinateValid}',
 ]) assert.ok(shared.includes(t),"shared contract: "+t);
 assert.ok(!shared.includes("Browser.open("),"Capacitor Browser opens an in-app tab, not preferred navigation Activity");
 assert.ok(!shared.includes("computeDriverRoute"),"shared launcher must not bill Google Maps APIs");
 assert.ok(shared.includes('result.fallback'),"installed app unavailable is visible");
});

test("Android native plugin only launches official installed apps, with strict coordinate validation",()=>{
 const native=readFileSync(resolve("scripts/android/APOISExternalNavigationPlugin.java"),"utf8");
 for(const t of [
  '@CapacitorPlugin(name = "APOISExternalNavigation")',
  "public void open(PluginCall call)","public void setOperation(PluginCall call)",
  "Double.isFinite(latitude)", "Math.abs(latitude) > 90", "Math.abs(longitude) > 180",
  "com.google.android.apps.maps","com.waze","google.navigation:q=","waze://?ll=",
  "activity.startActivity(installed)", "activity.startActivity(universal)",
  "ActivityNotFoundException", "Intent.ACTION_VIEW",
  '"driver_running"', '"courier_running"',
  '"motorista".equals(role)', '"entregador".equals(role)',
  "getBoolean(\"active\")", "sendBroadcast(update)", "setPackage(getContext().getPackageName())",
 ])assert.ok(native.includes(t),"native contract "+t);
 assert.ok(!native.includes("startForegroundService("),"navigator never starts a new GPS foreground service");
 assert.ok(!native.includes("startService("),"notification updates must not restart running GPS services");
});

test("generated native installer reuses role-specific pending intents and service IDs",()=>{
 const script=readFileSync(resolve("scripts/install-partner-external-navigation.mjs"),"utf8");
 const launcher=readFileSync(resolve("scripts/install-partner-launcher.mjs"),"utf8");
 for(const t of [
  "registerPlugin(APOISExternalNavigationPlugin.class)",
  'patchService("Driver","motorista")','patchService("Courier","entregador")',
  "VOLTAR AO APOIS","ACTION_UPDATE_OPERATION","NotificationManager",
  "apoisOperationActive","buildNotification()","ContextCompat.RECEIVER_NOT_EXPORTED",
  "unregisterReceiver(apoisOperationReceiver)","com.google.android.apps.maps","com.waze",
  "existing Location Service missing"
 ])assert.ok(script.includes(t),"installer "+t);
 assert.ok(launcher.includes("import './harden-partner-location-notification-routing.mjs';"));
 assert.ok(launcher.includes("import './install-partner-external-navigation.mjs';"));
 const a=launcher.indexOf("harden-partner-location-notification-routing.mjs");
 const b=launcher.indexOf("install-partner-external-navigation.mjs");
 assert.ok(a>=0&&b>a,"shared native install is after existing GPS services and notification role routes");
});

test("external navigation UI applies only AFTER the protected QA222 and courier visual chains",()=>{
 const script=readFileSync(resolve("scripts/build-partner-release.sh"),"utf8");
 const driverQ=script.indexOf('node "$ROOT/scripts/fix-partner-driver-qa222-follow-reroute-v1.mjs"');
 const driverNav=script.indexOf('node "$ROOT/scripts/install-partner-external-navigation-ui.mjs" motorista');
 const driverBuild=script.indexOf("bun run typecheck",driverQ);
 const courierQ=script.indexOf('node "$ROOT/scripts/fix-partner-courier-exclusive-vector-style-20261112-v1.mjs"');
 const courierNav=script.indexOf('node "$ROOT/scripts/install-partner-external-navigation-ui.mjs" entregador');
 const courierBuild=script.indexOf('cd "$ENTREGADOR"',courierNav);
 assert.ok(driverQ>=0 && driverNav>driverQ && driverBuild>driverNav,"Motorista external navigation before compile, after QA222");
 assert.ok(courierQ>=0 && courierNav>courierQ && courierBuild>courierNav,"Courier external navigation after its map transforms");
 assert.ok(script.includes('APOIS_EXTERNAL_NAV_ROLE=motorista node --test "$ROOT/scripts/qa/test-partner-external-navigation-v1.test.mjs"'));
 assert.ok(script.includes('APOIS_EXTERNAL_NAV_ROLE=entregador node --test "$ROOT/scripts/qa/test-partner-external-navigation-v1.test.mjs"'));
});

if(role==="motorista"){
 test("real generated Motorista keeps active ride, map, PIN and phases, but never announces internal turns",()=>{
  const main=resolve(base,"src/routes/motorista.app.tsx");
  const component=resolve(base,"src/components/ApoisExternalNavigation.tsx");
  assert.ok(existsSync(main)&&existsSync(component));
  const code=readFileSync(main,"utf8");
  for(const t of [
   "APOIS_PARTNER_EXTERNAL_NAV_UI_V1","APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1",
   "APOIS_DRIVER_QA221_MAP_OWNER_COMPACT_HUD_V1",
   "data-apois-qa221-trip-hud", "data-apois-qa220-pin-digit-v1",
   "ApoisExternalNavigation latitude={ride.origin_lat} longitude={ride.origin_lng}",
   "ApoisExternalNavigation latitude={ride.destination_lat} longitude={ride.destination_lng}",
   'useApoisOperationalNotification("motorista", Boolean(active))',
   "onStart(pinCode)","onClick={handleComplete}",
   "onClick={handleArrive}","onClick={onShowRoute}","onClick={onRecenter}",
   "onClick={onAccept}","onClick={onReject}","routeRequestEpochRef.current",
   "setPolyline(points)","refreshDue = !samePhase",
  ])assert.ok(code.includes(t),"Motorista protected contract "+t);
  for(const forbidden of ["tickNavigation(", "qa222DistanceToRoute(", "const offRouteDue=", "destinationEvidenceRef", "routeStepsPhase", "setRouteSteps(", "DriverRouteStep"]) {
   assert.ok(!code.includes(forbidden),"obsolete internal navigation still active: "+forbidden);
  }
  assert.ok(code.includes("Corrida aceita. Siga até o embarque"),"operational voice still exists");
  assert.ok(code.includes("Corrida finalizada."),"operational finish voice exists");
  assert.equal(readFileSync(component,"utf8"),shared,"Motorista uses exact shared component");
 });
}
if(role==="entregador"){
 test("real generated Courier keeps two correct destination phases, map metrics, collection and completion",()=>{
  const map=resolve(base,"src/components/CourierRouteMap.tsx");
  const app=resolve(base,"src/routes/courier.tsx");
  const component=resolve(base,"src/components/ApoisExternalNavigation.tsx");
  for(const p of [map,app,component])assert.ok(existsSync(p),p);
  const m=readFileSync(map,"utf8"),a=readFileSync(app,"utf8");
  for(const t of [
   "APOIS_PARTNER_EXTERNAL_NAV_UI_V1",
   '["picked_up", "on_the_way", "arrived_destination"]',
   "job.delivery_latitude","job.delivery_longitude",
   "job.pickup_latitude","job.pickup_longitude",
   "ApoisExternalNavigation latitude={target.lat} longitude={target.lng}",
   "stage={goingToDelivery ? \"até o cliente\" : \"até o estabelecimento\"}",
   "CourierRouteMap", "onMetrics={setMetrics}", "update_courier_delivery_route_metrics",
  ])assert.ok(m.includes(t),"Courier map contract "+t);
  assert.ok(!m.includes("onClick={openNavigation}"),"old browser CTA removed");
  for(const t of [
    'useApoisOperationalNotification("entregador", Boolean(activeJob))',
    "onTransition={transitionDelivery}", "onComplete={completeDelivery}",
    "CourierLocationTracker", "set_courier_online",
    "loadCourierOperations(courier.id)",
  ])assert.ok(a.includes(t),"Courier lifecycle contract "+t);
  assert.equal(readFileSync(component,"utf8"),shared,"Courier uses exact shared component");
 });
}
