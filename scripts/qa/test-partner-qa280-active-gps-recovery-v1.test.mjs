// APOIS QA280 — regression for the generated Motorista active ride UI.
// Runs on disposable workspace; never invokes GPS or production Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(".work/partner-motorista/src/routes/motorista.app.tsx"), "utf8");
test("accepted ride always provides visible GPS recovery without leaving the ride", () => {
  for (const expected of [
    "APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1",
    'data-apois-qa280-active-gps-recovery="true"',
    '["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status)',
    "Recuperar GPS e ficar ONLINE",
    "Verificar / recuperar GPS",
    'if (!online) setDesiredOnline(true)',
  ]) assert.ok(source.includes(expected), "missing active GPS recovery: "+expected);
  assert.equal(source.split('data-apois-qa280-active-gps-recovery="true"').length - 1, 1);
});

test("recovery reuses Android official permissions, FGS ACK and Supabase online acknowledgment", () => {
  const start = source.indexOf("  const recoverActiveRideGps = useCallback(async () => {");
  const end = source.indexOf("  // realtime: ofertas (broadcast) + corrida ativa — canal estável", start);
  assert.ok(start >= 0 && end > start);
  const method = source.slice(start,end);
  for(const expected of [
    "activeRef.current", "Geolocation.getCurrentPosition({",
    "enableHighAccuracy: true", "maximumAge: 0", "coords.accuracy > 65",
    "await startNativeDriverLocation()", 'await setApoisOperationalNotification("motorista", true',
    'rpc("driver_set_presence"', "_online: true", "if (data?.is_online !== true)",
    "setGpsStatus(\"granted\")", "setPosition(", "startWatch()",
    "if (!online) setDesiredOnline(true)",
  ]) assert.ok(method.includes(expected), "lost recovery requirement: "+expected);
  assert.ok(!method.includes("toggleOnline();"), "no early return before GPS/FGS ACK during an OFFLINE ride");
  assert.ok(method.indexOf("if (!online) setDesiredOnline(true)") > method.indexOf("if (data?.is_online !== true)"), "local ONLINE only after server ACK");
  for(const forbidden of ["callStart(", "callComplete(", "callCancel(", "setActive(", "qa236PinOpen", "stopNativeDriverLocation(", "_online: false"]) {
    assert.ok(!method.includes(forbidden), "recovery must not mutate ride/stop FGS: "+forbidden);
  }
});

test("existing QA236 authenticated PIN flow stays intact", () => {
  assert.ok(source.includes("await callStart({data:{rideId:ride.id,safety_code:code}})"));
  assert.ok(source.includes('data-apois-qa236-start-ride="true"'));
});

test("QA280 PIN text is readable on narrow Android screens without changing the official swipe action", () => {
  const pin = readFileSync(resolve("superapp/partner-shell/shared/ApoisPickupPin.tsx"), "utf8");
  assert.ok(pin.includes('data-apois-qa280-pin-legibility="true"'));
  assert.ok(pin.includes("white-space: normal !important"));
  assert.ok(pin.includes("text-overflow: clip !important"));
  assert.ok(pin.includes('ApoisSlideAction label="Confirmar PIN e iniciar corrida"'));
  assert.ok(pin.includes("onConfirm={confirm}"));
});

