import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/corridas-forward-migrations/20261104051000_restrict_payout_payment_settlement_table_acl.sql","utf8");
const split=sql.indexOf("GRANT SELECT ON TABLE");
const full=sql.indexOf("GRANT ALL PRIVILEGES ON TABLE");
if(split<0||full<split)throw Error("Financial ACL must separate client read and service write");
for(const table of [
 "public.driver_payout_destinations","public.passenger_wallets","public.payment_methods",
 "public.payment_webhook_receipts","public.ride_pix_payments","public.ride_settlements"
]) {
 if(!sql.slice(0,split).includes(table)||!sql.slice(full).includes(table))
  throw Error("Missing revoke or server grants: "+table);
}
if(sql.slice(split,full).includes("public.payment_webhook_receipts"))
 throw Error("Sensitive payment webhook receipts must not have client SELECT");
const sh=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const path of [
 "scripts/qa/corridas-payment-settlement-acl-fixture-v1.sql",
 "supabase/corridas-forward-migrations/20261104051000_restrict_payout_payment_settlement_table_acl.sql",
 "scripts/qa/corridas-payment-settlement-acl-assertions-v1.sql"
])if(!sh.includes("< "+path))throw Error("Missing isolated SQL verification: "+path);
const preflight=readFileSync("database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql","utf8");
if(!preflight.includes("payment_payout_settlement_tables_least_privilege"))
 throw Error("Missing required production read-only gate");
console.log("[PASS] Payout/payment/settlement ACL staged, tested and release gated");
