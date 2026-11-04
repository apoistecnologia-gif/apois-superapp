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
// Guard two runtime safety regressions discovered in the production function
// review. The PostgreSQL suite also exercises the real staged SQL paths.
for (const [mark, message] of [
 ["new.status is not distinct from old.status and new.driver_id is not distinct from old.driver_id",
  "Operational driver reassignment must rerun eligibility checks"],
 ["v_kyc_ready := coalesce(private.driver_kyc_is_ready(v_driver.id),false)",
  "KYC must be read on every presence refresh"],
 ["and v_kyc_ready;",
  "Cached presence eligibility must depend on current KYC"],
 ["and coalesce(v_driver.is_online,false) and not v_active_in_trip then",
  "KYC revocation must clear stale online state without GPS"],
 ["and not v_operationally_eligible",
  "Any ineligible cached online driver must be deactivated, not only KYC"],
 ["set is_online=false,updated_at=now()",
  "KYC revocation must persist an offline transition"]
]) {
 if (!sql.includes(mark)) throw new Error(message);
}
if (sql.includes("if new.status is not distinct from old.status or new.status not in")) {
 throw new Error("Same-status operational driver change bypass is back");
}
console.log("[PASS] Corridas staged driver-reassignment guard and KYC revocation are pinned");
for(const mark of [
 "d.current_lat between -34 and 6",
 "d.current_lng between -74 and -32",
 "d.last_location_at<=now()+interval '30 seconds'",
 "new.origin_lat not between -34 and 6",
 "new.origin_lng not between -74 and -32",
 "new.request_expires_at<=now()",
 "lower(btrim(coalesce(new.payment_method,''))) not in",
 "'mercadopago_marketplace','asaas','pagbank','openpix'",
 "'cash','dinheiro','money','credit','credit_card','cartao_credito'",
]) if(!sql.includes(mark)) throw new Error("Busy-driver offer boundary regression: "+mark);
console.log("[PASS] Corridas busy-driver offers require bounded coordinates and fresh GPS");

console.log("[PASS] Corridas public wrapper revocations tracked in unapplied migration and PG fixture");
