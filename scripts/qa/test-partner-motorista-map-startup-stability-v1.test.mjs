import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=path=>readFileSync(resolve(root,path),"utf8");
const map=read("src/components/MovviMap.tsx");
const route=read("src/routes/motorista.app.tsx");
const boundary=read("src/components/routing/DriverMapErrorBoundary.tsx");
test("The driver homepage does not depend on WebGL; vector requested only during active navigation",()=>{
  for(const item of ["navigationMode = false","navigationMode?: boolean","APOIS_DRIVER_MAP_STARTUP_STABILITY_V1",
   'renderingType: isDriverRole && navigationMode && typeof google !== "undefined"',
   "google.maps?.RenderingType?.VECTOR",
   "tiltInteractionEnabled: isDriverRole && navigationMode",
   "headingInteractionEnabled: isDriverRole && navigationMode"]){
    assert.ok(map.includes(item),"Missing "+item);
  }
  assert.ok(!map.includes("renderingType: isDriverRole ? google.maps.RenderingType.VECTOR : undefined"));
  assert.ok(route.includes("navigationMode={inNavigationMode}"));
  assert.ok(route.includes("APOIS_DRIVER_FORWARD_CAMERA_V1"));
});
test("Map rendering failure is contained and never replaces partner operational controls",()=>{
  assert.ok(boundary.includes("getDerivedStateFromError"));
  assert.ok(boundary.includes('data-apois-driver-map-contained-error="true"'));
  assert.ok(boundary.includes("Reabrir mapa"));
  assert.ok(route.includes("<DriverMapErrorBoundary>"));
  assert.ok(route.includes("</DriverMapErrorBoundary>"));
  assert.ok(route.includes("setDesiredOnline"));
  assert.ok(route.includes("tickNavigation"));
  assert.ok(route.includes("active?.status"));
});
test("Blank map tiles are detected but no automatic reload loop occurs",()=>{
 for(const item of ["tilesloaded","setTileTimeout(true)","12000","data-apois-driver-map-tile-timeout",
  "setMapAttempt(n=>n+1)", "tileListenerRef.current?.remove()","window.clearTimeout(tileTimerRef.current)"]){
   assert.ok(map.includes(item),"Missing "+item);
 }
 assert.ok(!map.includes("setInterval(()=>window.location.reload()"));
});
