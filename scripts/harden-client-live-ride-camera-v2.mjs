import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const file=resolve(root,"src/components/map/PassengerMap.tsx");
let source=readFileSync(file,"utf8");
if (source.includes("APOIS_PASSENGER_LIVE_FOCUS_V2")) {
 console.log("[OK] Passenger live camera V2 already applied");
 process.exit(0);
}
function once(a,b,name){
 const n=source.split(a).length-1;
 if(n!==1)throw Error("[FAIL] Passenger live camera "+name+" expected 1 got "+n);
 source=source.replace(a,b);
}
// When a driver exists, a 30-300 km trip must not make the passenger map a
// state-wide overview. Draw the complete route, but show a useful street-level
// camera near the driver's LIVE location. Pre-booking and pickup focus unchanged.
once(
 '        } else await mapService.fitRouteBounds(mapId, points);',
 '        } else if (validDriverLocation && !isStatic) {\n          await mapService.setCamera(mapId, {coordinate:validDriverLocation,zoom:15});\n        } else await mapService.fitRouteBounds(mapId, points);',
 "native polyline camera");
once(
 '        } else if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);',
 '        } else if (validDriverLocation && !isStatic) {\n          await mapService.setCamera(mapId, {coordinate:validDriverLocation,zoom:15});\n        } else if (origin && destination) await mapService.fitPickupAndDestination(mapId, origin, destination, 110);',
 "native without polyline");
once(
 '    } else if (pointCount > 1) {\n      pickupCameraRef.current=null;\n      mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
 '    } else if (validDriverLocation && !isStatic) {\n      // APOIS_PASSENGER_LIVE_FOCUS_V2: map follows the real driver, not the entire interstate trip.\n      pickupCameraRef.current=null;\n      mapRef.current.setCenter(validDriverLocation);\n      mapRef.current.setZoom(15);\n    } else if (pointCount > 1) {\n      pickupCameraRef.current=null;\n      mapRef.current.fitBounds(bounds, { top: 120, right: 28, bottom: 240, left: 28 });',
 "JavaScript map near driver");
once(
 '      if (origin) {\n        const midpoint = {\n          lat: (origin.lat + validDriverLocation.lat) / 2,\n          lng: (origin.lng + validDriverLocation.lng) / 2,\n        };\n        mapRef.current.panTo(midpoint);\n      } else {\n        mapRef.current.panTo(validDriverLocation);\n      }',
 '      // During live trip, never move back to the midpoint of a faraway pickup.\n      mapRef.current.panTo(validDriverLocation);\n      if ((mapRef.current.getZoom?.() ?? 15) < 13) mapRef.current.setZoom(15);',
 "remove stale origin/driver midpoint");
if(!source.includes("APOIS_PASSENGER_LIVE_FOCUS_V2"))throw Error("[FAIL] passenger camera V2 missing marker");
writeFileSync(file,source,"utf8");
console.log("[OK] Cliente: live ride stays near driver at street zoom, long route remains drawn; search and static map intact.");
