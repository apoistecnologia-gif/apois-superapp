// QA220 — physical Android video 1001992839.mp4.
// Correct only the disposable Motorista's map rendering, manual preview and PIN legibility.
// Keep Supabase, PIN validation, GPS publication, Routes, money and all other apps unchanged.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const marker = "APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1";

function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error("[FAIL] QA220 " + label + ": expected one anchor, got " + count);
  return source.replace(before, after);
}

export function patchAndroidMap(source) {
  if (source.includes(marker)) throw new Error("[FAIL] QA220 map applied twice");
  for (const token of [
    "APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1",
    "APOIS_DRIVER_VIDEO_20261112_ROTATION_V1",
    "options={stableMapOptions}",
    "styles: useCloudVector ? undefined : styles",
    "mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined"
  ]) if (!source.includes(token)) throw new Error("[FAIL] QA220 map prerequisite: " + token);

  source = once(source,
    '  const isDriverRole = APP_ROLE === "driver";',
    '  const isDriverRole = APP_ROLE === "driver";\n' +
    '  // ' + marker + ': Android WebView currently shows distorted vector buildings.\n' +
    '  // Use the same official raster palette; no runtime map remount or cloud billing change.\n' +
    '  const stableAndroidMap = isDriverRole && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);',
    "Android-only raster selector"
  );

  source = once(source,
    '  const useCloudVector = isDriverRole && cloudVectorConfig !== null;',
    '  const useCloudVector = isDriverRole && cloudVectorConfig !== null && !stableAndroidMap;',
    "disable unstable Android WebView vector rendering"
  );
  source = once(source,
    '  const styles = useMemo(() => isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme), [isDriverRole,theme]);',
    [
      '  const styles = useMemo<google.maps.MapTypeStyle[]>(() => {',
      '    const base = isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme);',
      '    if (!stableAndroidMap) return base;',
      '    // Hide only man-made building polygons; roads, labels, parks, water and route overlays stay.',
      '    return [...base, { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ visibility: "off" }] }];',
      '  }, [theme, stableAndroidMap]);'
    ].join("\n"),
    "remove white building polygons in Android raster"
  );
  for (const protectedToken of ["getMapStyleForTheme(theme)", "google.maps.RenderingType.RASTER", "onUnmount={handleUnmount}", "options={stableMapOptions}"]) {
    if (!source.includes(protectedToken)) throw new Error("[FAIL] QA220 map lost " + protectedToken);
  }
  return source;
}

export function patchDriverCamera(source) {
  if (source.includes(marker)) throw new Error("[FAIL] QA220 camera applied twice");
  for (const t of ["APOIS_DRIVER_QA209_CAMERA_V1", "APOIS_DRIVER_VIDEO_20261112_ROTATION_V1", "routeOverviewEpochRef", "onClick={onShowRoute}", "onClick={onRecenter}", "autoFollowRef.current=false;"]) {
    if (!source.includes(t)) throw new Error("[FAIL] QA220 camera prerequisite " + t);
  }
  // In raster, a forward-offset center based on changing bearings makes the map appear
  // to jump. Use the driver's real GPS point, leaving route overlays/vehicle bearing intact.
  source = once(source,
    '      if(immediate || movedMeters >= 12)map.panTo(center);',
    '      // ' + marker + ': north-up 2D follows the real GPS point, not a rotating offset.\n' +
    '      if (immediate || movedMeters >= 12) map.panTo({lat: position.lat, lng: position.lng});',
    "stable raster camera"
  );

  // QA190 made "Ver rota" snap back without a tap after 7 seconds. Keep this
  // deliberate preview until "Seguir", recenter, or a genuine new ride phase.
  const previewTimer = [
    '            const epoch=++routeOverviewEpochRef.current;',
    '            window.setTimeout(() => {',
    '              if(routeOverviewEpochRef.current!==epoch || mapRef.current!==m) return;',
    '              if(activeRef.current?.id!==active.id || activeRef.current?.status!=="em_viagem") return;',
    '              autoFollowRef.current=true;',
    '              const latest=positionRef.current;',
    '              if(latest) applyNavigationCamera(m,latest,polyline,activeNavigationDestination,true);',
    '            }, 7000);'
  ].join("\n");
  source = once(source, previewTimer,
    '            // ' + marker + ': only a user action ("Seguir") or genuine phase change can leave route preview.\n' +
    '            routeOverviewEpochRef.current += 1;',
    "no surprise return from route overview"
  );
  if (source.includes('}, 7000);')) throw new Error("[FAIL] QA220 auto return timer still present");
  for (const preserved of ["m.fitBounds(b,{top:155,right:32,bottom:220,left:32});", "function recenter()", "if (!position || !mapRef.current || !autoFollowRef.current) return;", "onStart(pinCode)", "onClick={handleComplete}", "onClick={onAccept}", "onClick={onReject}"]) {
    if (!source.includes(preserved)) throw new Error("[FAIL] QA220 camera changed protected flow: " + preserved);
  }
  return source;
}

