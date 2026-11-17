// QA280 — read-only post-install verification of Android native services.
// IMPORTANT: install-partner-launcher.mjs ALREADY executes every native installer
// (and verify-partner-native-plugins) through static imports. Never run them again:
// the external navigation installer correctly rejects double registration.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const javaRoot = resolve(root, "superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro");
const manifestPath = resolve(root, "superapp/partner-shell/android/app/src/main/AndroidManifest.xml");
if (!existsSync(manifestPath)) throw Error("[FAIL] QA280: Android Parceiro ainda não existe.");

const readJava = (name) => {
  const path = resolve(javaRoot, name);
  if (!existsSync(path)) throw Error("[FAIL] QA280: componente nativo ausente: " + name);
  return readFileSync(path, "utf8");
};
const driver = readJava("DriverLocationService.java");
const driverPlugin = readJava("DriverLocationPlugin.java");
const courier = readJava("CourierLocationService.java");
const courierPlugin = readJava("CourierLocationPlugin.java");
const main = readJava("MainActivity.java");
const nav = readJava("APOISExternalNavigationPlugin.java");
const manifest = readFileSync(manifestPath, "utf8");

for (const marker of [
  ".setMinUpdateDistanceMeters(0f)",
  "qa235CheckPickupArrival(location)",
  "/rest/v1/rpc/driver_mark_arrived",
  "qa236PickupReady",
  "driver_set_presence",
  "setStartupConfirmed(true);",
  "private void loadPersistedSessionTokens()",
]) {
  if (!driver.includes(marker)) throw Error("[FAIL] QA280: GPS Motorista incompleto: " + marker);
}
if (!courier.includes(".setMinUpdateDistanceMeters(5f)") ||
    courier.includes(".setMinUpdateDistanceMeters(0f)")) {
  throw Error("[FAIL] QA280: GPS do Entregador sofreu alteração destinada apenas ao Motorista.");
}
for (const [role, plugin] of [["Motorista",driverPlugin],["Entregador",courierPlugin]]) {
  for (const marker of [
    "STARTUP_ACK_MAX_ATTEMPTS = 4",
    "private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)",
    "public void updateSession(PluginCall call)",
  ]) {
    if (!plugin.includes(marker)) throw Error("[FAIL] QA280: " + role + " plugin incompleto: " + marker);
  }
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
  if (!nav.includes(marker)) throw Error("[FAIL] QA280: navegação sem " + marker);
}
for (const marker of [
  'android:name=".DriverLocationService"',
  'android:name=".CourierLocationService"',
  'android:foregroundServiceType="location"',
  "android.permission.FOREGROUND_SERVICE_LOCATION",
]) {
  if (!manifest.includes(marker)) throw Error("[FAIL] QA280: AndroidManifest.xml sem " + marker);
}
if (manifest.includes("android.permission.ACCESS_BACKGROUND_LOCATION")) {
  throw Error("[FAIL] QA280: permissão de localização background não autorizada foi incluída.");
}
console.log("[OK] QA280: componentes nativos preinstalados pelo launcher verificados sem reexecutar instaladores; Motorista 0 m, Entregador 5 m, chegada QA235, PIN QA236 e bolha QA240.");
