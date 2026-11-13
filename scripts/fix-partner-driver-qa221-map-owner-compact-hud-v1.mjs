// APOIS_DRIVER_QA221_MAP_OWNER_COMPACT_HUD_V1
// Android physical 1001992851.mp4: duplicate route HUD and automatic full-route jump.
// A legacy DriverActiveRideRecovery mounted beside the real navigation controller
// draws a second route on window.__apoisMovviMap and independently calls fitBounds.
// Keep recovery working on screens without the Motorista map; make main navigation
// the sole map owner, then compress upper HUDs. No RPC/auth/finance changes.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const marker = "APOIS_DRIVER_QA221_MAP_OWNER_COMPACT_HUD_V1";
export const owner = 'data-apois-driver-main-map-owner="true"';

function once(source, from, to, label) {
  const n = source.split(from).length - 1;
  if (n !== 1) throw Error("[FAIL] QA221 " + label + " count=" + n);
  return source.replace(from, to);
}

export function patchRecovery(source) {
  if (source.includes(marker)) throw Error("[FAIL] QA221 recovery duplicate");
  const required = [
    "export function DriverActiveRideRecovery() {",
    'driver-active-route-recovery-rides-',
    'driver-active-route-recovery-presence-',
    'const map = (window as ApoisMapWindow).__apoisMovviMap;',
    "map.fitBounds(bounds, { top: 105, right: 38, bottom: 180, left: 38 });",
    "void (async () => {",
    "const result = await computeDriverRoute({ data: { origin: position, destination } });"
  ];
  for (const tok of required) if (!source.includes(tok)) throw Error("[FAIL] QA221 recovery prerequisite " + tok);
  source = once(source,
    'type ApoisMapWindow = Window & { __apoisMovviMap?: google.maps.Map | null };',
    [
      'type ApoisMapWindow = Window & { __apoisMovviMap?: google.maps.Map | null };',
      '',
      '// ' + marker + ': primary driver screen owns the camera and route overlays.',
      'export function mainDriverOwnsMap(): boolean {',
      '  return typeof document !== "undefined"',
      '    && document.querySelector(' + JSON.stringify('[' + owner + ']') + ') !== null;',
      '}'
    ].join("\n"),
    "explicit primary map ownership detector"
  );
  // Main Map is present in the DOM when effects execute. Do not start a
  // second route query, or clear any overlay belonging to the primary map.
  source = once(source,
    '  useEffect(() => {\n    if (!ride || !position || !destination || ride.status === "motorista_chegou") {',
    [
      '  useEffect(() => {',
      '    if (mainDriverOwnsMap()) {',
      '      // QA221: recovery is passive while the foreground Motorista controls Maps.',
      '      routeKeyRef.current = "";',
      '      clearLines();',
      '      return;',
      '    }',
      '    if (!ride || !position || !destination || ride.status === "motorista_chegou") {'
    ].join("\n"),
    "no duplicate recovery while primary map visible"
  );
  source = once(source,
    '        if (cancelled) return;\n        const points = decodePolyline(result.encodedPolyline);',
    '        if (cancelled || mainDriverOwnsMap()) return; // A map may mount during the awaited request.\n        const points = decodePolyline(result.encodedPolyline);',
    "stale secondary route response cannot pan main map"
  );
  source = once(source,
    '  if (!ride || ride.status === "motorista_chegou") return null;',
    '  if (mainDriverOwnsMap()) return null; // Never duplicate the main navigation HUD.\n  if (!ride || ride.status === "motorista_chegou") return null;',
    "no duplicate metric card"
  );
  for (const tok of ["driver_get_profile", "driver-active-route-recovery-rides-", "driver-active-route-recovery-presence-", "map.fitBounds(bounds", "mainDriverOwnsMap()"]) {
    if (!source.includes(tok)) throw Error("[FAIL] QA221 recovery lost existing capability " + tok);
  }
  return source;
}

