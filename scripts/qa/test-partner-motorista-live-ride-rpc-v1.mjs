// Read-only static contract test for final transformed driver workspace.
// This test does not create, cancel, reject or mutate real rides.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const lifecycle = readFileSync(resolve(root, "src/lib/driverRideLifecycle.mobile.ts"), "utf8");
const app = readFileSync(resolve(root, "src/routes/motorista.app.tsx"), "utf8");
for (const required of [
  "APOIS_DRIVER_LIVE_RIDE_RPC_V1",
  'return callRpc("driver_reject_ride", { _ride_id: data.rideId });',
  'return callRpc("driver_cancel_ride", { _ride_id: data.rideId, _reason: serverReason });',
  'const isNoShow = /n[aã]o (apareceu|compareceu)/i.test(reason);',
  'callDriverRedispatchFunction("driver-finish-redispatch"',
  'callRpc("driver_start_ride"',
  'callRpc("driver_accept_ride"',
  'callRpc("driver_rate_passenger"',
]) assert.ok(lifecycle.includes(required), "Required canonical ride contract: " + required);
for (const forbidden of ["driver-reject-redispatch", "driver-cancel-redispatch"]) {
  assert.ok(!lifecycle.includes(forbidden), "Unpublished Edge route remains: " + forbidden);
}
const rejectHandler = app.split("async function handleReject() {")[1]?.split("async function handleDriverCancelRide(")[0];
assert.ok(rejectHandler, "Reject handler exists");
assert.ok(
  rejectHandler.indexOf("await callReject(") >= 0 &&
  rejectHandler.indexOf("await callReject(") < rejectHandler.indexOf('removeIncomingRequest(offer, "driver_rejected")'),
  "UI may only dismiss rejected ride after RPC confirmation"
);
assert.ok(rejectHandler.includes('toast.error("Não foi possível recusar a corrida"'), "Error visible to driver");
assert.ok(!rejectHandler.includes("void resyncDriverRides()"), "No out-of-scope resync callback");
const normalizeNoShow=(reason)=>/n[aã]o (apareceu|compareceu)/i.test(reason)
  ? reason.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  : reason;
assert.equal(normalizeNoShow("Passageiro não apareceu"),"Passageiro nao apareceu");
assert.equal(normalizeNoShow("Passageiro não compareceu"),"Passageiro nao compareceu");
assert.equal(normalizeNoShow("Problema mecânico"),"Problema mecânico");
console.log("[PASS] Corridas RPC, no-show pt-BR normalization and reject confirmation.");
