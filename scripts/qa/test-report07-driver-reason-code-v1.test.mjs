import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/lib/driverRideLifecycle.mobile.ts");
const content=readFileSync(path,"utf8");
test("INV-056: canonical no-show code while UI remains in Portuguese",()=>{
 const m=content.match(/function report07ReasonCode\(reason: string\): "passenger_no_show" \| "other" \{([\s\S]*?)\n\}/);
 assert.ok(m);
 const fn=new Function("reason",m[1]);
 for(const v of ["Passageiro não apareceu","PASSAGEIRO NAO APARECEU","Passageiro não compareceu","no-show"])
   assert.equal(fn(v),"passenger_no_show");
 for(const v of ["Passageiro pediu para cancelar","Problema no ponto de embarque","Não consigo atender esta corrida",""])
   assert.equal(fn(v),"other");
 assert.match(content,/reason_code: reasonCode/);
});
test("INV-054: nonexistent endpoint never silently falls back to direct RPC",()=>{
 assert.match(content,/Operação de corrida temporariamente indisponível/);
 assert.match(content,/supabase\.functions\.invoke\(functionName, \{ body \}\)/);
 assert.doesNotMatch(content,/callRpc\("driver_cancel_ride"/);
 assert.doesNotMatch(content,/callRpc\("driver_reject_ride"/);
});
