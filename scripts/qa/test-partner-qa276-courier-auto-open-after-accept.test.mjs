// QA276: static and simulated regression gates for the generated Courier workspace.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const marker = "APOIS_PARTNER_QA276_COURIER_AUTONAV_AFTER_ACCEPT_V1";
const scriptPath = resolve("scripts/fix-partner-qa276-courier-auto-open-after-accept.mjs");
const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const route = readFileSync(resolve(workspace, "src/routes/courier.tsx"), "utf8");

test("QA276: only a successful acceptance launches Maps/Waze, after server confirmation", () => {
  assert.ok(route.includes(marker), "generated Courier contains QA276 patch");
  const acceptStart = route.indexOf("  const acceptOffer = async (offerId: string) => {");
  const rejectStart = route.indexOf("  const rejectOffer = async (offerId: string) => {", acceptStart);
  assert.ok(acceptStart >= 0 && rejectStart > acceptStart, "offer callbacks preserved");
  const handler = route.slice(acceptStart, rejectStart);
  for (const needle of [
    'rpc("accept_delivery_offer", { _offer_id: acceptedOfferId })',
    'if (error) {',
    'toast.success("Entrega aceita.");',
    "await loadCourierOperations(courier.id);",
    "await apoisOpenPickupAfterCourierAcceptance(courier.id);",
    "catch (navigationError)",
    "Use Reabrir mapa",
  ]) assert.ok(handler.includes(needle), "accept handler missing: " + needle);

  assert.ok(
    handler.indexOf('toast.success("Entrega aceita.");') <
    handler.indexOf("await apoisOpenPickupAfterCourierAcceptance(courier.id);"),
    "automatic navigator must run after confirmed server acceptance",
  );
  assert.equal(handler.match(/apoisOpenPickupAfterCourierAcceptance\(courier\.id\)/g)?.length, 1);
  const rejection = route.slice(rejectStart, route.indexOf("  const transitionDelivery", rejectStart));
  assert.ok(!rejection.includes("apoisOpenPickupAfterCourierAcceptance"), "rejected delivery never opens Maps");
});

test("QA276: external navigation uses approved courier's active pickup, not a random address", () => {
  const start = route.indexOf("async function apoisOpenPickupAfterCourierAcceptance(");
  const end = route.indexOf("function CourierApp() {", start);
  assert.ok(start >= 0 && end > start, "new native navigation helper exists");
  const helper = route.slice(start, end);
  for (const needle of [
    "if (!isNativeCourierAndroid()) return;",
    '.from("delivery_jobs")',
    '.eq("courier_id", courierId)',
    '.in("status", ["accepted", "arriving_pickup"])',
    "validNavigationCoordinate(data.pickup_latitude, data.pickup_longitude)",
    'await setApoisOperationalNotification("entregador", true);',
    "launchApoisNavigationAfterRideStart(",
  ]) assert.ok(helper.includes(needle), "unsafe or missing pickup navigation guard: " + needle);
  assert.ok(helper.indexOf('await setApoisOperationalNotification("entregador", true);') < helper.indexOf("await launchApoisNavigationAfterRideStart("), "QA278 arms Android bubble before navigating");
  assert.ok(!helper.includes('setApoisOperationalNotification("motorista"'), "QA278 does not touch Motorista");
  assert.ok(!helper.includes("update(") && !helper.includes("insert("), "navigation is read-only");
  assert.ok(!helper.includes("rpc("), "navigation performs no delivery state changes");
});

test("QA276: preserves original courier dispatch, PIN, GPS and payment protections", () => {
  for (const needle of [
    "CourierLocationTracker",
    "useApoisOperationalNotification",
    "courierActionWithTimeout(",
    'rpc("accept_delivery_offer"',
    'rpc("reject_delivery_offer"',
    'rpc("complete_delivery_with_pin"',
    "setCompletedJob({ ...deliveredJob, status: \"delivered\" });",
    "courier_confirm_courier_settlement",
  ]) assert.ok(route.includes(needle), "original courier capability missing: " + needle);
});

test("QA276: duplicate application fails closed without modifying fixture", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "apois-qa276-"));
  try {
    const routeDir = resolve(dir, "src/routes");
    mkdirSync(routeDir, { recursive: true });
    const target = resolve(routeDir, "courier.tsx");
    writeFileSync(target, route, "utf8");
    const result = spawnSync(process.execPath, [scriptPath], {
      env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: dir },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0, "duplicate must be rejected");
    assert.match(result.stderr, /already installed/);
    assert.equal(readFileSync(target, "utf8"), route, "duplicate cannot mutate existing file");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
