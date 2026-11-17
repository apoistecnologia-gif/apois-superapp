// APOIS Parceiro QA280 — materialize the existing native runtimes in the
// freshly generated Codemagic Android workspace. Never touches pinned sources.
// Runs AFTER cap sync / configure-partner-android, BEFORE Gradle or signing.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const androidRoot = resolve(root, "superapp/partner-shell/android");
const javaRoot = resolve(androidRoot, "app/src/main/java/br/com/apois/parceiro");
const manifestPath = resolve(androidRoot, "app/src/main/AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  throw Error("[FAIL] QA280: Android Parceiro precisa existir antes da instalação nativa.");
}

// Preserve the approved ordering of prerequisites. QA235 requires the external
// notification receiver; QA236 requires QA235; QA240 requires QA236.
// Shared Courier code is materialized by its EXISTING installer, not modified.
const steps = [
  "scripts/install-partner-driver-location.mjs",
  "scripts/install-partner-courier-location.mjs",
  "scripts/harden-partner-location-startup-ack.mjs",
  "scripts/harden-partner-location-session-sync.mjs",
  "scripts/harden-partner-location-notification-routing.mjs",
  "scripts/install-partner-external-navigation.mjs",
  "scripts/install-partner-qa235-native-auto-arrival.mjs",
  "scripts/install-partner-qa236-return-notification-v1.mjs",
  "scripts/install-partner-qa239-native-bubble.mjs",
  "scripts/verify-partner-native-plugins.mjs",
];
for (const script of steps) {
  console.log("[QA280] Native Android: " + script);
  execFileSync(process.execPath, [resolve(root, script)], {
    cwd: root,
    stdio: "inherit",
    timeout: 120_000,
  });
}

const readJava = (name) => readFileSync(resolve(javaRoot, name), "utf8");
const driver = readJava("DriverLocationService.java");
const courier = readJava("CourierLocationService.java");
const main = readJava("MainActivity.java");
const nav = readJava("APOISExternalNavigationPlugin.java");
const manifest = readFileSync(manifestPath, "utf8");
for (const marker of [
  ".setMinUpdateDistanceMeters(0f)",
  "qa235CheckPickupArrival(location)",
  "/rest/v1/rpc/driver_mark_arrived",
  "qa236PickupReady",
  "driver_set_presence",
]) {
  if (!driver.includes(marker)) throw Error("[FAIL] QA280: GPS Motorista incompleto: " + marker);
}
if (!courier.includes(".setMinUpdateDistanceMeters(5f)") ||
    courier.includes(".setMinUpdateDistanceMeters(0f)")) {
  throw Error("[FAIL] QA280: o GPS do Entregador não pode sofrer a mudança do Motorista.");
}
for (const marker of [
  "registerPlugin(DriverLocationPlugin.class)",
  "registerPlugin(CourierLocationPlugin.class)",
  "registerPlugin(APOISExternalNavigationPlugin.class)",
  "APOISReturnBubble",
]) {
  if (!main.includes(marker)) throw Error("[FAIL] QA280: MainActivity sem " + marker);
}
for (const marker of [
  "public void bubbleStatus(PluginCall call)",
  "public void setOperation(PluginCall call)",
  "qa235PickupLat",
]) {
  if (!nav.includes(marker)) throw Error("[FAIL] QA280: navegação nativa sem " + marker);
}
for (const marker of [
  'android:name=".DriverLocationService"',
  'android:name=".CourierLocationService"',
  'android:foregroundServiceType="location"',
  "android.permission.FOREGROUND_SERVICE_LOCATION",
]) {
  if (!manifest.includes(marker)) throw Error("[FAIL] QA280: Manifest Android sem " + marker);
}
if (manifest.includes("android.permission.ACCESS_BACKGROUND_LOCATION")) {
  throw Error("[FAIL] QA280: permissão de localização background não autorizada foi incluída.");
}
console.log("[OK] QA280: Android Parceiro inclui GPS real parado, chegada QA235, PIN QA236, bubble QA240 e Entregador preservado.");
