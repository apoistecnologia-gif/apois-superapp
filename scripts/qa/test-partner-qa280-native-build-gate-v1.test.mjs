// Static regression: the native GPS fixes MUST reach the newly created Android APK.
// No APK build, GitHub Actions, production database or Android device is touched.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (file) => readFileSync(resolve(file), "utf8");
const cm = read("codemagic.yaml");
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

test("QA280 runs native installers after fresh cap sync and before signed APK", () => {
  const start = cm.indexOf("- name: Create APOIS Parceiro Android project");
  const end = cm.indexOf("- name: Build and sign APOIS Parceiro APK");
  assert.ok(start >= 0 && end > start);
  const androidStage = cm.slice(start, end);
  const sync = androidStage.indexOf("bunx cap sync android");
  const config = androidStage.indexOf("node scripts/configure-partner-android.mjs");
  const install = androidStage.indexOf("node scripts/install-partner-native-qa280.mjs");
  const testGate = androidStage.indexOf("node --test scripts/qa/test-partner-qa280-native-build-gate-v1.test.mjs");
  assert.ok(sync >= 0 && config > sync && install > config && testGate > install);
  assert.equal(cm.split("node scripts/install-partner-native-qa280.mjs").length - 1, 1);
  assert.ok(cm.slice(end).includes("./gradlew clean assembleRelease"));
});

test("QA280 installs only approved native prerequisites in dependency order", () => {
  let previous = -1;
  for (const script of nativeSteps) {
    const location = installer.indexOf('  "' + script + '",');
    assert.ok(location > previous, "native step missing or out of order: " + script);
    assert.equal(installer.split('  "' + script + '",').length - 1, 1);
    previous = location;
  }
  assert.ok(installer.includes("execFileSync(process.execPath"));
  assert.ok(installer.includes('stdio: "inherit"'));
  assert.ok(installer.includes("android.permission.FOREGROUND_SERVICE_LOCATION"));
  assert.ok(installer.includes("qa235CheckPickupArrival(location)"));
  assert.ok(installer.includes("qa236PickupReady"));
});

test("QA280 stationary GPS never modifies Entregador service or generates fake travel", () => {
  assert.ok(driver.includes("service = service.replace(stationaryThreshold, '.setMinUpdateDistanceMeters(0f)');"));
  assert.ok(installer.includes('courier.includes(".setMinUpdateDistanceMeters(5f)")'));
  assert.ok(installer.includes("courier.includes(\".setMinUpdateDistanceMeters(0f)\")"));
  assert.ok(!installer.includes("mockLocation"));
  assert.ok(!installer.includes("ride_settlements"));
  assert.ok(!installer.includes("driver_wallet_transactions"));
});
