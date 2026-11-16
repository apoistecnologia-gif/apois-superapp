// APOIS QA280 — source-level regression for real stationary GPS and QA235 arrival.
// Does not contact production, alter rides, synthesize GPS fixes, or build an APK.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const driverSource = read("sources/apois-corridas-motorista-admin/android-motorista/app/src/main/java/com/apois/motorista/DriverLocationService.java");
const driverInstaller = read("scripts/install-partner-driver-location.mjs");
const arrivalInstaller = read("scripts/install-partner-qa235-native-auto-arrival.mjs");

test("QA280 retains pinned source and fixes only generated Motorista service", () => {
  const original = ".setMinUpdateDistanceMeters(5f)";
  const adjusted = ".setMinUpdateDistanceMeters(0f)";
  assert.equal(driverSource.split(original).length - 1, 1, "pinned native source must have one 5m threshold");
  assert.ok(driverInstaller.includes("const stationaryThreshold = '"+original+"'"));
  assert.ok(driverInstaller.includes("service.split(stationaryThreshold).length !== 2"));
  assert.ok(driverInstaller.includes("service = service.replace(stationaryThreshold, '"+adjusted+"');"));
  const generated = driverSource.replace(original, adjusted);
  assert.equal(generated.split(adjusted).length - 1, 1);
  assert.ok(generated.includes("Priority.PRIORITY_HIGH_ACCURACY, 5_000L"));
  assert.ok(generated.includes(".setMinUpdateIntervalMillis(3_000L)"));
  assert.ok(driverInstaller.includes("'"+adjusted+"'"), "generated service requires the fix");
  assert.ok(!driverInstaller.includes("CourierLocationService.java'), service.replace"), "courier must remain unchanged");
});

test("QA235 still requires real fresh, accurate, sustained GPS before official RPC", () => {
  for (const required of [
    "qa235CheckPickupArrival(location)",
    "now-capturedAt(location)>15000L",
    "location.getAccuracy()>65f",
    "location.distanceTo(pickup)>85f",
    "now-qa235LastAt<2500L",
    "qa235Fixes<3",
    "now-qa235FirstAt<6500L",
    "/rest/v1/rpc/driver_mark_arrived",
    "refreshSession()",
    "qa235SendPush(\"ride.driver_arrived\",rideId)",
  ]) {
    assert.ok(arrivalInstaller.includes(required), "lost arrival guard: "+required);
  }
  assert.ok(!arrivalInstaller.includes("mockLocation("));
  assert.ok(!arrivalInstaller.includes("setMockLocation("));
});

test("QA280 keeps financial transitions, PIN and Entregador outside this patch", () => {
  assert.ok(!driverInstaller.includes("driver_settlement"));
  assert.ok(!driverInstaller.includes("ride_settlements"));
  const pin = read("scripts/fix-partner-qa236-pickup-pin-v1.mjs");
  assert.ok(pin.includes("await callStart({data:{rideId:ride.id,safety_code:code}})"));
  assert.ok(pin.includes("await callArrive({data:{rideId:ride.id}})"));
});
