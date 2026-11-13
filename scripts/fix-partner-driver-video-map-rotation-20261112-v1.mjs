// APOIS_DRIVER_VIDEO_20261112_ROTATION_V1
// Video 1001992704.mp4: buildings are map geometry, while north-up navigation
// can result from an unnecessary WebGL gate or stale camera history across phases.
// Edits only generated Motorista workspace, after QA202/QA209/PDF patches.
// No Map ID/key, cloud styling, GCP, Supabase, route, GPS or ride action edits.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const mapPath=resolve(root,"src/components/MovviMap.tsx");
const routePath=resolve(root,"src/routes/motorista.app.tsx");
let map=readFileSync(mapPath,"utf8");
let route=readFileSync(routePath,"utf8");
const marker="APOIS_DRIVER_VIDEO_20261112_ROTATION_V1";
if(map.includes(marker)||route.includes(marker))throw Error("[FAIL] Video rotation patch already applied");
function one(source,from,to,label){
 const n=source.split(from).length-1;
 if(n!==1)throw Error("[FAIL] Driver video rotation "+label+" anchors="+n);
 return source.replace(from,to);
}
for(const must of ["APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1","options={stableMapOptions}"]){
 if(!map.includes(must))throw Error("[FAIL] Missing Map ID baseline "+must);
}
for(const must of ["APOIS_DRIVER_QA209_CAMERA_V1","APOIS_DRIVER_PDF_20261112_V1","driverCameraHistory","navigationModeKeyRef.current = navKey;"]){
 if(!route.includes(must))throw Error("[FAIL] Missing camera baseline "+must);
}

// Google Maps JavaScript API decides actual WebGL support and safely falls
// back to raster itself. The extra canvas probe can reject capable devices
// before the Maps engine has even initialized; this prevents any rotation.
const cfgStart=map.indexOf('  const [cloudVectorConfig] = useState(() => {');
const cfgEnd=cfgStart<0?-1:map.indexOf('  const useCloudVector = isDriverRole && cloudVectorConfig !== null;',cfgStart);
if(cfgStart<0||cfgEnd<=cfgStart)throw Error("[FAIL] Google vector gate boundaries");
const oldConfig=map.slice(cfgStart,cfgEnd);
for(const expected of ['VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED','VITE_APOIS_PARTNER_VECTOR_MAP_ID','canvas.getContext("webgl2"','WEBGL_lose_context']){
 if(!oldConfig.includes(expected))throw Error("[FAIL] Unexpected vector gate "+expected);
}
const config=[
  '  // '+marker+': delegate hardware/driver support to Google Maps runtime.',
  '  // Do not allocate/lose a throwaway WebGL context before map initialization.',
  '  const [cloudVectorConfig] = useState(() => {',
  '    if (!isDriverRole || import.meta.env.VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED !== "true") return null;',
  '    const mapId = String(import.meta.env.VITE_APOIS_PARTNER_VECTOR_MAP_ID ?? "").trim();',
  '    if (!/^[0-9a-f]{16,32}$/i.test(mapId)) return null;',
  '    return { mapId };',
  '  });',
  ''
].join("\n");
map=map.slice(0,cfgStart)+config+map.slice(cfgEnd);
if(map.includes("WEBGL_lose_context")||map.includes('canvas.getContext("webgl2"'))throw Error("[FAIL] Old premature GPU test retained");

// QA219: Google Cloud Map ID cannot receive inline JSON styling at initial load.
map=one(map,
  "      map.setOptions({ styles, backgroundColor: bgColor });",
  '      // QA219: no local styles when a cloud Map ID is selected.\n      if (!useCloudVector) map.setOptions({ styles, backgroundColor: bgColor });',
  "initial cloud-style guard");
// The onLoad callback now closes over the cloud-style selection: keep the
// dependency complete to avoid stale callback state on an explicit retry.
map=one(map,
  "    [onLoad, styles, bgColor, theme],",
  "    [onLoad, styles, bgColor, theme, useCloudVector],",
  "onLoad style-gate dependencies");

