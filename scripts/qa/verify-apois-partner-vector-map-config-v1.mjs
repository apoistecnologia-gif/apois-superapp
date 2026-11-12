// APOIS_PARCEIRO_VECTOR_MAP_QA206
// Build-time guard: Google Cloud published map ID is included ONLY in Motorista.
// A Map ID is public configuration, NEVER an API key or billing credential.
// Fail closed if Vite did not embed the intended vector style config.
import assert from "node:assert/strict";
import {readFileSync,readdirSync,statSync,existsSync} from "node:fs";
import {resolve,join} from "node:path";

const id=String(process.env.VITE_APOIS_PARTNER_VECTOR_MAP_ID??"").trim();
const approved=process.env.VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED==="true";
if(!approved) {
  console.log("[OK] QA206 vector map disabled by explicit CI flag (raster fallback preserved).");
  process.exit(0);
}
assert.match(id,/^[a-f0-9]{16,32}$/i,"Map ID must be public hexadecimal Google Maps ID");
const root=resolve(process.cwd(),"superapp/partner-shell/dist/modules");
function allJs(dir) {
  assert.ok(existsSync(dir),"Missing compiled module: "+dir);
  const out=[];
  for(const name of readdirSync(dir)){
    const file=join(dir,name);
    if(statSync(file).isDirectory())out.push(...allJs(file));
    else if(file.endsWith(".js"))out.push(file);
  }
  return out;
}
const driverFiles=allJs(resolve(root,"motorista"));
assert.ok(driverFiles.some(p=>readFileSync(p,"utf8").includes(id)),"Motorista bundle did not embed Google Map ID");
const courierFiles=allJs(resolve(root,"entregador"));
assert.ok(!courierFiles.some(p=>readFileSync(p,"utf8").includes(id)),"Map ID must not enter Entregador bundle");
const src=readFileSync(resolve(process.cwd(),".work/partner-motorista/src/components/MovviMap.tsx"),"utf8");
for(const snippet of [
  "APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1",
  "mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined",
  "google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER",
  "styles: useCloudVector ? undefined : styles",
  "options={stableMapOptions}"
])assert.ok(src.includes(snippet),"Missing safe vector map gate: "+snippet);
console.log("[OK] QA206: compiled Motorista contains official APOIS vector Map ID; Entregador unchanged; no inline/cloud style conflict.");
