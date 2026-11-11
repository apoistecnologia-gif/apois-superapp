import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=p=>readFileSync(resolve(root,p),"utf8");
const route=read("src/routes/motorista.app.tsx");
const map=read("src/components/MovviMap.tsx");
test("One stable raster map stays mounted in idle, pickup and active ride",()=>{
 assert.ok(map.includes("APOIS_DRIVER_RIDE_MAP_STABILITY_V2"));
 assert.ok(map.includes("renderingType: undefined,"));
 assert.ok(map.includes("tiltInteractionEnabled: false"));
 assert.ok(!map.includes("google.maps?.RenderingType?.VECTOR"));
 assert.ok(map.includes("tilesloaded"));
 assert.ok(route.includes("<DriverMapErrorBoundary>"));
 assert.ok(route.includes("<MovviMap"));
 assert.ok(route.includes("navigationMode={inNavigationMode}"));
});
test("Route request survives GPS jitter and retries if interrupted by map remount",()=>{
 assert.ok(route.includes("APOIS_DRIVER_RIDE_MAP_STABILITY_V2"));
 assert.ok(route.includes("position.lat.toFixed(3)"));
 assert.ok(route.includes("position.lng.toFixed(3)"));
 assert.ok(!route.includes("position?.lat, position?.lng, mapReadyNonce]"));
 assert.ok(route.includes("let settled = false"));
 assert.ok(route.includes("settled = true;"));
 assert.ok(route.includes("if (!settled && lastRouteRequestKeyRef.current === routeRequestKey)"));
 assert.ok(route.includes("lastRouteRequestKeyRef.current = null;"));
 assert.ok(route.includes("lastRouteRequestKeyRef.current = routeRequestKey;"));
});
test("Fallbacks do not bypass real route, voice, payments or ride lifecycle",()=>{
 for(const marker of [
   "callRoute({ data: { origin: pos, destination: dest } })",
   "decodePolyline(res.encodedPolyline)",
   "setRouteSteps(", "setPolyline(points);",
   "setLegKm(res.distanceMeters / 1000)",
   "tickNavigation", "autoFollowRef.current",
   "focusRoute(points);",
   "const fallback = [pos, dest];",
   "toast.message",
   "onAccept={handleAccept}","onReject={handleReject}",
   "navigationMode={inNavigationMode}",
   "Finalizar corrida"
 ])assert.ok(route.includes(marker),"Lost existing ride operation: "+marker);
});
