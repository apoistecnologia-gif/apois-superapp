import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const role=process.argv[2];
assert.ok(role==="motorista"||role==="entregador");
const moduleRoot=resolve(role==="motorista"?".work/partner-motorista":".work/partner-entregador");
const read=(p)=>readFileSync(resolve(moduleRoot,p),"utf8");
const screen=read(role==="motorista"?"src/routes/motorista.app.tsx":"src/routes/courier.tsx");
const pane=read("src/components/ApoisAvailableCalls.tsx");
for(const token of ["APOIS_AVAILABLE_CALLS_V1","<ApoisAvailableCalls","availableCallsOpen"])assert.ok(screen.includes(token),role+": missing "+token);
for(const token of ["apois_list_available_ride_calls","apois_list_available_delivery_calls",
"apois_claim_available_ride_call","apois_claim_available_delivery_call",
"if(error||!data)throw","remaining_seconds>0","!online","onAccepted()","setCalls([])","window.clearInterval(poll)"]){
 assert.ok(pane.includes(token),role+": calls panel missing "+token);
}
const sql=readFileSync(resolve(role==="motorista"?
 "supabase/corridas-forward-migrations/20261031_available_ride_calls_qa.sql":
 "supabase/entregas-forward-migrations/20261031_available_delivery_calls_qa.sql"),"utf8");
for(const token of ["auth.uid()","SECURITY DEFINER","REVOKE ALL ON FUNCTION",
 "GRANT EXECUTE ON FUNCTION","FOR UPDATE","current","accepted"]){
  assert.ok(sql.includes(token),role+": server claim guard missing "+token);
}
assert.ok(!pane.includes("from(\"rides\")")&&!pane.includes("from(\"delivery_jobs\")"),"Never expose raw offers without RPC");
console.log("[OK] "+role+": central de chamadas com validação de prazo, acesso e aceite server-side sem pedidos fabricados");
