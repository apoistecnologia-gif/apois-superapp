// APOIS_PARTNER_QA242_GPS_DISTANCE_HUD_V1
// Separate GPS straight-line distance from paid road Directions. Executed only
// against disposable Motorista source after QA239; never touches protected repo.
// Never reenable internal computeDriverRoute, ETA estimation or fake road distance.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let code=readFileSync(path,"utf8");
const marker="APOIS_PARTNER_QA242_GPS_DISTANCE_HUD_V1";
function once(src,oldValue,newValue,label){
  const count=src.split(oldValue).length-1;
  if(count!==1)throw Error("[FAIL] QA242 "+label+" anchor count="+count);
  return src.replace(oldValue,newValue);
}
for(const required of [
 "APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1",
 "APOIS_PARTNER_QA236_PICKUP_PIN_V1",
 'ApoisSlideAction label="Digitar PIN e iniciar corrida"',
 'data-apois-qa221-trip-hud="true"',
 'rpc("apois_get_driver_demand_zones")',
 'rpc("apois_driver_passenger_hotspots")'
]) if(!code.includes(required))throw Error("[FAIL] QA242 prerequisite "+required);
if(code.includes(marker))throw Error("[FAIL] QA242 duplicate transform");

const helpers=[
 "// "+marker+": meter/km from existing GPS coordinates ONLY.",
 "// This is an aerial estimate, never road distance or an ETA.",
 "function qa242StraightKm(position:LatLng|null, target:LatLng):number|null {",
 "  if(!position || !isBrazilCoordinate(position.lat,position.lng) ||",
 "     !isBrazilCoordinate(target.lat,target.lng))return null;",
 "  const km=haversineKm(position,target);",
 "  return Number.isFinite(km)&&km>=0 ? km : null;",
 "}",
 "function qa242FormatDistance(km:number|null):string {",
 '  if(km===null)return "Distância: aguardando GPS";',
 '  if(km<1)return "≈ "+Math.round(km*1000)+" m em linha reta";',
 '  return "≈ "+km.toFixed(1).replace(".",",")+" km em linha reta";',
 "}",
 ""
].join("\n");
code=once(code,"const NAVIGATION_STATUSES = new Set(",
 helpers+"const NAVIGATION_STATUSES = new Set(","safe GPS-only helpers");

function replaceMountedLeg(component,target,label){
 const start=code.indexOf("<"+component);
 const leg=start<0?-1:code.indexOf("legKm={legKm}",start);
 const stop=leg<0?-1:code.indexOf("/>",leg);
 // QA242: QA241 may expand the component callbacks well beyond 1600 chars.
 // Search from the *specific* prop instead of imposing a brittle mount length.
 // Do not pick another component/leg, and refuse unexpectedly large snippets.
 if(start<0||leg<=start||stop<=leg||stop-start>12000)
  throw Error("[FAIL] QA242 "+label+" mount/leg bounds");
 const snippet=code.slice(start,stop+2);
 const revised=once(snippet,"legKm={legKm}",'legKm={qa242StraightKm(position,{lat:active.'+target+'_lat,lng:active.'+target+'_lng})}',label+" GPS distance");
 code=code.slice(0,start)+revised+code.slice(stop+2);
}
replaceMountedLeg("PickupNavOverlay","origin","pickup");
replaceMountedLeg("ActiveTripNavOverlay","destination","active trip");

// Preserve QA221 compact card, buttons, cancellation and GPS tracking.
// Avoid fake arrival/ETA because Google/Waze, not APOIS, owns roads and traffic.
const oldLines='                {minutes != null ? String(minutes) + " min" : "ETA —"} {" · "}\n'+
  '                {legKm != null ? legKm.toFixed(1) + " km" : "— km"} {" · "} {arrivalTime ?? "—"}';
const newLines='                <span data-apois-qa242-direct-distance="true" title="Distância aproximada em linha reta, não distância pelas ruas">{qa242FormatDistance(legKm)}</span>\n'+
  '                {minutes != null && arrivalTime != null ? " · "+minutes+" min · "+arrivalTime : null}';
let pickupStart=code.indexOf("function PickupNavOverlay("),pickupEnd=code.indexOf("\nfunction CircleAction(",pickupStart);
if(pickupStart<0||pickupEnd<=pickupStart)throw Error("[FAIL] QA242 pickup render component bounds");
let pickup=code.slice(pickupStart,pickupEnd);
pickup=once(pickup,oldLines,newLines,"pickup top HUD");
code=code.slice(0,pickupStart)+pickup+code.slice(pickupEnd);
let tripStart=code.indexOf("function ActiveTripNavOverlay(");
if(tripStart<0)throw Error("[FAIL] QA242 trip render component");
let trip=code.slice(tripStart);
trip=once(trip,oldLines,newLines,"trip top HUD");
code=code.slice(0,tripStart)+trip;
if(code.split('data-apois-qa242-direct-distance="true"').length-1!==2)
 throw Error("[FAIL] QA242 exactly two GPS-distance HUDs required");
for(const preserved of [
 "APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1",
 'onStartPin={()=>setQa236PinOpen(true)}',
 'onConfirm={handleComplete}',
 'ApoisQuickMapButton',
 'onClick={onRecenter}',
 'showDemandZones && demandZones.map',
 'await callStart({data:{rideId:ride.id,safety_code:code}});'
]) if(!code.includes(preserved))throw Error("[FAIL] QA242 lost "+preserved);
writeFileSync(path,code,"utf8");
console.log("[OK] QA242: pickup/trip show GPS-only straight-line distance; no paid routes or fabricated ETA.");
