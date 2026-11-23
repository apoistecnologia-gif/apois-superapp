import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MARKER, fixDriverReject, fixCourierWatcher, fixCourierOfferPolling } from "../fix-partner-qa283-operational-races-v1.mjs";

const driverRoot = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const courierRoot = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const read = (path) => readFileSync(path, "utf8");

test("Driver: backend must acknowledge rejected offer before any local dismissal", () => {
  const generated = resolve(driverRoot, "src/routes/motorista.app.tsx");
  const pinned = resolve("sources/apois-corridas-motorista-admin/src/routes/motorista.app.tsx");
  const source = read(existsSync(generated) && process.env.APOIS_QA283_ROLE === "driver" ? generated : pinned);
  const patched = source.includes(MARKER) ? source : fixDriverReject(source);
  const block = patched.slice(patched.indexOf("  async function handleReject() {"), patched.indexOf("  async function handleDriverCancelRide("));
  const awaitIndex = block.indexOf("await callReject({ data: { rideId: offer.id } })");
  const dismissedIndex = block.indexOf('removeIncomingRequest(offer, "driver_rejected")');
  assert.ok(patched.includes(MARKER));
  assert.ok(awaitIndex >= 0 && dismissedIndex > awaitIndex, "UI must await the same offer's server operation");
  assert.ok(block.includes('toast.error("Falha ao recusar corrida"'));
  assert.ok(!block.includes('supabase.from("rides").update'));
  assert.equal(patched.split(MARKER).length, 2);
});

test("Courier: native watcher cleans up after late promise resolution", () => {
  const generated = resolve(courierRoot, "src/components/CourierLocationTracker.tsx");
  const pinned = resolve("sources/apois-entregas/src/components/CourierLocationTracker.tsx");
  const source = read(existsSync(generated) && process.env.APOIS_QA283_ROLE === "courier" ? generated : pinned);
  const patched = source.includes(MARKER) ? source : fixCourierWatcher(source);
  assert.ok(patched.includes("if (disposed && nativeWatchId)"));
  assert.ok(patched.includes("await Geolocation.clearWatch({ id: lateWatchId });"));
  assert.ok(patched.includes("return () => {"));
  assert.ok(patched.includes("startCourierNativeLocation") || source === read(pinned));
});

test("Courier: offer requests never overlap, remain realtime+push reactive", () => {
  const generated = resolve(courierRoot, "src/components/CourierOfferOverlay.tsx");
  const pinned = resolve("sources/apois-entregas/src/components/CourierOfferOverlay.tsx");
  const source = read(existsSync(generated) && process.env.APOIS_QA283_ROLE === "courier" ? generated : pinned);
  const patched = source.includes(MARKER) ? source : fixCourierOfferPolling(source);
  for (const token of [
    "offersLoadingRef.current = true",
    "if (offersLoadingRef.current) return",
    "offersLoadingRef.current = false",
    'document.visibilityState === "visible"',
    'window.addEventListener("apois:courier-push", refresh)',
    'table: "delivery_offers"',
    'table: "courier_availability"',
    'callRpc("accept_delivery_offer"',
  ]) assert.ok(patched.includes(token), "Missing real-time or single-flight contract " + token);
  assert.ok(patched.includes("}, 1000);"), "1-second visible offer fallback is preserved");
});

test("No Edge Function replacement and no direct mutation of critical ride/order rows", () => {
  const src = read("scripts/fix-partner-qa283-operational-races-v1.mjs");
  assert.ok(src.includes("fail-closed"));
  assert.ok(!src.includes('callRpc("driver_reject_ride"'));
  assert.ok(!src.includes('callRpc("driver_cancel_ride"'));
  assert.ok(!src.includes('from("rides").update('));
  assert.ok(!src.includes("service_role"));
});
