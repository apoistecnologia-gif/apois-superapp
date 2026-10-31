import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=(name)=>readFileSync(resolve(root,name),"utf8");
const route=read("src/routes/motorista.app.tsx");
const widget=read("src/components/ApoisRideComfortCard.tsx");
for(const token of ["APOIS_RIDE_COMFORT_DRIVER_V1","ApoisRideComfortCard details={ride.service_details}","ApoisRideComfortCard details={active.service_details}"]){
 assert.ok(route.includes(token),"Driver missed ride comfort "+token);
}
assert.ok(route.split("ApoisRideComfortCard details={ride.service_details}").length>=4,"Offer and active trip screens must display preferences");
for(const token of ["ride_comfort_preferences","quiet","talk","no_preference","yes","no","Preferências do passageiro","Conversa","Música","Ar-condicionado"]){
 assert.ok(widget.includes(token),"Driver widget missing "+token);
}
assert.ok(widget.includes("return null"),"Old rides without preferences must not show placeholder");
assert.ok(!widget.includes("from(\"rides\")"),"Widget must use existing RLS ride only");
console.log("[OK] Motorista: per-ride conversation/music/A-C visible before accept and during trip; no extra DB reads.");
