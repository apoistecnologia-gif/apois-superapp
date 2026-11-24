// APOIS_TRIP_DESTINATION_PREMIUM_V1: workspace only, never original source pins.
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(".work/corridas");
const routePath=resolve(root,"src/routes/_authenticated.corrida.$rideId.tsx");
const mapPath=resolve(root,"src/components/map/PassengerMap.tsx");
const componentPath=resolve(root,"src/components/rides/active/ApoisTripInProgressPremium.tsx");
const marker="APOIS_TRIP_DESTINATION_PREMIUM_V1";
function once(input,from,to,name){
  const count=input.split(from).length-1;
  if(count!==1)throw Error("[FAIL] Trip Premium "+name+" expected one anchor, got "+count);
  return input.replace(from,to);
}
let route=readFileSync(routePath,"utf8");
if(route.includes(marker)){
  console.log("[OK] Trip destination UI already installed");
  process.exit(0);
}
const imported='import { DriverCard } from "@/components/rides/active/DriverCard";';
route=once(route,imported,
 imported+'\nimport { ApoisTripInProgressPremium } from "@/components/rides/active/ApoisTripInProgressPremium";',
 "route import");
const locator='  const hasDriverLocation =';
const branch="  // APOIS_TRIP_DESTINATION_PREMIUM_V1: only backend-confirmed in-progress trip.\n  if (screenState === \"active\" && status === \"em_viagem\") {\n    return (\n      <ApoisTripInProgressPremium\n        ride={ride}\n        isRefreshing={isRefreshing}\n        isRealtimeConnected={isRealtimeConnected}\n        onBack={handleBack}\n        onRefresh={() => void refreshRide()}\n      />\n    );\n  }\n";
route=once(route,locator,branch+"\n"+locator,"in-progress switch");
writeFileSync(routePath,route,"utf8");
writeFileSync(componentPath,
  readFileSync(resolve("scripts/templates/ApoisTripInProgressPremium.tsx"),"utf8"),"utf8");

let map=readFileSync(mapPath,"utf8");
const fallback='    ? journeyRoutePoints : approachMode ? [] : displayedRoutePoints;';
map=once(map,fallback,
  '    ? journeyRoutePoints : (approachMode || isTrip) ? [] : displayedRoutePoints;',
  "never show stale full-route polyline in active trip");
const retryAnchor='  const retry = () => {';
const recenter="  // APOIS_TRIP_RECENTER_V1: only on direct tap; no jittery camera loop.\n  useEffect(() => {\n    const recenter = () => {\n      if (!validDriverLocation) return;\n      if (nativeModeRef.current) {\n        void mapService.setCamera(nativeMapIdRef.current, {\n          coordinate: validDriverLocation, zoom: 15.5,\n        }, true).catch(() => undefined);\n      } else if (mapRef.current) {\n        mapRef.current.panTo(validDriverLocation);\n        mapRef.current.setZoom(15.5);\n      }\n    };\n    window.addEventListener(\"apois-trip-recenter\", recenter);\n    return () => window.removeEventListener(\"apois-trip-recenter\", recenter);\n  }, [validDriverLocation?.lat, validDriverLocation?.lng]);\n";
map=once(map,retryAnchor,recenter+"\n"+retryAnchor,"recenter hook");
const originalIcon="    const icon = {\n      path: maps.SymbolPath.FORWARD_CLOSED_ARROW,\n      scale: 6,\n      rotation: heading,\n      fillColor: \"#2563eb\",\n      fillOpacity: 1,\n      strokeColor: \"#ffffff\",\n      strokeWeight: 2,\n      anchor: new maps.Point(0, 2),\n    };";
if(map.includes(originalIcon)){
  const newIcon="    const icon = isTrip ? {\n      url: \"assets/markers/apois-nearby-car-3d.webp\",\n      scaledSize: new maps.Size(58, 42),\n      anchor: new maps.Point(29, 21),\n    } : {\n      path: maps.SymbolPath.FORWARD_CLOSED_ARROW,\n      scale: 6,\n      rotation: heading,\n      fillColor: \"#2563eb\",\n      fillOpacity: 1,\n      strokeColor: \"#ffffff\",\n      strokeWeight: 2,\n      anchor: new maps.Point(0, 2),\n    };";
  map=once(map,originalIcon,newIcon,"3D car JS marker");
}
for(const key of ['APOIS_TRIP_RECENTER_V1','(approachMode || isTrip)',"nativeModeRef.current","journeyRoutePoints"]){
  if(!map.includes(key))throw Error("[FAIL] Trip map missing "+key);
}
writeFileSync(mapPath,map,"utf8");
console.log("[OK] APOIS Cliente: premium trip only, verified ETA, remaining route, photo, recenter.");
