import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const map = readFileSync(resolve(root,"src/components/MovviMap.tsx"),"utf8");
const style = readFileSync(resolve(root,"src/lib/googleMaps.ts"),"utf8");
const ride = readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");

test("QA194 same official Passenger base style is visible at first map mount",()=>{
  for(const required of [
    "APOIS_DRIVER_QA194_PASSENGER_MAP_STYLE_V1",
    'getMapStyleForTheme("light")',
    'getMapBackgroundForTheme("light")',
    "options={stableMapOptions}",
    "RenderingType.RASTER : undefined",
    "tiltInteractionEnabled: false",
    "headingInteractionEnabled: false"
  ]) assert.ok(map.includes(required),required);
  for(const required of ["APOIS_LIGHT_MAP_STYLE","#0B2944","#EDEAE4"])
    assert.ok(style.includes(required),required);
  for(const forbidden of ["driverVectorCapable","forceRasterAfterFailure","RenderingType.VECTOR","options={{"])
    assert.ok(!map.includes(forbidden),"Unexpected renderer state: "+forbidden);
});

test("QA194 no map remount or dynamic renderer switching, retry stays explicit",()=>{
  for(const required of [
    "useMemo<google.maps.MapOptions>(() => ({",
    "[isLoaded, isDriverRole, styles, bgColor]",
    "key={mapAttempt}",
    "tilesloaded",
    "setMapAttempt(n=>n+1)"
  ]) assert.ok(map.includes(required),required);
  assert.ok(!map.includes("renderingType: isDriverRole && navigationMode"));
  assert.ok(!map.includes("setForceRasterAfterFailure"));
});

test("QA194 driver route, PIN, passenger, camera and error boundary stay in place",()=>{
  for(const required of [
    "APOIS_DRIVER_FORWARD_CAMERA_V1",
    "routeHeadingFrom(position, route, destination)",
    "navMap.setHeading?.(heading)",
    "onStart(pinCode)",
    "rpc(\"apois_driver_assigned_passenger\"",
    "DriverMapErrorBoundary",
    "onAccept={handleAccept}",
    "onReject={handleReject}"
  ]) assert.ok(ride.includes(required),required);
});
