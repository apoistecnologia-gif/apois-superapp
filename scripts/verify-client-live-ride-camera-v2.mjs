import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const s=readFileSync(resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/components/map/PassengerMap.tsx"),"utf8");
const checks=[
 ["APOIS_PASSENGER_LIVE_FOCUS_V2","live route camera installed"],
 ["validDriverLocation && !isStatic","live driver is required"],
 ["mapRef.current.setCenter(validDriverLocation)","Google Maps JS local driver focus"],
 ["mapRef.current.setZoom(15)","street-level zoom"],
 ["mapService.setCamera(mapId, {coordinate:validDriverLocation,zoom:15})","native Google Maps local driver focus"],
 ["mapRef.current.panTo(validDriverLocation)","driver follow without old pickup midpoint"],
 ["mapService.fitRouteBounds(mapId, points)","prebooking route overview retained"],
 ["focusPickup && origin","pickup search layout retained"],
 ["polylineRef.current = new maps.Polyline","existing Google map route path retained"],
 ];
let failed=false;
for(const [part,label] of checks){
 const ok=s.includes(part);
 console.log("["+(ok?"OK":"FAIL")+"] "+label);
 if(!ok)failed=true;
}
if(s.includes("mapRef.current.panTo(midpoint)")){console.log("[FAIL] old camera midpoint is still used");failed=true;}
if(failed)process.exit(1);
