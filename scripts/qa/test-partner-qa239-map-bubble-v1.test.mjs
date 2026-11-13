import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=path=>readFileSync(resolve(root,path),"utf8");
const driver=read("src/routes/motorista.app.tsx");
const nav=read("src/components/ApoisExternalNavigation.tsx");

test("QA239 does not invoke paid Driver Routes API during active rides",()=>{
 assert.ok(driver.includes("APOIS_PARTNER_QA239_DEMAND_ONLY_V1"));
 assert.ok(!driver.includes('callRoute({ data: { origin: pos, destination: dest } })'));
 assert.ok(!driver.includes("qa222DistanceToRoute("),"no obsolete navigation deviation");
 assert.ok(driver.includes("setPolyline([]);setLegKm(null);setEtaSeconds(null);"));
 for(const key of ["callArrive","callStart","callComplete","useApoisOperationalNotification","setApoisOperationalNotification","onStart(pinCode)","onClick={handleComplete}"])
  assert.ok(driver.includes(key),"preserve operational flow: "+key);
});
test("QA239 Dynamic Maps only mounted after user request and when driver idle",()=>{
 assert.ok(driver.includes("showApoisDemandMap=Boolean(apoisDemandMapOpen && online && !active && !incoming && !ratingRide)"));
 assert.ok(driver.includes('showApoisDemandMap ? <div'));
 assert.ok(driver.includes('data-apois-open-demand-map="true"'));
 assert.ok(driver.includes('data-apois-economy-map-off="true"'));
 assert.ok(driver.includes("showDemandZones = Boolean(showApoisDemandMap && online && !active && !incoming && !ratingRide"));
 assert.ok(driver.includes('rpc("apois_get_driver_demand_zones")'));
 assert.ok(driver.includes('rpc("apois_driver_passenger_hotspots")'));
 assert.ok(driver.includes("animate-ping"),"real aggregated zones still blink");
});
test("QA239 bubble never silently requests overlay and keeps manual map reopening",()=>{
 assert.ok(nav.includes('data-apois-bubble-consent="true"'));
 assert.ok(nav.includes("NativeNavigation.openBubbleSettings()"));
 assert.ok(nav.includes("bubbleState.enabled"));
 assert.ok(nav.includes('data-apois-floating-reopen-map="true"'));
 assert.ok(nav.includes('onClick={()=>void openProvider(preferred ?? "google")}'));
 assert.ok(nav.includes("Reabrir mapa"),"prior QA235 fallback preserved");
 assert.ok(nav.includes("Capacitor.isNativePlatform()"),"Android-only prompt");
});
test("QA239 native bubble is optional and does not create a GPS service",()=>{
 const overlay=readFileSync("scripts/android/ApoisNavigationBubble.java","utf8");
 const native=readFileSync("scripts/install-partner-qa239-bubble-native-v1.mjs","utf8");
 assert.ok(overlay.includes("Settings.canDrawOverlays(context)"));
 assert.ok(overlay.includes("TYPE_APPLICATION_OVERLAY"));
 assert.ok(overlay.includes("if (!motoristaActive || !enabled(app) || !permitted(app)) return;"));
 assert.ok(overlay.includes("if (activity instanceof MainActivity) hide(app);"));
 assert.ok(native.includes("android.permission.SYSTEM_ALERT_WINDOW"));
 assert.ok(!native.includes("startForegroundService("));
 assert.ok(!native.includes("startService("));
});