// Prefer the course from real GPS movement over route geometry. While stopped,
// retain the route bearing; never follow compass noise just because the
// phone was turned in its holder. This keeps QA209 jitter limits intact.
const oldHeading=[
 '  const routeBearing=routeHeadingFrom(position,route,destination);',
 '  const movementBearing=previous && movedMeters >= 12 ? bearingBetween(previous.origin,position) : null;',
 '  const requestedHeading=nearDestination ? null : routeBearing ?? movementBearing ?? navigationHeadingFor(position,route,destination);'
].join("\n");
const newHeading=[
 '  // '+marker+': GPS travel direction wins only after meaningful movement.',
 '  const routeBearing=routeHeadingFrom(position,route,destination);',
 '  const movementBearing=previous && movedMeters >= 12 ? bearingBetween(previous.origin,position) : null;',
 '  const gpsCourse=normalizeHeading(position.heading);',
 '  const movingCourse=movementBearing != null ? (gpsCourse ?? movementBearing) : null;',
 '  const requestedHeading=nearDestination',
 '    ? (previous?.heading ?? gpsCourse ?? routeBearing)',
 '    : (movingCourse ?? routeBearing ?? gpsCourse);'
].join("\n");
route=one(route,oldHeading,newHeading,"movement vs route course");

// Previously, a status switch at the same GPS position was capped to 22
// degrees relative to the preceding phase. A new ride phase gets a fresh,
// accurately oriented camera. Normal follow remains rate-limited/smoothed.
route=one(route,
 '    navigationModeKeyRef.current = navKey;\n    autoFollowRef.current = true;',
 '    navigationModeKeyRef.current = navKey;\n    // New pickup/destination phase must not inherit the old camera bearing.\n    driverCameraHistory.delete(map);\n    autoFollowRef.current = true;',
 "reset heading on phase transition"
);

// Transparent runtime diagnostic for a future physical QA: only emits a
// warning once if Google reports a true raster fallback. No map remounts.
route=one(route,
 'const driverCameraHistory = new WeakMap<google.maps.Map, {origin: LatLng; heading: number | null; at: number}>();',
 'const driverCameraHistory = new WeakMap<google.maps.Map, {origin: LatLng; heading: number | null; at: number}>();\nconst driverRasterWarningHistory = new WeakSet<google.maps.Map>();',
 "once-per-map fallback diagnostics");
route=one(route,
 '  const vector=map.getRenderingType?.() === google.maps.RenderingType.VECTOR;',
 [
  '  const actualRenderer=map.getRenderingType?.();',
  '  const vector=actualRenderer === google.maps.RenderingType.VECTOR;',
  '  if (actualRenderer === google.maps.RenderingType.RASTER && !driverRasterWarningHistory.has(map)) {',
  '    driverRasterWarningHistory.add(map);',
  '    console.warn("[APOIS Motorista] Google Maps em modo raster; o mapa de ruas permanece voltado para o norte porque a rotacao exige modo vetorial.");',
  '  }'
 ].join("\n"),
 "honest fallback visibility"
);

for(const must of [
 "APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1",
 'VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED !== "true"',
 'mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined',
 'google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER',
 'styles: useCloudVector ? undefined : styles'
])if(!map.includes(must))throw Error("[FAIL] Map protections lost: "+must);
for(const must of [
 'if (!immediate && previous && (movedMeters < 12 || now-previous.at < 1800)) return;',
 'if (!immediate && previous && movedMeters > 700',
 'driverCameraHistory.delete(map);',
 'const movingCourse=movementBearing != null ? (gpsCourse ?? movementBearing) : null;',
 'if (vector && typeof navMap.moveCamera',
 'onClick={onShowRoute}',
 'onClick={onRecenter}',
 'onStart(pinCode)',
 'onClick={onAccept}',
 'onClick={onReject}',
 'onClick={handleComplete}',
 'data-apois-waiting-summary-v1',
])if(!route.includes(must))throw Error("[FAIL] Driver protected callback/state lost "+must);

writeFileSync(mapPath,map,"utf8");
writeFileSync(routePath,route,"utf8");
console.log("[OK] Motorista video: Google decides vector support, real course heading prioritized, phase camera reset, honest raster diagnostic. No APK.");
