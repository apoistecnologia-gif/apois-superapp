// Verify the staged ACL migration against production-reviewed signatures.
// No credentials, networks or actual Supabase DB access.
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/corridas-forward-migrations/20261104031000_restrict_sensitive_admin_and_pix_public_rpc_acl.sql","utf8");
for(const name of ["public.admin_get_dashboard_metrics()","public.admin_get_finance_summary(timestamp with time zone,timestamp with time zone)","public.admin_provision_staff(uuid,public.app_role,text)","public.admin_set_driver_approval(uuid,text,text)","public.admin_set_driver_suspension(uuid,boolean,text)"]){
 if(!migration.includes(`REVOKE EXECUTE ON FUNCTION ${name} FROM PUBLIC, anon;`))throw Error("Anon still allowed: "+name);
 if(!migration.includes(`GRANT EXECUTE ON FUNCTION ${name} TO authenticated, service_role;`))throw Error("Authenticated admin access removed: "+name);
}
if(!migration.includes(`REVOKE EXECUTE ON FUNCTION public.activate_prepaid_pix_ride(uuid,text) FROM PUBLIC, anon, authenticated;`) ||
 !migration.includes(`GRANT EXECUTE ON FUNCTION public.activate_prepaid_pix_ride(uuid,text) TO service_role;`))throw Error("Pix service_role boundary removed");
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const path of ["scripts/qa/corridas-sensitive-rpc-acl-fixture-v1.sql","supabase/corridas-forward-migrations/20261104031000_restrict_sensitive_admin_and_pix_public_rpc_acl.sql","scripts/qa/corridas-sensitive-rpc-acl-assertions-v1.sql"]){
 if(!runner.includes(`< ${path}`))throw Error("SQL ACL test missing from isolated PostgreSQL: "+path);
}
console.log("[PASS] Corridas sensitive ACL staging preserves authenticated admin and service-only legacy Pix");
