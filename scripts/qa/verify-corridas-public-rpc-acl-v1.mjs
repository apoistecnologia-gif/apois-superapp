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
 ["set is_online=false,updated_at=now()",
  "KYC revocation must persist an offline transition"]
]) {
 if (!sql.includes(mark)) throw new Error(message);
}
if (sql.includes("if new.status is not distinct from old.status or new.status not in")) {
 throw new Error("Same-status operational driver change bypass is back");
}
console.log("[PASS] Corridas staged driver-reassignment guard and KYC revocation are pinned");

console.log("[PASS] Corridas public wrapper revocations tracked in unapplied migration and PG fixture");
