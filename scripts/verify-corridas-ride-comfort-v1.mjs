import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/corridas");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const screen=read("src/routes/_authenticated.revisar-solicitacao.tsx");
const request=read("src/hooks/rides/use-ride-request.tsx");
const types=read("src/types/rides/ride-request.ts");
for(const v of ["conversation","music","air_conditioning","quiet","talk","no_preference"]){
 assert.ok(screen.includes(v),"Client comfort screen missing "+v);
 assert.ok(types.includes(v),"Contract missing "+v);
}
for(const text of ["data-apois-ride-comfort-prefs-v1","selectedCategory?.code === \"carros\"",
 "await confirmRide(comfort)","Sem preferência","Prefiro silêncio","Pode conversar",
 "Quero ouvir música","Prefiro sem música","Prefiro ligado","Prefiro desligado"]){
 assert.ok(screen.includes(text),"Client UX missing "+text);
}
assert.ok(request.includes('service_details: selectedCategory.code === "carros" && comfort ? {ride_comfort_preferences: comfort} : {}'),"Ride request must send preferences only for cars");
assert.ok(request.includes('supabase.functions.invoke("request-ride"'),"Existing ride service preserved");
assert.ok(!request.includes('update({ service_details:'),"Never mutate accepted ride or fare after request");
console.log("[OK] Cliente Corridas: per-ride comfort preferences; no new payment or pricing code.");
