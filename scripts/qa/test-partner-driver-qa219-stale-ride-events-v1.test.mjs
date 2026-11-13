import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { patchStaleTerminalEvents, marker } from "../fix-partner-driver-qa219-stale-ride-events-v1.mjs";

const anchor = '      if (!driverId || (r.driver_id !== driverId && (r as any).accepted_driver_id !== driverId)) return;';
const fixture = [
  "function MotoristaApp() {",
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
  assert.ok(result.includes('const ch = supabase.channel'));
});
test("refuses a repeated application or an unexpected handler shape", () => {
  const result = patchStaleTerminalEvents(fixture);
  assert.throws(() => patchStaleTerminalEvents(result), /already applied/);
  assert.throws(() => patchStaleTerminalEvents(fixture.replace(anchor, "")), /ownership guard changed/);
  assert.throws(() => patchStaleTerminalEvents(fixture.replace("    const ch = supabase.channel", "    const sub = supabase.channel")), /handler not found/);
});
test("checks generated Motorista when disposable workspace is present", () => {
  const path = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista", "src/routes/motorista.app.tsx");
  if (!existsSync(path)) return;
  const source = readFileSync(path, "utf8");
  assert.ok(source.includes(marker));
  for (const callback of ["onClick={onAccept}", "onClick={onReject}", "onStart(pinCode)", "onClick={handleComplete}", "clearDriverRouteVisuals()"])
    assert.ok(source.includes(callback), callback);
});
