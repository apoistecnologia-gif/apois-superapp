// QA280 — static guard for GitHub Actions APK compilation. No build is started.
// The installed QA278 uses this Action; Codemagic is NOT the APK builder.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file) => readFileSync(resolve(file), "utf8");
const workflow = read(".github/workflows/apois-partner-android.yml");
const installer = read("scripts/install-partner-native-qa280.mjs");
const driver = read("scripts/install-partner-driver-location.mjs");

const nativeSteps = [
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

test("QA280 GitHub Actions installs native GPS after Capacitor sync and before Gradle", () => {
  const start = workflow.indexOf("- name: Create Android project");
  const end = workflow.indexOf("- name: Restore original protected Partner QA signing identity");
  const gradle = workflow.indexOf("- name: Build installable debug APK");
  assert.ok(start >= 0 && end > start && gradle > end);
  const stage = workflow.slice(start, end);
  const sync = stage.indexOf("bunx cap sync android");
  const configure = stage.indexOf("node scripts/configure-partner-android.mjs");
  const splash = stage.indexOf("node scripts/install-partner-splash.mjs");
  const native = stage.indexOf("node scripts/install-partner-native-qa280.mjs");
  const gate = stage.indexOf("node --test scripts/qa/test-partner-qa280-native-build-gate-v1.test.mjs");
  assert.ok(sync >= 0 && configure > sync && splash > configure && native > splash && gate > native);
  assert.equal(workflow.split("node scripts/install-partner-native-qa280.mjs").length - 1, 1);
  assert.ok(workflow.slice(gradle).includes("./gradlew clean assembleDebug"));
});

test("QA280 does not auto-trigger an APK build merely by pushing its own branch", () => {
  const trigger = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
  const jobGuard = workflow.slice(workflow.indexOf("  build-partner-apk:"), workflow.indexOf("    runs-on: ubuntu-latest"));
  assert.ok(trigger.includes("workflow_dispatch:"));
  assert.ok(!trigger.includes("- fix/apois-parceiro-qa280-motorista-gps-chegada-20261116"));
  assert.ok(!jobGuard.includes("refs/heads/fix/apois-parceiro-qa280-motorista-gps-chegada-20261116"));
});

test("QA280 native runtime installers use the approved dependency order", () => {
  let previous = -1;
  for (const script of nativeSteps) {
    const marker = '  "' + script + '",';
    const position = installer.indexOf(marker);
    assert.ok(position > previous, "missing or wrong native order: " + script);
    assert.equal(installer.split(marker).length - 1, 1);
    previous = position;
  }
  for (const required of [
    "execFileSync(process.execPath", 'stdio: "inherit"',
    "qa235CheckPickupArrival(location)", "qa236PickupReady",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
  ]) assert.ok(installer.includes(required), "missing native guard: " + required);
});

test("QA280 checks both location services in the actual final APK Manifest", () => {
  const apk = workflow.slice(workflow.indexOf("- name: Build installable debug APK"));
  assert.ok(apk.includes('dump xmltree "$APK" AndroidManifest.xml'));
  assert.ok(apk.includes("br.com.apois.parceiro.DriverLocationService"));
  assert.ok(apk.includes("br.com.apois.parceiro.CourierLocationService"));
  assert.ok(apk.includes("APOIS_PARTNER_QA_CERT_SHA256"));
});

test("QA280 uses real stationary GPS without modifying Courier or settling rides", () => {
  assert.ok(driver.includes("service = service.replace(stationaryThreshold, '.setMinUpdateDistanceMeters(0f)');"));
  assert.ok(installer.includes('courier.includes(".setMinUpdateDistanceMeters(5f)")'));
  assert.ok(installer.includes('courier.includes(".setMinUpdateDistanceMeters(0f)")'));
  for (const prohibited of ["mockLocation", "ride_settlements", "driver_wallet_transactions"]) {
    assert.ok(!installer.includes(prohibited), "prohibited native installer action: " + prohibited);
  }
});
