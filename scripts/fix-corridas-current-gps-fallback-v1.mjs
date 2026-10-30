import { existsSync,readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(".work/corridas");
const marker="APOIS_CORRIDAS_CURRENT_GPS_FALLBACK_V1";
function edit(relative,change,checks){
 const path=resolve(root,relative);
 if(!existsSync(path))throw Error("[FAIL] Missing corridas source "+relative);
 const original=readFileSync(path,"utf8"),updated=change(original);
 for(const check of checks)if(!updated.includes(check))throw Error("[FAIL] GPS gate "+check);
 if(original!==updated)writeFileSync(path,updated,"utf8");
 console.log("[OK] Corridas GPS fallback: "+relative);
}
function exact(src,oldText,newText,label){
 if(src.includes(newText))return src;
 if(!src.includes(oldText))throw Error("[FAIL] Expected GPS source missing: "+label);
 return src.replace(oldText,newText);
}
edit("src/hooks/use-location.tsx",(original)=>{
 let s=original;
 s=exact(s,
  '    const parsed = JSON.parse(value) as Partial<LocationData>;',
  '    const parsed = JSON.parse(value) as Partial<LocationData>;\n    // '+marker+': do not present stale positions from another city as current.\n    if (typeof parsed.timestamp !== "number" || !Number.isFinite(parsed.timestamp) ||\n        parsed.timestamp > Date.now() + 10_000 || Date.now() - parsed.timestamp > 120_000) return null;',
  'cache expiry'
 );
 // In the already-hardened runtime, startup asks permission. A manual retry
 // must also ask, rather than just showing the prompt/unknown error forever.
 s=exact(s,
  '        const permission = await checkPermissions();\n        if (permission !== "granted") {',
  '        let permission = await checkPermissions();\n        if (permission === "prompt" || permission === "unknown") {\n          const requested = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });\n          permission = normalizePermission(requested.location);\n          if (mountedRef.current) setPermissionState(permission);\n        }\n        if (permission !== "granted") {',
  'manual GPS refresh permission'
 );
 return s;
},[marker,'Date.now() - parsed.timestamp > 120_000','Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })']);
edit("src/components/map/PassengerMap.tsx",(original)=>{
 let s=original;
 s=exact(s,
   'const DEFAULT_CENTER = { lat: -9.3891, lng: -40.5031 };',
   '// APOIS_CORRIDAS_NO_FALSE_PETROLINA_CENTER_V1: neutral Brazil view until real GPS arrives.\nconst DEFAULT_CENTER = { lat: -14.2350, lng: -51.9253 };',
   'remove city-specific false location');
 s=exact(s,'zoom: origin ? 16 : 13,','zoom: origin ? 16 : 5,','neutral map zoom');
 s=exact(s,
  'mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER);',
  'mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER, origin ? 16 : 5);',
  'neutral native zoom when GPS is unavailable');

 s=exact(s,'mapRef.current.setZoom(13);','mapRef.current.setZoom(5);','neutral view on camera update');
 return s;
},['APOIS_CORRIDAS_NO_FALSE_PETROLINA_CENTER_V1','zoom: origin ? 16 : 5']);


edit("src/services/maps/map-service.ts",(original)=>{
 let s=original;
 s=exact(s,
  '    initialPosition?: MapCoordinates,\n  ): Promise<GoogleMap> {',
  '    initialPosition?: MapCoordinates,\n    initialZoom?: number,\n  ): Promise<GoogleMap> {',
  'optional native initial zoom');
 s=exact(s,'          zoom: DEFAULT_ZOOM,','          zoom: initialZoom ?? DEFAULT_ZOOM,','native zoom override');
 return s;
},['initialZoom?: number','zoom: initialZoom ?? DEFAULT_ZOOM']);
