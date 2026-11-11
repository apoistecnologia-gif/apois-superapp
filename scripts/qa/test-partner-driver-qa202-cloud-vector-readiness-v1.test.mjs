import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const map=readFileSync(resolve(root,"src/components/MovviMap.tsx"),"utf8");
const colors=readFileSync(resolve(process.cwd(),"docs/google-maps/apois-passageiro-vector-style-import.json"),"utf8");
test("QA202 real camera only when approved APOIS Cloud style and JavaScript Map ID exist",()=>{
 for(const x of [
  "APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1",
  'VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED !== "true"',
  "VITE_APOIS_PARTNER_VECTOR_MAP_ID",
  "/^[0-9a-f]{16,32}$/i",
  'canvas.getContext("webgl2"',
  'canvas.getContext("webgl"',
  "mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined",
  "google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER"
 ])assert.ok(map.includes(x),x);
});
test("QA202 never mixes cloud Map ID and JSON styling or switches mid-ride",()=>{
 for(const x of [
  "styles: useCloudVector ? undefined : styles",
  "if (useCloudVector) return",
  "options={stableMapOptions}",
  "useState(() => {",
  "[isLoaded, isDriverRole, useCloudVector, cloudVectorConfig, styles, bgColor]"
 ])assert.ok(map.includes(x),x);
 assert.ok(!map.includes("options={{"));
 assert.ok(!map.includes("setForceRasterAfterFailure"));
});
test("QA202 baseline Passenger map appearance and Cloud JSON palette match",()=>{
 for(const x of ['getMapStyleForTheme("light")','getMapBackgroundForTheme("light")',"google.maps.RenderingType.RASTER"])assert.ok(map.includes(x),x);
 const rules=JSON.parse(colors);
 assert.ok(Array.isArray(rules)&&rules.length>=20);
 for(const [feature,color] of [["water","#0B2944"],["road.local","#FBFAF6"],["road.highway","#E4C4B4"]]){
  assert.ok(rules.some(r=>r.featureType===feature&&r.elementType==="geometry"&&r.stylers?.some(s=>s.color===color)),feature);
 }
});
