// APOIS_DRIVER_LIVE_RIDE_RPC_V1 — worktree-only patch; no server mutations at build time.
// The Corridas production project publishes driver_reject_ride/driver_cancel_ride RPCs;
// it does not publish driver-reject-redispatch/driver-cancel-redispatch Edge Functions.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function replaceOne(source, before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) throw Error("[FAIL] Driver live RPC: " + label + " occurrences=" + occurrences);
  return source.replace(before, after);
}

const lifecyclePath = resolve(root, "src/lib/driverRideLifecycle.mobile.ts");
let lifecycle = readFileSync(lifecyclePath, "utf8");
if (lifecycle.includes("APOIS_DRIVER_LIVE_RIDE_RPC_V1")) throw Error("[FAIL] Driver live RPC patch applied twice");
lifecycle = replaceOne(
  lifecycle,
  '"driver-reject-redispatch" | "driver-cancel-redispatch" | "driver-finish-redispatch"',
  '"driver-finish-redispatch"',
  "only installed Edge endpoint"
);
lifecycle = replaceOne(
  lifecycle,
  `  return callDriverRedispatchFunction("driver-reject-redispatch", {
    ride_id: data.rideId,
  });`,
  `  // APOIS_DRIVER_LIVE_RIDE_RPC_V1: server-side authenticated rejection.
  return callRpc("driver_reject_ride", { _ride_id: data.rideId });`,
  "reject uses published RPC"
);
lifecycle = replaceOne(
  lifecycle,
  `  return callDriverRedispatchFunction("driver-cancel-redispatch", {
    ride_id: data.rideId,
    reason: reason || null,
  });`,
  `  if (reason.length < 3) throw new Error("Informe o motivo do cancelamento.");
  // Preserve no-show/arrival/driver-ownership guards inside canonical server RPC.
  return callRpc("driver_cancel_ride", { _ride_id: data.rideId, _reason: reason });`,
  "cancel uses published RPC"
);
for (const forbidden of ["driver-reject-redispatch", "driver-cancel-redispatch"]) {
  if (lifecycle.includes(forbidden)) throw Error("[FAIL] Unpublished Edge endpoint remains: " + forbidden);
}
for (const needed of ['"driver_reject_ride"', '"driver_cancel_ride"', '"driver-finish-redispatch"', '"driver_start_ride"', '"driver_accept_ride"', '"driver_rate_passenger"']) {
  if (!lifecycle.includes(needed)) throw Error("[FAIL] Ride contract missing: " + needed);
}
writeFileSync(lifecyclePath, lifecycle, "utf8");

// A rejection is not a UI success until the database confirms it.
const appPath = resolve(root, "src/routes/motorista.app.tsx");
let app = readFileSync(appPath, "utf8");
const start = app.indexOf("  async function handleReject() {");
const end = app.indexOf("\n  async function handleDriverCancelRide(", start);
if (start < 0 || end < start) throw Error("[FAIL] Driver reject handler boundary not found");
const old = app.slice(start, end);
if (!old.includes('removeIncomingRequest(offer, "driver_rejected")') || !old.includes('await callReject(')) {
  throw Error("[FAIL] Driver reject handler contract drift");
}
app = app.slice(0, start) + `  // APOIS_DRIVER_LIVE_RIDE_RPC_V1: keep the offer visible until the server confirms rejection.
  async function handleReject() {
    const offer = incomingRef.current;
    if (!offer) return;
    try {
      await callReject({ data: { rideId: offer.id } });
      removeIncomingRequest(offer, "driver_rejected");
      if (import.meta.env.DEV) console.log("[APOIS MOTORISTA] corrida recusada:", offer.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Não foi possível recusar a corrida", { description: message });
      void resyncDriverRides().catch(() => undefined);
    }
  }
` + app.slice(end);
if (app.includes('removeIncomingRequest(offer, "driver_rejected");\n    if (import.meta.env.DEV)')) {
  throw Error("[FAIL] Pre-confirmation reject UI still present");
}
writeFileSync(appPath, app, "utf8");
console.log("[OK] Motorista: reject/cancel target installed authenticated RPCs; reject UI waits for server.");
