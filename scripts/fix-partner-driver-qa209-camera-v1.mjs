// APOIS_DRIVER_QA209_CAMERA_V1 — QA208 video: shaky orientation & violent pan.
// Disposable Motorista workspace ONLY. No source-lock, Entregador, Maps ID,
// billing, Supabase, security, payments, auth or Android signing changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(file,"utf8");
const marker="APOIS_DRIVER_QA209_CAMERA_V1";
if(s.includes(marker))throw Error("[FAIL] QA209 camera duplicate");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] QA209 camera "+label+" count="+n);s=s.replace(a,b);}
once("const NAVIGATION_ZOOM = 16;","const NAVIGATION_ZOOM = 17;","zoom");
once("const NAVIGATION_CENTER_AHEAD_METERS = 175;","const NAVIGATION_CENTER_AHEAD_METERS = 52;","forward-offset");
const a=s.indexOf("function applyNavigationCamera("),b=s.indexOf("type RequestRemovalReason",a);
if(a<0||b<a)throw Error("[FAIL] QA209 camera helper bounds");
const original=s.slice(a,b);
for(const required of ["nearDestination","navMap.setHeading?.(heading)","routeHeadingFrom(position, route, destination)"])
 if(!original.includes(required))throw Error("[FAIL] QA209 camera prerequisite "+required);
const lines=[
 "// "+marker+": one stable, map-instance-scoped navigator.",
 "const driverCameraHistory = new WeakMap<google.maps.Map, {origin: LatLng; heading: number | null; at: number}>();",
 "function applyNavigationCamera(",
 "  map: google.maps.Map,",
 "  position: LatLng & {heading?: number | null},",
 "  route: LatLng[],",
 "  destination?: LatLng | null,",
 "  immediate = false,",
 ") {",
 "  const now=Date.now();",
 "  const previous=driverCameraHistory.get(map);",
 "  const movedMeters=previous ? haversineKm(previous.origin,position)*1000 : Number.POSITIVE_INFINITY;",
 "  // WebView jitter is not travel. Never rotate/pan while stationary.",
 "  if (!immediate && previous && (movedMeters < 12 || now-previous.at < 1800)) return;",
 "  if (!immediate && previous && movedMeters > 700 && now-previous.at < 4000) return;",
 "  const nearDestination=destination != null && haversineKm(position,destination)*1000 < 75;",
 "  const routeBearing=routeHeadingFrom(position,route,destination);",
 "  const movementBearing=previous && movedMeters >= 12 ? bearingBetween(previous.origin,position) : null;",
 "  const requestedHeading=nearDestination ? null : routeBearing ?? movementBearing ?? navigationHeadingFor(position,route,destination);",
 "  let heading=requestedHeading ?? previous?.heading ?? null;",
 "  if (previous?.heading != null && heading != null) {",
 "    const delta=((heading-previous.heading+540)%360)-180;",
 "    const limit=immediate && movedMeters >= 20 ? 42 : 22;",
 "    heading=normalizeHeading(previous.heading+Math.max(-limit,Math.min(limit,delta)));",
 "  }",
 "  if (nearDestination && previous?.heading != null) heading=previous.heading;",
 "  const center=heading == null || nearDestination ? {lat:position.lat,lng:position.lng}",
 "    : offsetLatLng(position,heading,NAVIGATION_CENTER_AHEAD_METERS);",
 "  const vector=map.getRenderingType?.() === google.maps.RenderingType.VECTOR;",
 "  const navMap=map as google.maps.Map & {moveCamera?: (options:google.maps.CameraOptions)=>void};",
 "  try {",
 "    if (vector && typeof navMap.moveCamera === 'function') {",
 "      navMap.moveCamera({center,zoom:NAVIGATION_ZOOM,heading:heading ?? 0,tilt:nearDestination ? 0 : 25});",
 "    } else {",
 "      // North-up raster fallback: never request unsupported heading/tilt.",
 "      if(immediate || movedMeters >= 12)map.panTo(center);",
 "      if((map.getZoom()??0)<16 || (map.getZoom()??0)>18)map.setZoom(NAVIGATION_ZOOM);",
 "    }",
 "    driverCameraHistory.set(map,{origin:{lat:position.lat,lng:position.lng},heading,at:now});",
 "  } catch { map.panTo({lat:position.lat,lng:position.lng}); }",
 "}",
 ""
].join("\n");
s=s.slice(0,a)+lines+s.slice(b);
once("          onLoad={(m) => {\n            mapRef.current = m;",
     "          onLoad={(m) => {\n            if (mapRef.current === m) return;\n            mapRef.current = m;",
     "don't reinitialize same map instance");
const ra=s.indexOf("  // Rota da corrida ativa."),rb=s.indexOf("  // Voz de navegação",ra);
if(ra<0||rb<ra)throw Error("[FAIL] QA209 route effect boundaries");
let route=s.slice(ra,rb);
const timer=/\n\s*\/\/ APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1: settle route geometry first\.\n\s*window\.setTimeout\(\(\) => \{[\s\S]*?\n\s*\}, 220\);/g;
const n=[...route.matchAll(timer)].length;
if(n!==1)throw Error("[FAIL] QA209 duplicate follow timer="+n);
route=route.replace(timer,"");
const positionMarker="    const pos = position;";
if(route.split(positionMarker).length!==2)throw Error("[FAIL] QA209 pickup-arrival guard anchor");
route=route.replace(positionMarker,[
 '    // Already at pickup: do not fit or route to the same point again.',
 '    if (active.status === "motorista_chegou") {',
 '      routeRequestEpochRef.current += 1; routeRefreshRef.current = null;',
 '      setPolyline([]); setRouteSteps([]); setEtaSeconds(null); setLegKm(null);',
 '      lastFitKeyRef.current = null; lastRouteRequestKeyRef.current = null;',
 '      return;',
 '    }',
 positionMarker
].join("\n"));
s=s.slice(0,ra)+route+s.slice(rb);
if(!s.includes("APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1")||!s.includes("onStart(pinCode)")||!s.includes("DriverMapErrorBoundary"))throw Error("[FAIL] QA209 existing route/PIN contracts lost");
writeFileSync(file,s,"utf8");
console.log("[OK] QA209 camera: movement threshold, bounded heading, single moveCamera, no 220ms bounce, safe pickup arrival.");
