import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/entregas-forward-migrations/20261104044500_restrict_merchant_subscription_financial_table_acl.sql","utf8");
for(const mark of [
 "FROM PUBLIC, anon, authenticated;",
 "GRANT SELECT ON TABLE",
 "TO authenticated;",
 "GRANT ALL PRIVILEGES ON TABLE",
 "TO service_role;",
 "public.merchant_subscriptions",
 "public.merchant_subscription_payments",
 "public.merchant_subscription_events"
])if(!sql.includes(mark))throw Error("Merchant subscription ACL invariant missing: "+mark);
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const path of ["scripts/qa/entregas-merchant-subscription-acl-fixture-v1.sql","supabase/entregas-forward-migrations/20261104044500_restrict_merchant_subscription_financial_table_acl.sql","scripts/qa/entregas-merchant-subscription-acl-assertions-v1.sql"])
 if(!runner.includes("< "+path))throw Error("Merchant financial ACL SQL test missing: "+path);
console.log("[PASS] Entregas merchant billing ACL staging retains authenticated own/admin read and service-only writes");
