// QA242 code-only regression checks. NO Android build, deploy, or RPC call.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista";
const route=readFileSync(root+"/src/routes/motorista.app.tsx","utf8");
const pin=readFileSync(root+"/src/components/ApoisPickupPin.tsx","utf8");
const cost=readFileSync("scripts/fix-partner-qa239-external-routes-only.mjs","utf8");

test("QA242 pickup and arrived require deliberate PIN entry swipe, then server PIN confirmation",()=>{
 assert.equal((route.match(/<ApoisSlideAction label="Digitar PIN e iniciar corrida"/g)||[]).length,2);
 assert.ok(route.includes('data-apois-qa236-start-ride="true"'));
 assert.ok(route.includes('data-apois-qa236-arrived-pin="true"'));
 assert.ok(route.includes('onConfirm={onStartPin}'));
 assert.ok(!route.includes('onClick={onStartPin}'),"entry must not be plain click");
 assert.ok(pin.includes('ApoisSlideAction label="Confirmar PIN e iniciar corrida"'));
 assert.ok(pin.includes('const valid=/^\\d{4}$/.test(pin);'));
 assert.ok(pin.includes('disabled={!valid||busy}'),"four real PIN digits required before server start");
 for(const guard of [
  'Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:3000})',
  'distance>150','accuracy>100',
  'await callArrive({data:{rideId:ride.id}});',
  'await callStart({data:{rideId:ride.id,safety_code:code}});',
  'launchApoisNavigationAfterRideStart(ride.destination_lat,ride.destination_lng)'
 ])assert.ok(route.includes(guard),guard);
});
test("QA242 GPS aerial metrics are visible for pickup and trip, without road ETA invention",()=>{
 for(const marker of [
  "APOIS_PARTNER_QA242_GPS_DISTANCE_HUD_V1",
  "qa242StraightKm(position,{lat:active.origin_lat,lng:active.origin_lng})",
  "qa242StraightKm(position,{lat:active.destination_lat,lng:active.destination_lng})",
  "isBrazilCoordinate(position.lat,position.lng)",
  "isBrazilCoordinate(target.lat,target.lng)",
  "haversineKm(position,target)",
  'Math.round(km*1000)',
  'km.toFixed(1).replace(".",",")',
  'Distância: aguardando GPS',
  'em linha reta',
  'data-apois-qa221-pickup-hud="true"',
  'data-apois-qa221-trip-hud="true"'
 ])assert.ok(route.includes(marker),marker);
 assert.equal((route.match(/data-apois-qa242-direct-distance="true"/g)||[]).length,2);
 assert.ok(!route.includes('"ETA calculado pelo APOIS"'),"no fake ETA");
});
test("QA242 still uses Google Maps/Waze for route guidance, no paid Directions reactivated",()=>{
 const effect=route.slice(route.indexOf("  // Rota da corrida ativa."),route.indexOf("  // Voz de navegação"));
 assert.ok(effect.indexOf("if (qa239ExternalOnly()) {")>=0);
 assert.ok(effect.indexOf("if (qa239ExternalOnly()) {")<effect.indexOf("callRoute("));
 assert.ok(effect.includes("setPolyline(previous => previous.length ? [] : previous)"));
 assert.ok(effect.includes("setEtaSeconds(previous => previous === null ? previous : null)"));
 assert.ok(cost.includes("APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1"));
 for(const preserved of [
  'showDemandZones && demandZones.map',
  'rpc("apois_get_driver_demand_zones")',
  'rpc("apois_driver_passenger_hotspots")',
  'onConfirm={handleComplete}',
  'ApoisQuickMapButton',
  'onClick={onRecenter}'
 ])assert.ok(route.includes(preserved),preserved);
});
