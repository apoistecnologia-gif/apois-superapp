// QA219: guard the Motorista UI against out-of-order terminal events.
// Applied only to the disposable .work/partner-motorista after QA209.
// Never changes server lifecycle, rides, payment, Supabase or other modules.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const marker = "APOIS_DRIVER_QA219_STALE_TERMINAL_EVENT_GUARD_V1";
export function patchStaleTerminalEvents(source) {
  if (source.includes(marker)) throw new Error("[FAIL] QA219 already applied");
  const start = source.indexOf("    const applyActive = (r: RideRow) => {");
  const end = start < 0 ? -1 : source.indexOf("    const ch = supabase.channel(", start);
  if (start < 0 || end <= start) throw new Error("[FAIL] QA219 active-event handler not found");
  let handler = source.slice(start, end);
  const anchor = '      if (!driverId || (r.driver_id !== driverId && (r as any).accepted_driver_id !== driverId)) return;';
  if (handler.split(anchor).length !== 2) throw new Error("[FAIL] QA219 driver ownership guard changed");
  for (const contract of ['r.status === "finalizada"', 'r.status === "cancelada_passageiro"', 'r.status === "cancelada_motorista"', 'queuedRideRef.current', 'incomingRef.current', 'activeRef.current']) {
    if (!handler.includes(contract)) throw new Error("[FAIL] QA219 required event contract missing: " + contract);
  }
  const guard = [
    '      // ' + marker + ': a delayed event from an older trip cannot wipe a newer trip/offer.',
    '      const terminalEvent = r.status === "finalizada" || r.status === "cancelada_passageiro" || r.status === "cancelada_motorista";',
    '      const sameRideTracked = activeRef.current?.id === r.id || queuedRideRef.current?.id === r.id || incomingRef.current?.id === r.id;',
    '      const differentContextVisible = (activeRef.current != null && activeRef.current.id !== r.id)',
    '        || (queuedRideRef.current != null && queuedRideRef.current.id !== r.id)',
    '        || (incomingRef.current != null && incomingRef.current.id !== r.id);',
    '      if (terminalEvent && differentContextVisible && !sameRideTracked) return;',
  ].join("\n");
  handler = handler.replace(anchor, anchor + "\n" + guard);
  // A cancelled queued offer must not erase an unrelated incoming offer or active trip.
  const cancelStart = handler.indexOf('      } else if (r.status === "cancelada_passageiro" || r.status === "cancelada_motorista") {');
  const cancelEnd = cancelStart < 0 ? -1 : handler.indexOf('      } else if (r.status === "motorista_a_caminho"', cancelStart);
  if (cancelStart < 0 || cancelEnd <= cancelStart) throw new Error("[FAIL] QA219 cancellation handler changed");
  let cancellation = handler.slice(cancelStart, cancelEnd);
  const incomingClears = cancellation.split('setIncoming(null);').length - 1;
  if (incomingClears !== 2) throw new Error("[FAIL] QA219 expected two conditional incoming clears, got " + incomingClears);
  cancellation = cancellation.replaceAll('setIncoming(null);', 'setIncoming((current) => current?.id === r.id ? null : current);');
  const oldClear = ["        setActive(null);", "        clearDriverRouteVisuals();"].join("\n");
  const newClear = ["        setActive((current) => current?.id === r.id ? null : current);", "        if (!activeRef.current || activeRef.current.id === r.id) clearDriverRouteVisuals();"].join("\n");
  if (cancellation.split(oldClear).length !== 2) throw new Error("[FAIL] QA219 cancellation route cleanup contract changed");
  cancellation = cancellation.replace(oldClear, newClear);
  handler = handler.slice(0, cancelStart) + cancellation + handler.slice(cancelEnd);
  const patched = source.slice(0, start) + handler + source.slice(end);
  for (const token of ['onClick={onAccept}', 'onClick={onReject}', 'onStart(pinCode)', 'onClick={handleComplete}', 'clearDriverRouteVisuals()']) {
    if (source.includes(token) && !patched.includes(token)) throw new Error("[FAIL] QA219 changed protected operation: " + token);
  }
  return patched;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const path = resolve(root, "src/routes/motorista.app.tsx");
  const original = readFileSync(path, "utf8");
  const patched = patchStaleTerminalEvents(original);
  writeFileSync(path, patched, "utf8");
  console.log("[OK] QA219 Motorista: late terminal events cannot reset a different visible ride/offer");
}
