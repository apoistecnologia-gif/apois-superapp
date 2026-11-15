// QA277: regression tests for the global CourierOfferOverlay's independent RPC.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const overlay = readFileSync(resolve(workspace, "src/components/CourierOfferOverlay.tsx"), "utf8");
const marker = "APOIS_PARTNER_QA277_COURIER_OVERLAY_AUTONAV_AFTER_ACCEPT_V1";
const script = resolve("scripts/fix-partner-qa277-courier-overlay-autonav.mjs");

test("QA277: actual overlay accept RPC opens native navigation only on success", () => {
  assert.ok(overlay.includes(marker), "overlay patch present");
  const from = overlay.indexOf('  const respond = async (action: "accept" | "reject") => {');
  const to = overlay.indexOf("\n  return (", from);
  assert.ok(from >= 0 && to > from);
  const handler = overlay.slice(from, to);
  const expected = [
    'action === "accept" ? "accept_delivery_offer" : "reject_delivery_offer"',
    "if (error) {",
    "stopAlert();",
    'toast.success(action === "accept" ? "Entrega aceita." : "Oferta recusada.");',
    'if (action === "accept" && courierId && isNativeCourierAndroid()) {',
    '.from("delivery_jobs")',
    '.eq("courier_id", courierId)',
    '.in("status", ["accepted", "arriving_pickup"])',
    "validNavigationCoordinate(acceptedJob.pickup_latitude, acceptedJob.pickup_longitude)",
    'await setApoisOperationalNotification("entregador", true);',
    "await launchApoisNavigationAfterRideStart(",
    "catch (navigationError)",
    "Use Reabrir mapa",
  ];
  for (const token of expected) assert.ok(handler.includes(token), "missing overlay guard: " + token);
  assert.ok(handler.indexOf("if (error) {") < handler.indexOf("launchApoisNavigationAfterRideStart("));
  assert.ok(handler.indexOf('await setApoisOperationalNotification("entregador", true);') < handler.indexOf("await launchApoisNavigationAfterRideStart("), "QA278 arms the bubble first");
  assert.ok(!handler.includes('setApoisOperationalNotification("motorista"'), "QA278 does not touch Motorista");
  assert.ok(handler.indexOf("await loadOffers();\n\n    // " + marker) >= 0);
  assert.equal(handler.split("launchApoisNavigationAfterRideStart(").length - 1, 1);
  assert.ok(handler.indexOf('if (action === "accept"') < handler.indexOf("launchApoisNavigationAfterRideStart("));
});

test("QA277: no navigation on offer poll/reject and no changes to delivery state", () => {
  const before = overlay.slice(0, overlay.indexOf('  const respond = async (action: "accept" | "reject") => {'));
  assert.ok(!before.includes("launchApoisNavigationAfterRideStart("));
  assert.ok(!overlay.includes('rpc("courier_transition_delivery"'), "no status mutation in offer UI");
  assert.ok(!overlay.includes('rpc("complete_delivery_with_pin"'), "PIN is separate");
  const courier = readFileSync(resolve(workspace, "src/routes/courier.tsx"), "utf8");
  assert.ok(courier.includes("APOIS_PARTNER_QA276_COURIER_AUTONAV_AFTER_ACCEPT_V1"), "other accept path still covered");
  assert.ok(courier.includes("onComplete={completeDelivery}"));
  assert.ok(courier.includes('rpc("complete_delivery_with_pin"'));
});

test("QA277: second application fails closed and preserves original generated file", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "apois-qa277-"));
  try {
    const path = resolve(dir, "src/components/CourierOfferOverlay.tsx");
    mkdirSync(resolve(dir, "src/components"), { recursive: true });
    writeFileSync(path, overlay, "utf8");
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: dir },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already patched/);
    assert.equal(readFileSync(path, "utf8"), overlay);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
