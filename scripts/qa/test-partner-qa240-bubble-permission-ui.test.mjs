import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const root=".work/partner-motorista";
const main=readFileSync(root+"/src/routes/motorista.app.tsx","utf8");
const driverRoot=readFileSync(root+"/src/routes/__root.tsx","utf8");
const nav=readFileSync(root+"/src/components/ApoisExternalNavigation.tsx","utf8");
const permission=readFileSync(root+"/src/components/ApoisBubblePermissionGate.tsx","utf8");
const native=readFileSync("scripts/android/APOISReturnBubble.java","utf8");
const installer=readFileSync("scripts/install-partner-qa239-native-bubble.mjs","utf8");
const logo=readFileSync(root+"/src/assets/apois-return-logo.png");

test("QA240: initial Motorista setup uses official logo before login and automatically rechecks OS grant",()=>{
 assert.ok(driverRoot.includes('APP_ROLE === "driver" ? <ApoisBubblePermissionGate /> : null'));
 assert.ok(driverRoot.includes('<DriverPresenceKeeper />'));
 assert.ok(driverRoot.includes('<Outlet />'));
 for(const marker of ["APOIS_PARCEIRO_QA240_FIRST_USE_PERMISSION_V1",
  'bubbleStatus()', 'requestBubblePermission()', 'appStateChange', 'isActive', 'visibilitychange',
  'data-apois-qa240-bubble-permission', 'officialApoisLogo',
  '"granted"', '"required"', 'Configuração inicial do motorista'])
   assert.ok(permission.includes(marker),"onboarding "+marker);
 assert.ok(!permission.includes("Desativar bolha"));
 assert.ok(!permission.includes("Continuar sem"));
 assert.ok(existsSync(root+"/src/assets/apois-return-logo.png"));
 assert.equal(logo.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
});

test("QA240: official image on Android overlay, explicit MainActivity return, no premature hide",()=>{
 for(const marker of ["APOIS_PARCEIRO_QA240_BRANDED_RETURN_BUBBLE_V1",
  "ImageView brand", "R.drawable.apois_return_logo",
  "new Intent(app, MainActivity.class)",
  "back.setAction(Intent.ACTION_VIEW)",
  '"br.com.apois.parceiro://module/motorista"',
  "app.startActivity(back)", "externalNavigatorVisible",
  "getBoolean(\"rideActive\", false)", "Settings.canDrawOverlays(context)",
  "WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY"])
   assert.ok(native.includes(marker),"Android "+marker);
 const clickHandler=native.slice(native.indexOf("container.setOnClickListener"),native.indexOf("WindowManager.LayoutParams params"));
 assert.ok(clickHandler.includes("app.startActivity(back)"),"explicit return must be launched by bubble tap");
 assert.ok(!clickHandler.slice(0,clickHandler.indexOf("app.startActivity(back)")).includes("hide();"),"overlay must remain visible until Android accepts return");
 assert.ok(!native.includes('setText("A")'),"never use synthetic letter as logo");
 assert.ok(!native.includes("container.setOnClickListener(view -> {\n                hide();"),"cannot hide before launching Activity");
 for(const marker of ["APOISReturnBubble.externalNavigationLaunched()",
  "APOISReturnBubble.externalNavigationClosed()",
  "public void requestBubblePermission(PluginCall call)",
  "android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION",
  "APOISReturnBubble.active(getContext(),active)",
  "writeFileSync(logoTarget,asset)",
  'APOISReturnBubble.show(getApplicationContext())'])
   assert.ok(installer.includes(marker),"native installer "+marker);
 for(const forbidden of ["public void configureBubble(", 'result.put("enabled"', "apois_return_letter"])
   assert.ok(!installer.includes(forbidden),"remove opt-in draft "+forbidden);
});

test("QA240: navigation buttons are finished and operational flows remain approved",()=>{
 const component=readFileSync("superapp/partner-shell/shared/ApoisExternalNavigation.tsx","utf8");
 // QA235 intentionally turns the generated primary navigation swipe into a
 // one-tap retry button. Preserve that approved behavior and the new styling.
 assert.ok(component.includes("ApoisSlideAction"));
 assert.ok(nav.includes("Reabrir mapa"));
 assert.ok(nav.includes("data-apois-qa240-map-shortcut"));
 assert.ok(nav.includes("rounded-[16px]"));
 assert.ok(!nav.includes("Desativar bolha"));
 for(const marker of [
  'data-apois-qa240-map-shortcut="true"',
  "Voltar ao mapa", "Voltar ao Google Maps ou Waze",
  'label="Iniciar navegação"',
  "ApoisSlideAction", "launchApoisNavigationAfterRideStart",
  '"Google Maps"','"Waze"',
 ])assert.ok(component.includes(marker),marker);
 for(const forbidden of ["toggleBubble", "Desativar bolha", "Ativar bolha de retorno", "configureBubble("])
  assert.ok(!component.includes(forbidden),"stale draft button "+forbidden);
 for(const marker of ["ApoisQuickMapButton","showDemandZones && demandZones.map",
  'rpc("apois_get_driver_demand_zones")','rpc("apois_driver_passenger_hotspots")',
  'onStartPin={()=>setQa236PinOpen(true)}', 'onConfirm={handleComplete}',
  "APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1"])
  assert.ok(main.includes(marker),"protected workflow "+marker);
});
