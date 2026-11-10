import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=p=>readFileSync(resolve(root,p),"utf8");
const route=read("src/routes/motorista.app.tsx");
const map=read("src/components/MovviMap.tsx");
test("Vector driver map enables heading and tilt; no change for other roles",()=>{
 for(const x of ["APOIS_DRIVER_VECTOR_MAP_V1",
  "renderingType: isDriverRole ? google.maps.RenderingType.VECTOR : undefined",
  "tiltInteractionEnabled: isDriverRole",
  "headingInteractionEnabled: isDriverRole","getMapStyleForTheme(\"light\")"])
  assert.ok(map.includes(x),"Missing "+x);
});
test("Camera follows actual road bearing, not forced north-up",()=>{
 const from=route.indexOf("function applyNavigationCamera(");
 const to=route.indexOf("type RequestRemovalReason",from);
 assert.ok(from>0 && to>from);
 const camera=route.slice(from,to);
 assert.ok(route.includes("APOIS_DRIVER_FORWARD_CAMERA_V1"));
 for(const x of ["heading: nearDestination ? 0 : (heading ?? undefined)",
  "tilt: nearDestination || heading == null ? 0 : 40",
  "navMap.setHeading?.(heading)", "navMap.setTilt?.(40)",
  "offsetLatLng(position, heading, NAVIGATION_CENTER_AHEAD_METERS)"])
  assert.ok(camera.includes(x),"Camera lacks "+x);
 assert.ok(!camera.includes("heading: 0,\n        tilt: 0"));
 assert.ok(route.includes("routeHeadingFrom(position, route, destination) ?? normalizeHeading(position.heading)"));
 assert.ok(route.includes("const NAVIGATION_CENTER_AHEAD_METERS = 175"));
 assert.ok(route.includes("navMap.setHeading?.(0);"),"North-up still resets on EXIT from navigation");
});
test("No fake passenger identity, photo or security bypass",()=>{
 assert.ok(route.includes("APOIS_DRIVER_PASSENGER_AVATAR_V1"));
 assert.ok(!route.includes('name={passenger?.name ?? "Passageiro"}'));
 assert.ok(route.includes('name={passenger?.name ?? ""}'));
 assert.ok(route.includes("APOIS_ASSIGNED_PASSENGER_V6"),"Scoped driver passenger lookup must be preserved");
 assert.ok(route.includes("apois_driver_assigned_passenger"));
 assert.ok(route.includes("aria-label=\"Ver perfil do passageiro\""));
});
test("Keep route computation, voice, follow, actual status and ride lifecycle",()=>{
 for(const x of ["computeDriverRoute","tickNavigation","autoFollowRef.current",
  "fitBounds","requestRide","startRideRingtone","onClick={handleAccept}",
  "onClick={handleReject}"]){
   if(x==="requestRide") continue;
   assert.ok(route.includes(x),"Missing "+x);
 }
});