export function patchMainMapOwner(source) {
  if (source.includes(owner)) throw Error("[FAIL] QA221 primary marker duplicate");
  if (!source.includes("APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1") ||
      !source.includes("APOIS_DRIVER_QA219_STALE_TERMINAL_EVENT_GUARD_V1")) {
    throw Error("[FAIL] QA221 requires final QA220/219 Motorista workspace");
  }
  source = once(source,
    '<div className="relative h-[100dvh] w-screen overflow-hidden bg-background text-foreground">',
    '<div ' + owner + ' className="relative h-[100dvh] w-screen overflow-hidden bg-background text-foreground">',
    "mark sole primary navigation screen"
  );
  for (const tok of ["applyNavigationCamera(", "autoFollowRef.current", "onClick={onShowRoute}", "onClick={onRecenter}", "onStart(pinCode)"]) {
    if (!source.includes(tok)) throw Error("[FAIL] QA221 main camera/ride contract " + tok);
  }
  return source;
}

const pickupTop = [
  '      {/* ' + marker + ': pickup uses one concise, accessible status strip. */}',
  '      <div data-apois-pickup-top-v4="true" data-apois-qa221-pickup-hud="true"',
  '        className="pointer-events-none fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3"',
  '        style={{ top: "max(56px, calc(env(safe-area-inset-top) + 6px))" }}>',
  '        <div className="pointer-events-auto rounded-2xl border border-[#E5E7EB] bg-white/95 px-3 py-2 text-[#111827] shadow-sm">',
  '          <div className="flex min-h-10 items-center justify-between gap-2">',
  '            <div className="min-w-0 flex-1">',
  '              <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#C9141B]">Indo ao passageiro</p>',
  '              <p className="mt-0.5 truncate text-[11px] font-semibold tabular-nums text-[#344054]">',
  '                {minutes != null ? String(minutes) + " min" : "ETA —"} {" · "}',
  '                {legKm != null ? legKm.toFixed(1) + " km" : "— km"} {" · "} {arrivalTime ?? "—"}',
  '              </p>',
  '            </div>',
  '            <button type="button" onClick={handleCancel} disabled={cancelBusy}',
  '              aria-label="Cancelar corrida" className="min-h-11 shrink-0 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-[12px] font-bold text-[#344054] disabled:opacity-50">',
  '              Cancelar',
  '            </button>',
  '          </div>',
  '        </div>',
  '      </div>',
  ''
].join("\n");

const tripTop = [
  '      {/* ' + marker + ': single compact nav strip, no layered stat cards. */}',
  '      <div data-apois-qa221-trip-hud="true" className="pointer-events-none fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3"',
  '        style={{ top: "max(56px, calc(env(safe-area-inset-top) + 6px))" }}>',
  '        <div data-apois-trip-top-v6="true" data-apois-trip-single-hud-v1="true"',
  '          className="pointer-events-auto rounded-2xl border border-[#E5E7EB] bg-white/95 px-3 py-2 text-[#111827] shadow-sm">',
  '          <div className="flex min-h-10 items-center justify-between gap-2">',
  '            <div className="min-w-0 flex-1">',
  '              <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#C9141B]">Indo ao destino</p>',
  '              <p data-apois-trip-one-metrics-v1="true" className="mt-0.5 truncate text-[11px] font-semibold tabular-nums text-[#344054]">',
  '                {minutes != null ? String(minutes) + " min" : "ETA —"} {" · "}',
  '                {legKm != null ? legKm.toFixed(1) + " km" : "— km"} {" · "} {arrivalTime ?? "—"}',
  '              </p>',
  '            </div>',
  '            <div className="flex shrink-0 items-center gap-1">',
  '              <button type="button" onClick={onShowRoute} aria-label="Ver rota inteira"',
  '                className="min-h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 text-[12px] font-bold text-[#344054]">',
  '                Ver rota',
  '              </button>',
  '              <button type="button" onClick={onRecenter} aria-label="Acompanhar motorista"',
  '                className="min-h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 text-[12px] font-bold text-[#344054]">',
  '                Seguir',
  '              </button>',
  '            </div>',
  '          </div>',
  '        </div>',
  '      </div>',
  ''
].join("\n");