export function patchPinDigits(source) {
  if (source.includes('data-apois-qa220-pin-digit-v1="true"')) throw new Error("[FAIL] QA220 PIN applied twice");
  const begin=source.indexOf("function ActiveRidePanel(");
  const end=begin < 0 ? -1 : source.indexOf("\nfunction ActionButton(", begin);
  if (begin < 0 || end <= begin) throw new Error("[FAIL] QA220 real PIN panel not found");
  let panel=source.slice(begin,end);
  for (const tok of ["APOIS_DRIVER_QA209_REAL_PIN_V1", 'value={pinCode[position] ?? ""}', "onStart(pinCode)", 'pinDigitRefs.current[position]', 'text-[#111827]']) {
    if (!panel.includes(tok)) throw new Error("[FAIL] QA220 real PIN prerequisite: " + tok);
  }
  panel=once(panel,
    '                        type="text"\n                        inputMode="numeric"',
    '                        type="text"\n' +
    '                        data-apois-qa220-pin-digit-v1="true"\n' +
    '                        style={{ color: "#111827", WebkitTextFillColor: "#111827" }}\n' +
    '                        inputMode="numeric"',
    "dark PIN digits in the four actual Android inputs"
  );
  if (!panel.includes("data-apois-qa220-pin-digit-v1")) throw new Error("[FAIL] QA220 PIN styling marker missing");
  return source.slice(0,begin)+panel+source.slice(end);
}

export function patchPinCss(css) {
  if (css.includes(marker)) throw new Error("[FAIL] QA220 PIN CSS already applied");
  return css + [
    "",
    "/* " + marker + ": Android WebView renders light text despite text-[#111827]. */",
    "input[data-apois-qa220-pin-digit-v1=\"true\"] {",
    "  color: #111827 !important;",
    "  -webkit-text-fill-color: #111827 !important;",
    "  background-color: #FFFFFF !important;",
    "  opacity: 1 !important;",
    "  text-shadow: none !important;",
    "}",
    "input[data-apois-qa220-pin-digit-v1=\"true\"]:focus {",
    "  color: #111827 !important;",
    "  -webkit-text-fill-color: #111827 !important;",
    "  background-color: #FFF1F2 !important;",
    "}",
    ""
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const mapPath=resolve(root, "src/components/MovviMap.tsx");
  const routePath=resolve(root, "src/routes/motorista.app.tsx");
  const cssPath=resolve(root, "src/styles.css");
  // Compute all changes before writing, so an anchor mismatch cannot leave a partial transform.
  const map=patchAndroidMap(readFileSync(mapPath,"utf8"));
  const route=patchPinDigits(patchDriverCamera(readFileSync(routePath,"utf8")));
  const css=patchPinCss(readFileSync(cssPath,"utf8"));
  writeFileSync(mapPath,map,"utf8");
  writeFileSync(routePath,route,"utf8");
  writeFileSync(cssPath,css,"utf8");
  console.log("[OK] QA220 Android Motorista: stable 2D map, no automatic route-preview snap, high-contrast PIN digits");
}
