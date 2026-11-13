import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { patchStaleTerminalEvents, marker } from "../fix-partner-driver-qa219-stale-ride-events-v1.mjs";

const anchor = '      if (!driverId || (r.driver_id !== driverId && (r as any).accepted_driver_id !== driverId)) return;';
const fixture = [
  "function MotoristaApp() {",
  "  const removeIncomingRequest = useCallback((ride: RideRow) => {",
  "    setIncoming(null);",
  "  }, [userId]);",
  "  // Toast em cada transição",
  "    const applyActive = (r: RideRow) => {",
  anchor,
  '      const queued = queuedRideRef.current;',
  '      const incoming = incomingRef.current;',
  '      const active = activeRef.current;',
  '      if (r.status === "finalizada") { setActive(null); clearDriverRouteVisuals();',
  '      } else if (r.status === "cancelada_passageiro" || r.status === "cancelada_motorista") {',
  '        if (wasQueued) { setIncoming(null); return; }',
  '        setIncoming(null);',
  '        setActive(null);',
  '        clearDriverRouteVisuals();',
  '      } else if (r.status === "motorista_a_caminho") { setActive(r); }',
  "    };",
  '    const ch = supabase.channel("driver-rides");',
  "}",
].join("\n");

test("adds one guard inside ownership-checked active event handler", () => {
  const result = patchStaleTerminalEvents(fixture);
  assert.equal(result.split(marker).length - 1, 1);
  assert.ok(result.indexOf(anchor) < result.indexOf(marker));
  assert.ok(result.indexOf(marker) < result.indexOf('if (r.status === "finalizada")'));
  assert.ok(result.includes("terminalEvent && differentContextVisible && !sameRideTracked"));
  assert.ok(result.includes("activeRef.current?.id === r.id"));
  assert.ok(result.includes("queuedRideRef.current?.id === r.id"));
  assert.ok(result.includes("incomingRef.current?.id === r.id"));
  assert.equal(result.split("setIncoming((current) => current?.id === r.id ? null : current);").length - 1, 2);
  assert.ok(result.includes("setActive((current) => current?.id === r.id ? null : current)"));
  assert.ok(result.includes("if (!activeRef.current || activeRef.current.id === r.id) clearDriverRouteVisuals()"));
  assert.ok(result.includes("setIncoming((current) => current?.id === ride.id ? null : current);"));
  assert.ok(result.includes("const phaseOrder: Record<string, number>"));
  assert.ok(result.includes("(phaseOrder[activeRef.current.status] ?? 0) > (phaseOrder[r.status] ?? 0)"));
  assert.ok(result.includes('if (r.status === "finalizada" && activeRef.current && activeRef.current.id !== r.id) return;'));
  assert.ok(result.includes('const ch = supabase.channel'));
});
test("refuses a repeated application or an unexpected handler shape", () => {
  const result = patchStaleTerminalEvents(fixture);
  assert.throws(() => patchStaleTerminalEvents(result), /already applied/);
  assert.throws(() => patchStaleTerminalEvents(fixture.replace(anchor, "")), /ownership guard changed/);
  assert.throws(() => patchStaleTerminalEvents(fixture.replace("    const ch = supabase.channel", "    const sub = supabase.channel")), /handler not found/);
});
test("guard evaluates out-of-order and independent ride events without changing valid transitions", () => {
  const patched = patchStaleTerminalEvents(fixture);
  const begin = patched.indexOf('      const terminalEvent = r.status');
  const end = patched.indexOf('      const queuedAfterRideId', begin);
  assert.ok(begin > 0 && end > begin);
  const guardSource = patched.slice(begin, end).replace("const phaseOrder: Record<string, number>", "const phaseOrder");
  const evaluate = new Function("r", "activeRef", "queuedRideRef", "incomingRef",
    guardSource + '\\nreturn true;');
  const check = (status, currentId, currentStatus, rideId = "A", queuedId = null, incomingId = null) =>
    evaluate({id:rideId,status}, {current: currentId ? {id:currentId,status:currentStatus} : null},
      {current:queuedId ? {id:queuedId} : null}, {current:incomingId ? {id:incomingId} : null}) === true;
  assert.equal(check("motorista_chegou", "A", "em_viagem"), false, "never regress same ride");
  assert.equal(check("motorista_a_caminho", "A", "motorista_chegou"), false, "no delayed pickup");
  assert.equal(check("em_viagem", "A", "motorista_chegou"), true, "forward progress accepted");
  assert.equal(check("motorista_chegou", "A", "motorista_a_caminho"), true, "forward pickup accepted");
  assert.equal(check("finalizada", "B", "em_viagem", "A", null, "A"), false, "old finish cannot erase new active ride");
  assert.equal(check("cancelada_motorista", "B", "em_viagem", "A"), false, "unrelated terminal ignored");
  assert.equal(check("cancelada_passageiro", "B", "em_viagem", "A", "A"), true, "queued ride cancellation still processed");
  assert.equal(check("finalizada", "A", "em_viagem"), true, "current ride may complete");
  assert.equal(check("finalizada", null, null), true, "resume history without active ride");
});

test("checks generated Motorista when disposable workspace is present", () => {
  const path = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista", "src/routes/motorista.app.tsx");
  if (!existsSync(path)) return;
  const source = readFileSync(path, "utf8");
  assert.ok(source.includes(marker));
  for (const callback of ["onClick={onAccept}", "onClick={onReject}", "onStart(pinCode)", "onClick={handleComplete}", "clearDriverRouteVisuals()"])
    assert.ok(source.includes(callback), callback);
});
