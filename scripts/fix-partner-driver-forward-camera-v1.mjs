// APOIS_DRIVER_FORWARD_CAMERA_V1
// Applied only to .work/partner-motorista after V5 roadmap + V6 trip UX.
// Root cause: V6 deliberately forced heading=0 (north-up), although bearing
// from the route was already calculated. Prefer VECTOR on this one driver map,
// with graceful raster fallback and independent route/driver markers intact.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function replaceOnce(text,oldText,newText,label){
 const count=text.split(oldText).length-1;
 if(count!==1)throw Error("[FAIL] Driver forward camera: "+label+" anchor="+count);
 return text.replace(oldText,newText);
}
const cameraFile=resolve(root,"src/routes/motorista.app.tsx");
let src=readFileSync(cameraFile,"utf8");
if(src.includes("APOIS_DRIVER_FORWARD_CAMERA_V1"))throw Error("[FAIL] Camera fix applied twice");
const a=src.indexOf("function applyNavigationCamera(");
const b=src.indexOf("type RequestRemovalReason",a);
if(a<0||b<a)throw Error("[FAIL] Navigation camera function not found");
let camera=src.slice(a,b);
camera=replaceOnce(camera,
  "heading: 0,\n        tilt: 0,",
  "heading: nearDestination ? 0 : (heading ?? undefined),\n        tilt: nearDestination || heading == null ? 0 : 40,",
  "initial route-follow bearing");
camera=replaceOnce(camera,
  "      navMap.setHeading?.(0);\n      navMap.setTilt?.(0);",
  "      navMap.setHeading?.(heading);\n      navMap.setTilt?.(40);",
  "continual route-follow bearing");
camera=camera.replace("function applyNavigationCamera(", "// APOIS_DRIVER_FORWARD_CAMERA_V1: camera aims up the actual route on supported vector WebViews.\nfunction applyNavigationCamera(");
for(const required of [
 "routeHeadingFrom(position, route, destination)",
 "heading: nearDestination ? 0 : (heading ?? undefined)",
 "navMap.setHeading?.(heading)",
 "offsetLatLng(position, heading, NAVIGATION_CENTER_AHEAD_METERS)"
]){
 if(!camera.includes(required)&&!src.includes(required)) throw Error("[FAIL] Forward navigation missing "+required);
}
src=src.slice(0,a)+camera+src.slice(b);
writeFileSync(cameraFile,src,"utf8");
const mapFile=resolve(root,"src/components/MovviMap.tsx");
let map=readFileSync(mapFile,"utf8");
map=replaceOnce(map,"        options={{\n          styles,",
  "        options={{\n          // APOIS_DRIVER_VECTOR_MAP_V1: heading and perspective work on vector maps.\n          // No new map ID/API is required. Other roles keep their existing renderer.\n          renderingType: isDriverRole ? google.maps.RenderingType.VECTOR : undefined,\n          tiltInteractionEnabled: isDriverRole,\n          headingInteractionEnabled: isDriverRole,\n          styles,",
  "driver vector renderer");
if(!map.includes("APOIS_DRIVER_VECTOR_MAP_V1") || !map.includes("getMapStyleForTheme(\"light\")"))
  throw Error("[FAIL] Vector driver map must preserve APOIS palette and other roles");
writeFileSync(mapFile,map,"utf8");
console.log("[OK] Motorista navigation: route-forward bearing and vector camera active; normal maps and passenger data unmodified.");