export function patchCompactHud(source) {
  if (source.includes('data-apois-qa221-trip-hud="true"')) throw Error("[FAIL] QA221 compact HUD duplicate");
  const ps = source.indexOf("function PickupNavOverlay(");
  const pe = ps < 0 ? -1 : source.indexOf("\nfunction CircleAction(", ps);
  if (ps < 0 || pe <= ps) throw Error("[FAIL] QA221 pickup overlay component bounds");
  let pickup=source.slice(ps, pe);
  const pickupAnchor=pickup.indexOf("    <>\n",pickup.indexOf("  return ("));
  const pickupStart=pickupAnchor<0?-1:pickup.indexOf("      <div",pickupAnchor);
  const pickupFooterMark=pickup.indexOf("data-apois-pickup-bottom-v4");
  const pickupFooter=pickupFooterMark<0?-1:pickup.lastIndexOf("      <div",pickupFooterMark);
  if (pickupStart<0||pickupFooter<=pickupStart)throw Error("[FAIL] QA221 pickup top/footer bounds");
  for (const t of ["data-apois-pickup-top-v4", "handleCancel", "handleArrive", "onOpenProfile", "passenger?.phone"]) {
    if (!pickup.includes(t))throw Error("[FAIL] QA221 pickup preserved callback " + t);
  }
  pickup=pickup.slice(0,pickupStart)+pickupTop+pickup.slice(pickupFooter);
  source=source.slice(0,ps)+pickup+source.slice(pe);

  const ts=source.indexOf("function ActiveTripNavOverlay(");
  if (ts<0)throw Error("[FAIL] QA221 trip overlay not found");
  let trip=source.slice(ts);
  const tripAnchor=trip.indexOf("    <>\n", trip.indexOf("  return ("));
  const tripStart=tripAnchor<0?-1:trip.indexOf("      <div",tripAnchor);
  const tripFooterMark=trip.indexOf("data-apois-trip-bottom-v6");
  const tripFooter=tripFooterMark<0?-1:trip.lastIndexOf("      <div",tripFooterMark);
  if(tripStart<0||tripFooter<=tripStart)throw Error("[FAIL] QA221 trip top/footer bounds");
  for (const t of ["onClick={onShowRoute}", "onClick={onRecenter}", "onClick={handleComplete}", "onClick={onOpenProfile}", "data-apois-trip-one-metrics-v1", "data-apois-trip-top-v6"]) {
    if(!trip.includes(t))throw Error("[FAIL] QA221 trip preserved callback " + t);
  }
  trip=trip.slice(0,tripStart)+tripTop+trip.slice(tripFooter);
  source=source.slice(0,ts)+trip;
  for(const t of ["data-apois-qa221-pickup-hud", "data-apois-qa221-trip-hud", "onClick={onShowRoute}", "onClick={onRecenter}", "onClick={handleComplete}", "onClick={handleArrive}", "onClick={handleCancel}", "data-apois-pickup-bottom-v4", "data-apois-trip-bottom-v6"]) {
    if(!source.includes(t))throw Error("[FAIL] QA221 lost flow " + t);
  }
  return source;
}

export function patchHudCss(css) {
  if (css.includes(marker)) throw Error("[FAIL] QA221 CSS duplicate");
  return css + [
    "",
    "/* " + marker + ": neutralize QA195's oversized nested cards in new compact HUD. */",
    "[data-apois-qa221-trip-hud] [data-apois-trip-top-v6] > div,",
    "[data-apois-qa221-pickup-hud] > div {",
    "  max-width: none !important;",
    "  margin: 0 !important;",
    "  border-radius: 0 !important;",
    "  box-shadow: none !important;",
    "}",
    "[data-apois-qa221-trip-hud] [data-apois-trip-top-v6] > div {",
    "  padding: 0 !important;",
    "  background: transparent !important;",
    "}",
    "[data-apois-qa221-pickup-hud] > div {",
    "  padding: 8px 12px !important;",
    "  border-radius: 16px !important;",
    "  background: rgba(255,255,255,.97) !important;",
    "}",
    ""
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const mainPath=resolve(root,"src/routes/motorista.app.tsx");
  const recoveryPath=resolve(root,"src/components/DriverActiveRideRecovery.tsx");
  const cssPath=resolve(root,"src/styles.css");
  const main=patchCompactHud(patchMainMapOwner(readFileSync(mainPath,"utf8")));
  const recovery=patchRecovery(readFileSync(recoveryPath,"utf8"));
  const css=patchHudCss(readFileSync(cssPath,"utf8"));
  // Fail-closed: patch all three in-memory before any output is written.
  writeFileSync(mainPath,main,"utf8");
  writeFileSync(recoveryPath,recovery,"utf8");
  writeFileSync(cssPath,css,"utf8");
  console.log("[OK] QA221 sole primary map owner; recovery never fits active Motorista map; compact pickup/trip HUDs");
}
