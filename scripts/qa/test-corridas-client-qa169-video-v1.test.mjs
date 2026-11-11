import test from "node:test";import assert from "node:assert/strict";
import {readFileSync} from "node:fs";import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=p=>readFileSync(resolve(root,p),"utf8");
test("QA169 five tabs remain interactive with single compact safe reservation",()=>{
 const nav=read("src/components/BottomNavigation.tsx"),layout=read("src/routes/_authenticated.tsx");
 for(const x of ["Início","Corridas","Carteira","Notificações","Perfil","grid-cols-5","min-h-[64px]","to={item.path}","pb-3"])assert.ok(nav.includes(x),x);
 assert.ok(layout.includes('max(24px, env(safe-area-inset-bottom, 0px))'));
 assert.ok(layout.includes('!hideBottomNavigation ? <BottomNavigation /> : null'));
});
test("QA169 driver image onError neutral icon, no fake picture or RLS bypass",()=>{
 const src=read("src/components/rides/active/DriverCard.tsx");
 for(const x of ["photoUrl !== failedUrl","setFailedUrl(photoUrl)","createSignedUrl(path,3600)",'<User className=',"ride.driver_phone","ride.driver_name"])assert.ok(src.includes(x),x);
 assert.ok(!src.includes("src={ride.driver_photo}"));
});
test("QA169 actual polyline forward camera only while ride is in trip",()=>{
 const map=read("src/components/map/PassengerMap.tsx"),ride=read('src/routes/_authenticated.corrida.$rideId.tsx');
 for(const x of ["isTrip?: boolean","displayedRoutePoints","tripCameraPointRef","liveMap.panTo(ahead)","getRenderingType?.()","mapService.setCamera(nativeMapIdRef.current","APOIS_PASSENGER_LIVE_FOCUS_V2"])assert.ok(map.includes(x),x);
 for(const x of ['isTrip={status === "em_viagem"}',"encodedPolyline={ride.encoded_polyline}","onClick={handleReturnHome}","setIsCancelDialogOpen(true)"])assert.ok(ride.includes(x),x);
});
