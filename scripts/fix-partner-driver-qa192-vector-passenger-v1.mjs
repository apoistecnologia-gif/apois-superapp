// APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1: disposable Motorista workspace only.
// A Google map cannot switch its renderer after initialization. Keep vector
// selected once at startup on WebGL-capable hardware; raster otherwise, and
// downgrade ONLY after the driver explicitly retries failed map tiles.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/components/MovviMap.tsx");
let s=readFileSync(path,"utf8");
if(s.includes("APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1"))
 throw Error("[FAIL] QA192 duplicate transform");
function one(old,now,label){
 const count=s.split(old).length-1;
 if(count!==1)throw Error("[FAIL] QA192 "+label+" anchors="+count);
 s=s.replace(old,now);
}
one("  const [mapAttempt, setMapAttempt] = useState(0);",
[
"  const [mapAttempt, setMapAttempt] = useState(0);",
"  // APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1: choose ONCE before GoogleMap mounts.",
"  // QA179 broke because changing raster→vector in a live ride remounted Maps.",
"  const [driverVectorCapable] = useState(() => {",
"    if (!isDriverRole || typeof document === \"undefined\") return false;",
"    try {",
"      const canvas = document.createElement(\"canvas\");",
"      const ctx = canvas.getContext(\"webgl2\", { failIfMajorPerformanceCaveat: true })",
"        ?? canvas.getContext(\"webgl\", { failIfMajorPerformanceCaveat: true });",
"      if (!ctx) return false;",
"      ctx.getExtension(\"WEBGL_lose_context\")?.loseContext();",
"      return true;",
"    } catch { return false; }",
"  });",
"  const [forceRasterAfterFailure, setForceRasterAfterFailure] = useState(false);"
].join("\n"),"one-time WebGL capability");
one([
"          // APOIS_DRIVER_RIDE_MAP_STABILITY_V2: avoid runtime vector switching",
"          // while riding. Retain a single stable raster map through each phase.",
"          renderingType: undefined,",
"          tiltInteractionEnabled: false,",
"          headingInteractionEnabled: false,"
].join("\n"),[
"          // APOIS_DRIVER_RIDE_MAP_STABILITY_V2: never change renderer by ride status.",
"          // Vector is selected at first mount only; Google may fall back to raster.",
"          renderingType: isDriverRole && driverVectorCapable && !forceRasterAfterFailure",
"            ? google.maps.RenderingType.VECTOR : undefined,",
"          tiltInteractionEnabled: isDriverRole && driverVectorCapable && !forceRasterAfterFailure,",
"          headingInteractionEnabled: isDriverRole && driverVectorCapable && !forceRasterAfterFailure,"
].join("\n"),"permanently stable vector-on-capable renderer");
one("onClick={()=>{setTileTimeout(false);setMapAttempt(n=>n+1);}}",
    "onClick={()=>{setTileTimeout(false);setForceRasterAfterFailure(true);setMapAttempt(n=>n+1);}}",
    "user-triggered safe raster retry");
// Verify no dynamic renderer-switching by navigationMode: one key and options.
for(const marker of [
 "APOIS_DRIVER_QA192_VECTOR_PASSENGER_V1",
 "APOIS_DRIVER_RIDE_MAP_STABILITY_V2",
 "renderingType: isDriverRole && driverVectorCapable && !forceRasterAfterFailure",
 "driverVectorCapable] = useState(() => {",
 "failIfMajorPerformanceCaveat: true",
 "setForceRasterAfterFailure(true)",
 "key={mapAttempt}",
 "tileListenerRef.current?.remove()",
 "tileTimerRef.current",
 "onUnmount={handleUnmount}"
])if(!s.includes(marker))throw Error("[FAIL] QA192 lost map contract "+marker);
if(s.includes("renderingType: isDriverRole && navigationMode"))
 throw Error("[FAIL] QA192 illegal renderer transition");
writeFileSync(path,s,"utf8");
console.log("[OK] QA192 Motorista: stable vector where WebGL available, hardware/raster fallback, explicit safe retry; no map remount when changing ride status.");
