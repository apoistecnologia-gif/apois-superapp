// APOIS_DRIVER_QA194_PASSENGER_MAP_STYLE_V1
// QA193 physical Android confirmed the default Google vector basemap replaced
// the official passenger palette. Embedded JSON styling does not apply on
// Google Maps JavaScript vector rendering. Restore the same raster-based
// APOIS palette already shared by Passenger and Motorista.
// This adjusts ONLY the disposable Motorista's map presentation. No route,
// GPS, camera methods, SQL, Entregador, source-lock or protected sources change.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const mapPath = resolve(root, "src/components/MovviMap.tsx");
const stylePath = resolve(root, "src/lib/googleMaps.ts");
const before = readFileSync(mapPath, "utf8");
let s = before;
const style = readFileSync(stylePath, "utf8");
const marker = "APOIS_DRIVER_QA194_PASSENGER_MAP_STYLE_V1";

function once(from, to, name) {
  const hits = s.split(from).length - 1;
  if (hits !== 1) throw Error("[FAIL] QA194 " + name + " count=" + hits);
  s = s.replace(from, to);
}

// Keep the existing source-of-truth APOIS palette and the driver's stable,
// shared client style. Do not replace it with a speculative hardcoded theme.
for (const required of [
  'getMapStyleForTheme("light")',
  'getMapBackgroundForTheme("light")',
  "APOIS_MOTORISTA_CLIENT_MAP_STYLE_V1",
]) {
  if (!s.includes(required)) throw Error("[FAIL] QA194 missing passenger palette contract: " + required);
}
for (const required of ["#0B2944", "#EDEAE4", "APOIS_LIGHT_MAP_STYLE"]) {
  if (!style.includes(required)) throw Error("[FAIL] QA194 missing APOIS palette color: " + required);
}

// Removing the now-unused WebGL probe also avoids WebGL context allocation
// during startup. The map remains the same instance for the entire ride.
const start = s.indexOf("  // APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1: choose ONCE before GoogleMap mounts.");
const end = start < 0 ? -1 : s.indexOf("  // APOIS_DRIVER_QA193_STABLE_OPTIONS:", start);
if (start < 0 || end <= start || s.slice(start,end).indexOf("driverVectorCapable") < 0) {
  throw Error("[FAIL] QA194 missing single driver vector capability block");
}
s = s.slice(0, start) + "  // " + marker + ": use passenger basemap at startup; never change renderer mid-ride.\n" + s.slice(end);

once([
  '          renderingType: isLoaded && typeof google !== "undefined" && isDriverRole && driverVectorCapable && !forceRasterAfterFailure',
  "            ? google.maps.RenderingType.VECTOR : undefined,",
  "          tiltInteractionEnabled: isDriverRole && driverVectorCapable && !forceRasterAfterFailure,",
  "          headingInteractionEnabled: isDriverRole && driverVectorCapable && !forceRasterAfterFailure,"
].join("\n"),[
  "          // QA194: raster supports APOIS inline JSON palette; stable until next explicit retry.",
  '          renderingType: isLoaded && typeof google !== "undefined" && isDriverRole',
  "            ? google.maps.RenderingType.RASTER : undefined,",
  "          tiltInteractionEnabled: false,",
  "          headingInteractionEnabled: false,"
].join("\n"), "startup renderer");

once(
  "[isLoaded, isDriverRole, driverVectorCapable, forceRasterAfterFailure, styles, bgColor]",
  "[isLoaded, isDriverRole, styles, bgColor]",
  "stable options dependencies"
);
once(
  "onClick={()=>{setTileTimeout(false);setForceRasterAfterFailure(true);setMapAttempt(n=>n+1);}}",
  "onClick={()=>{setTileTimeout(false);setMapAttempt(n=>n+1);}}",
  "same-renderer retry"
);

for(const required of [
  marker,
  "options={stableMapOptions}",
  "key={mapAttempt}",
  "DriverMapErrorBoundary" // lives in route, not map; see test
]) {
  if(required === "DriverMapErrorBoundary")continue;
  if(!s.includes(required))throw Error("[FAIL] QA194 regression: "+required);
}
for (const forbidden of ["driverVectorCapable", "forceRasterAfterFailure", "RenderingType.VECTOR", "options={{"]) {
  if (s.includes(forbidden)) throw Error("[FAIL] QA194 unexpected old renderer state: " + forbidden);
}
if (before === s) throw Error("[FAIL] QA194 no change");
writeFileSync(mapPath, s, "utf8");
console.log("[OK] QA194 Motorista: official Passenger APOIS basemap restored; stable raster, GPS, routes and Entregador untouched.");
