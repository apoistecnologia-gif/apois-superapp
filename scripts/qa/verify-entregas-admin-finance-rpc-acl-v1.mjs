// Static guard for unapplied least-privilege migration. No production connection.
import {readFileSync} from "node:fs";
const p="supabase/entregas-forward-migrations/20261104060000_restrict_critical_admin_finance_rpc_acl_NOT_DEPLOYED.sql";
const sql=readFileSync(p,"utf8");
const names=[
 "admin_settle_payout(uuid,text,text,text,text)",
 "admin_update_platform_setting(text,jsonb)",
 "admin_create_fee_rule(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)",
 "admin_update_fee_rule(uuid,numeric,numeric,numeric,numeric,numeric)",
 "admin_set_fee_rule_active(uuid,boolean)"
];
for(const name of names){
 for(const token of [
  "REVOKE EXECUTE ON FUNCTION public."+name+" FROM PUBLIC, anon;",
  "GRANT EXECUTE ON FUNCTION public."+name+" TO authenticated, service_role;"
 ]) if(!sql.includes(token)) throw Error("Missing financial admin RPC ACL: "+token);
}
if(/CREATE OR REPLACE FUNCTION|DROP FUNCTION|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE/i.test(sql))
 throw Error("Admin ACL migration must never replace functions or financial data");
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const path of [
 "scripts/qa/entregas-admin-finance-acl-fixture-v1.sql",
 p,
 "scripts/qa/entregas-admin-finance-acl-assertions-v1.sql"
]) if(!runner.includes("< "+path))
 throw Error("Admin ACL not covered by PostgreSQL synthetic QA: "+path);
console.log("[PASS] Entregas critical payout/tariff/settings RPCs preserve authenticated/service access without anon grants");
