// APOIS_PASSENGER_QA217_MAP_V1: generated workspace only, no source-lock changes.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
function file(rel){return resolve(root,rel);}
function one(s,a,b,name){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] QA217 map "+name+" matches="+n);
 return s.replace(a,b);
}
const out=resolve(root,"src/hooks/maps/use-nearby-passenger-drivers.ts");
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,readFileSync(resolve("scripts/templates/useNearbyPassengerDrivers.ts"),"utf8"),"utf8");
const svgFile=file("public/assets/markers/apois-nearby-red.svg");
mkdirSync(dirname(svgFile),{recursive:true});
writeFileSync(svgFile,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="15" fill="#E51B23" fill-opacity=".24"/><circle cx="20" cy="20" r="8" fill="#E51B23" stroke="#ffffff" stroke-width="3"/></svg>',"utf8");

const serviceFile=file("src/services/maps/map-service.ts");
let m=readFileSync(serviceFile,"utf8");
m=one(m,'  private driverMarkerId: Map<string, string> = new Map();',
  '  private driverMarkerId: Map<string, string> = new Map();\n  private nearbyDriverMarkerIds: Map<string, string[]> = new Map(); // APOIS_PASSENGER_QA217_MAP_V1',
  "native pin registry");
m=one(m,'      this.driverMarkerId.delete(mapId);',
  '      this.driverMarkerId.delete(mapId);\n      this.nearbyDriverMarkerIds.delete(mapId);',"destroy map marker");
m=one(m,'  public async removeDestinationMarker(mapId: string): Promise<void> {',
  readFileSync(resolve("scripts/templates/PassengerMapNativeNearbyMethods.txt"),"utf8")+
  '  public async removeDestinationMarker(mapId: string): Promise<void> {',"native pins method");
writeFileSync(serviceFile,m,"utf8");

const path=file("src/components/map/PassengerMap.tsx");
let s=readFileSync(path,"utf8");
s=one(s,'  isTrip?: boolean;',
 '  isTrip?: boolean;\n  approachMode?: boolean;\n  nearbyDrivers?: Array<{lat:number;lng:number}> | undefined;\n  journeyRoutePoints?: Array<{lat:number;lng:number}> | undefined; // APOIS_PASSENGER_QA217_MAP_V1',
 "interface");
s=one(s,'  isTrip = false,',
 '  isTrip = false,\n  approachMode = false,\n  nearbyDrivers,\n  journeyRoutePoints,',
 "map props");
s=one(s,'  const initializeMap = useCallback(async (): Promise<void> => {',
 '  const effectiveJourneyPoints = journeyRoutePoints && journeyRoutePoints.length > 1\n'+
 '    ? journeyRoutePoints : approachMode ? [] : displayedRoutePoints;\n'+
 '  const nearbyMarkerRefs = useRef<any[]>([]);\n'+
 '  const routePreviewKeyRef = useRef("");\n'+
 '  const initializeMap = useCallback(async (): Promise<void> => {',
 "route points and refs");
s=one(s,'      const points = displayedRoutePoints;',
        '      const points = effectiveJourneyPoints;', "native selected route");
if(s.includes('if (route?.decodedPoints && route.decodedPoints.length > 1) {')){
 s=one(s,'if (route?.decodedPoints && route.decodedPoints.length > 1) {',
      'if (effectiveJourneyPoints.length > 1) {',"JS route conditional");
 s=one(s,'const path = route.decodedPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
      'const path = effectiveJourneyPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
      "JS route path");
}else if(s.includes('if (displayedRoutePoints.length > 1) {')){
 s=one(s,'if (displayedRoutePoints.length > 1) {',
      'if (effectiveJourneyPoints.length > 1) {',"JS adapted route conditional");
 s=one(s,'const path = displayedRoutePoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
      'const path = effectiveJourneyPoints.map((point) => ({ lat: point.lat, lng: point.lng }));',
      "JS adapted route path");
}else throw Error("[FAIL] QA217 missing JS route");
const nativeCamera='        } else if (validDriverLocation && !isStatic) {\n          await mapService.setCamera(mapId, {coordinate:validDriverLocation,zoom:15});';
const nativeApproach='        } else if (approachMode && validDriverLocation && origin && !isStatic) {\n          await mapService.fitPickupAndDestination(mapId,validDriverLocation,origin,140);\n        } else if (validDriverLocation && !isStatic) {\n          await mapService.setCamera(mapId, {coordinate:validDriverLocation,zoom:15});';
if(s.split(nativeCamera).length!==3)throw Error("[FAIL] QA217 native camera anchors drift");
s=s.replaceAll(nativeCamera,nativeApproach);
s=one(s,
 '    } else if (validDriverLocation && !isStatic) {\n      // APOIS_PASSENGER_LIVE_FOCUS_V2',
 '    } else if (approachMode && validDriverLocation && origin && !isStatic) {\n      pickupCameraRef.current=null;\n      const driverBounds=new maps.LatLngBounds();\n      driverBounds.extend(origin);driverBounds.extend(validDriverLocation);\n      mapRef.current.fitBounds(driverBounds,{top:120,right:26,bottom:190,left:26});\n    } else if (validDriverLocation && !isStatic) {\n      // APOIS_PASSENGER_LIVE_FOCUS_V2',
 "JS incoming driver view");
s=one(s,
 '      // During live trip, never move back to the midpoint of a faraway pickup.\n      mapRef.current.panTo(validDriverLocation);',
 '      // Approach keeps pickup and driver visible; live trip follows the car.\n      if (approachMode && origin) {\n        const bounds=new maps.LatLngBounds();bounds.extend(origin);bounds.extend(validDriverLocation);\n        mapRef.current.fitBounds(bounds,{top:120,right:26,bottom:190,left:26});\n      } else mapRef.current.panTo(validDriverLocation);',
 "live incoming camera");
const nativeDep='}, [destination, displayedRoutePoints, origin, status, validDriverLocation, focusPickup]);';
if(!s.includes(nativeDep))throw Error("[FAIL] QA217 native effect deps");
s=s.replace(nativeDep,'}, [destination, effectiveJourneyPoints, origin, status, validDriverLocation, focusPickup, approachMode]);');
const jsDep='}, [destination, orderedStops, origin, route?.decodedPoints, status, focusPickup]);';
if(s.includes(jsDep)){
 s=s.replace(jsDep,'}, [destination, orderedStops, origin, effectiveJourneyPoints, status, focusPickup, approachMode]);');
}else{
 const fallback='}, [destination, orderedStops, origin, route?.decodedPoints, status]);';
 if(s.includes(fallback))s=s.replace(fallback,'}, [destination, orderedStops, origin, effectiveJourneyPoints, status, focusPickup, approachMode]);');
 else throw Error("[FAIL] QA217 JS map effect deps");
}
s=one(s,'  const retry = () => {',
 readFileSync(resolve("scripts/templates/PassengerMapNearbyEffects.txt"),"utf8")+'  const retry = () => {',
 "route fit and pulse effects");
const must=['APOIS_PASSENGER_QA217_MAP_V1','mapService.fitPickupAndDestination(mapId,validDriverLocation,origin,140)',
 'effectiveJourneyPoints','setNearbyDriverMarkers','routePreviewKeyRef','journeyRoutePoints'];
for(const marker of must)if(!s.includes(marker))throw Error("[FAIL] QA217 PassengerMap missing "+marker);
writeFileSync(path,s,"utf8");
console.log("[OK] QA217 Passenger map: actual route, zoom-to-fit and coarse blinking nearby driver markers.");
