// Contract-only guard: actual ACL SQL is tested in isolated PG17 by runner.
import {readFileSync} from "node:fs";
const m=readFileSync("supabase/corridas-forward-migrations/20261104050000_restrict_wallet_cancellation_financial_table_acl.sql","utf8");
for(const s of [
 "public.driver_wallets, public.driver_wallet_transactions, public.cancellation_fees",
 "FROM PUBLIC, anon, authenticated;",
 "GRANT SELECT ON TABLE",
 "TO authenticated;",
 "GRANT ALL PRIVILEGES ON TABLE",
 "TO service_role;"
])if(!m.includes(s))throw Error("Corridas wallet/cancellation ACL drift: "+s);
const sh=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const path of [
 "scripts/qa/corridas-wallet-cancellation-acl-fixture-v1.sql",
 "supabase/corridas-forward-migrations/20261104050000_restrict_wallet_cancellation_financial_table_acl.sql",
 "scripts/qa/corridas-wallet-cancellation-acl-assertions-v1.sql"
])if(!sh.includes("< "+path))throw Error("Missing PG17 regression: "+path);
const preflight=readFileSync("database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql","utf8");
if(!preflight.includes("wallet_cancellation_financial_tables_least_privilege"))throw Error("Missing release gate");
console.log("[PASS] Wallet/cancellation ACL staged and tied to PG17 + release preflight");
