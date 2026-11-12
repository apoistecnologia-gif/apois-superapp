// APOIS Entregador: offline UI-only checks for the courier-exclusive Google Map ID.
// These tests read only the disposable workspace. No network, APK, secrets, or writes.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const path=resolve(root,"src/components/CourierRouteMap.tsx");
const src=readFileSync(path,"utf8");
const start=src.indexOf("export function CourierLiveMap(");
const next=src.indexOf("export function CourierRouteMap(",start);
assert.ok(start>=0 && next>start,"Courier maps remain separate");
const home=src.slice(start,next),route=src.slice(next);
const builder=readFileSync("scripts/build-partner-release.sh","utf8");
const exclusive="1af3628136c58ef8d1029763";
const shared="1af3628136c58ef8a23052b5";
const driver="1af3628136c58ef870ba9d1a";

test("Entregador cloud Map ID uses published courier-only identifier, not Cliente or Motorista",()=>{
 assert.ok(builder.includes('export VITE_GOOGLE_MAPS_MAP_ID="'+exclusive+'"'));
 assert.ok(!src.includes(shared) && !src.includes(driver));
 assert.ok(!src.includes("1814fa226b935f46e15c11a8"));
 assert.ok(builder.includes("forbid_bundle '"+shared+"' .output/public"));
 assert.ok(builder.includes("forbid_bundle '"+driver+"' .output/public"));
});
test("Home map uses cloud light style with original inline palette fallback and unchanged markers",()=>{
 for(const token of [
  "APOIS_COURIER_EXCLUSIVE_VECTOR_MAP_20261112_V1",
  "const useCourierCloudMap = /^[0-9a-f]{16,32}$/i.test(courierCloudMapId);",
  "mapId={useCourierCloudMap ? courierCloudMapId : undefined}",
  "colorScheme={ColorScheme.LIGHT}",
  "styles={useCourierCloudMap ? undefined : APOIS_COURIER_MAP_STYLE}",
  "<CourierStyledLiveMarkers position={mapPosition} merchants={nearbyMerchants} />",
  "<RecenterControl position=",
  "backgroundColor=\"#EDEAE4\"",
  "clickableIcons={false}",
 ])assert.ok(home.includes(token),token);
 assert.ok(!home.includes("styles={APOIS_COURIER_MAP_STYLE}"));
});
test("Live delivery route uses same exclusive Map ID, preserving GPS, route, stage and NAVEGAR",()=>{
 for(const token of [
  "APOIS_COURIER_EXCLUSIVE_VECTOR_MAP_20261112_V1",
  'const mapId = /^[0-9a-f]{16,32}$/i.test(mapIdValue) ? mapIdValue : "";',
  "mapId={mapId}",
  "colorScheme={ColorScheme.LIGHT}",
  "<RouteMapContent",
  "onMetrics={setMetrics}",
  "onClick={openNavigation}",
  "APOIS_COURIER_MAPS_URL_NO_API_KEY_V1",
  'paid routing disabled in homologation',
 ])assert.ok(route.includes(token),token);
 assert.ok(route.includes("job.id"));
 assert.ok(route.includes("goingToDelivery"));
 assert.ok(!route.includes('const mapId = ((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID") as string;'));
});
test("No existing API key, payments, GPS or dispatch dependency rewritten by this visual patch",()=>{
 const patch=readFileSync("scripts/fix-partner-courier-exclusive-vector-style-20261112-v1.mjs","utf8");
 for(const token of [
  "src/components/CourierRouteMap.tsx",
  "const startHome=original.indexOf",
  'const startRoute=original.indexOf',
  'const updated=original.slice(0,startHome)+home+route;',
 ])assert.ok(patch.includes(token),token);
 for(const danger of ["supabase/functions","src/routes/courier.tsx","google.maps.importLibrary","onStart(pinCode)"])
  assert.ok(!patch.includes("writeFileSync("+danger),danger);
});
