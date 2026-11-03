// Keep reviewed forward migration and isolated PostgreSQL ACL fixture aligned.
// Requires no credentials, network, or actual Supabase access.
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8")
 .toLowerCase().replace(/\s+/g," ");
const fixture=readFileSync("scripts/qa/driver-rpc-privileges-fixture-v1.sql","utf8").toLowerCase();
for(const signature of [
 "public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)",
 "public.driver_accept_ride(uuid)",
 "public.driver_finish_ride(uuid)"
]){
 const command="revoke execute on function "+signature+" from public, anon;";
 if(!sql.includes(command)) throw new Error("Missing staged anon revoke: "+signature);
}
if((fixture.match(/to authenticated, service_role;/g)||[]).length!==3
 || fixture.includes("to anon, authenticated, service_role;")){
 throw new Error("Isolated ACL fixture does not model authenticated-only wrappers");
}
console.log("[PASS] Corridas public wrapper revocations tracked in unapplied migration and PG fixture");
