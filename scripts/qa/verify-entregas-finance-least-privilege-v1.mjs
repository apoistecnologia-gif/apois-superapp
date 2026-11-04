// Protect finance ACL policy matrix: nine backend-owned tables read-only,
// payout_accounts retains its wallet-owner RLS create/update path.
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/entregas-forward-migrations/20261104063000_restrict_financial_table_crud_acl_NOT_DEPLOYED.sql","utf8");
for(const marker of [
 "APOIS_FINANCE_ACL_SCHEMA_OR_RLS_DRIFT",
 "APOIS_FINANCE_ACL_WRITE_POLICY_DRIFT",
 "APOIS_PAYOUT_ACCOUNT_OWNER_POLICY_DRIFT",
 "Owners view payout accounts",
 "Owners create payout accounts",
 "Owners update payout accounts",
 "current_user_owns_wallet(wallet_id)",
 "FROM PUBLIC, anon, authenticated;",
 "GRANT SELECT ON TABLE",
 "GRANT INSERT, UPDATE ON TABLE public.payout_accounts TO authenticated;",
 "TO service_role;"
])if(!migration.includes(marker))throw Error("Financial least-privilege contract missing: "+marker);
for(const name of ["courier_settlement_deliveries","courier_settlements","payment_events","payment_transactions","payments","payouts","refunds","wallet_transactions","wallets","payout_accounts"])if(!migration.includes("public."+name))throw Error("Financial grant omitted: "+name);
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const file of ["scripts/qa/entregas-finance-least-privilege-fixture-v1.sql","supabase/entregas-forward-migrations/20261104063000_restrict_financial_table_crud_acl_NOT_DEPLOYED.sql","scripts/qa/entregas-finance-least-privilege-assertions-v1.sql"]) {
 if(!runner.includes("< "+file))throw Error("Missing PostgreSQL 17 ACL regression: "+file);
}
if(!readFileSync("database/review/20261103_entregas_cash_homologacao_READ_ONLY.sql","utf8").includes("entregas_finance_crud_least_privilege"))
 throw Error("Finance release check missing or renamed");
console.log("[PASS] Entregas nine read-only tables and payout account owner CRUD protection");
