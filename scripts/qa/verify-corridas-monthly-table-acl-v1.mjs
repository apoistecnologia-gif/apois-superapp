import {readFileSync} from "node:fs";
const path="supabase/corridas-forward-migrations/20261104043000_restrict_driver_membership_financial_table_acl.sql";
const sql=readFileSync(path,"utf8");
for(const marker of [
 "FROM PUBLIC, anon, authenticated;",
 "GRANT SELECT ON TABLE",
 "TO authenticated;",
 "GRANT ALL PRIVILEGES ON TABLE",
 "TO service_role;",
 "public.driver_memberships, public.driver_membership_charges"
]) if(!sql.includes(marker))throw Error("Driver billing financial ACL requirement missing: "+marker);
const sh=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const f of ["scripts/qa/corridas-driver-monthly-table-acl-fixture-v1.sql","supabase/corridas-forward-migrations/20261104043000_restrict_driver_membership_financial_table_acl.sql","scripts/qa/corridas-driver-monthly-table-acl-assertions-v1.sql"]) {
 if(!sh.includes("< "+f))throw Error("Monthly ACL isolation test missing: "+f);
}
console.log("[PASS] Corridas membership financial ACL migration is staged with isolated role/RLS regression");
