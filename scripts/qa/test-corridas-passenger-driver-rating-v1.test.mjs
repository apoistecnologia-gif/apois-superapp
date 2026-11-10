import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=p=>readFileSync(resolve(root,p),"utf8");
const comp=read("src/components/rides/active/PassengerDriverRating.tsx");
const route=read("src/routes/_authenticated.corrida.$rideId.tsx");
const service=read("src/services/rides/active-ride-service.ts");
test("Customer can rate driver only on finished ride, not cancelled/active",()=>{
 assert.ok(route.includes('screenState === "completed" && ('));
 assert.ok(route.includes("canRate={Boolean(actionAvailability?.canRate)}"));
 assert.ok(service.includes('canRate: status === "finalizada" && ride.passenger_rating == null'));
 assert.ok(comp.includes("if(alreadyRated||done)"));
 assert.ok(comp.includes("if(!canRate)return null"));
});
test("Only authenticated server-authoritative passenger-to-driver RPC writes rating",()=>{
 for(const needle of [
 'api.rpc("rate_passenger_ride"','_ride_id:rideId','_rating:stars',
 'data.ride_id!==rideId','if(rpcError)throw Error(rpcError.message)',
 "setDone(true)","await onRated()"
 ])assert.ok(comp.includes(needle),"Missing "+needle);
 assert.ok(!comp.includes('.from("rides")')&&!comp.includes('.update('));
 assert.ok(!comp.includes("driver_rate_passenger"));
});
test("Accessible stars, required selection, bounded optional comment and retry",()=>{
 for(const needle of [
 'aria-pressed={stars===note}','[1,2,3,4,5]',
 'stars<1||stars>5','stars===0||busy','maxLength={500}',
 'role="alert"','disabled={busy}','Enviando avaliação...',
 'Avaliação registrada. Obrigado!'
 ])assert.ok(comp.includes(needle),"Missing "+needle);
 assert.ok(route.includes("onRated={() => void refreshRide()}"));
});
