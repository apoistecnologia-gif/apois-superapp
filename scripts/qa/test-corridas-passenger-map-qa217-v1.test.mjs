import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const src=(path)=>readFileSync(resolve(root,path),"utf8");
const map=src("src/components/map/PassengerMap.tsx");
const native=src("src/services/maps/map-service.ts");
const home=src("src/routes/_authenticated.inicio.tsx");
const ride=src("src/routes/_authenticated.corrida.$rideId.tsx");
const header=src("src/components/rides/active/RideStatusHeader.tsx");
const arrival=src("src/hooks/rides/use-passenger-arrival-estimate.ts");
const nearby=src("src/hooks/maps/use-nearby-passenger-drivers.ts");
const sql=readFileSync(resolve("docs/QA217-PROPOSTA-RPC-MOTORISTAS-PROXIMOS.sql"),"utf8");

test("QA217: real road ETA to pickup and then destination, with 90s quota throttle",()=>{
 for(const text of [
  'passenger-routes-compute','MIN_INTERVAL_MS = 90_000',
  'status === "motorista_a_caminho" ? "pickup"','status === "em_viagem" ? "destination"',
  "PolylineDecoder.decode","distanceMeters:meters","minutes:Math.max(1,Math.ceil(seconds/60))"
 ]) assert.ok(arrival.includes(text),text);
 for(const text of [
  "usePassengerArrivalEstimate(ride,status)",
  "driverDistanceMeters={arrivalEstimate?.distanceMeters ?? null}",
  "estimatedArrivalMinutes={arrivalEstimate?.minutes ?? null}",
  "journeyRoutePoints={arrivalEstimate?.points}",
  "approachMode={status ==="
 ]) assert.ok(ride.includes(text),text);
 assert.ok(header.includes("Chegada ao destino em "));
 assert.ok(header.includes("restantes até o destino"));
});

test("QA217: map has live car marker plus own driver-to-pickup route and preview zoom",()=>{
 for(const text of [
  "APOIS_PASSENGER_QA217_MAP_V1","effectiveJourneyPoints",
  "approachMode && validDriverLocation && origin",
  "mapService.fitPickupAndDestination(mapId,validDriverLocation,origin,140)",
  "mapService.fitRouteBounds(nativeMapIdRef.current, displayedRoutePoints)",
  "mapRef.current.fitBounds(bounds",
  "bottom: Math.min(350, Math.round(height * 0.47))",
  "driverMarkerRef.current",
  "journeyRoutePoints"
 ])assert.ok(map.includes(text),text);
 assert.ok(home.includes("data-apois-qa217-route-distance"));
 assert.ok(home.includes("route.distanceMeters/1000"));
});

test("QA217: red pulse pins on JS and native, real-only presence and strict backend scope",()=>{
 for(const text of [
  "setOpacity(bright ? 1 : 0.25)",
  "setNearbyDriverMarkers(nativeMapIdRef.current, points, dim)",
  "fillColor: \"#E51B23\"",
 ])assert.ok(map.includes(text),text);
 for(const text of [
  "nearbyDriverMarkerIds","setNearbyDriverMarkers(","apois-nearby-red.svg",
  "opacity: dim ? 0.3 : 1"
 ])assert.ok(native.includes(text),text);
 for(const text of [
  "useNearbyPassengerDrivers(","nearbyDrivers={nearby.points}"
 ])assert.ok(home.includes(text),text);
 assert.ok(!home.includes("data-apois-qa217-nearby-label"),"nearby overlay removed");
 assert.ok(!home.includes("Nenhum motorista próximo agora"),"no nearby message");
 for(const text of [
  "apois_nearby_driver_presence","state:\"unavailable\"",
  "points:[],state:\"unavailable\""
 ])assert.ok(nearby.includes(text),text);
 assert.ok(!nearby.includes('.from("drivers")'));
 for(const text of [
   "SECURITY DEFINER","auth.uid()","d.is_online IS TRUE",
   "d.approval_status = 'aprovado'","d.last_location_at > now() - interval '2 minutes'",
   "round(d.current_lat, 3)","round(d.current_lng, 3)",
   "LIMIT 12","REVOKE ALL ON FUNCTION","GRANT EXECUTE ON FUNCTION"
 ])assert.ok(sql.includes(text),text);
 assert.ok(!sql.includes("GRANT SELECT ON public.drivers TO authenticated"));
});
