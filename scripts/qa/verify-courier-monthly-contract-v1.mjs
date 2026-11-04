import {readFileSync} from "node:fs";
const p=JSON.parse(readFileSync("config/apois-monthly-pricing.json","utf8"));
if(p.courier_monthly_cents!==4990||p.merchant_monthly_cents!==6990)throw Error("Courier/merchant prices mismatched");
const sql=readFileSync("supabase/entregas-forward-migrations/20261104121000_courier_monthly_4990_contract_not_deployed.sql","utf8");
for(const mark of [
 "courier_monthly_amount_cents",
 "monthly_fee_cents=4990",
 "amount_cents=4990",
 "status <> 'received'",
 "courier_monthly_activation_not_homologated",
 "courier_monthly_receipt_not_homologated",
 "ENABLE ROW LEVEL SECURITY",
 "FROM PUBLIC,anon,authenticated;",
 "TO service_role;"
])if(!sql.includes(mark))throw Error("Courier fee schema missing: "+mark);
if(/CREATE OR REPLACE FUNCTION public.*courier.*(paid|eligible)/i.test(sql))
 throw Error("Courier billing cannot expose an unverified paid-membership API");
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const file of ["supabase/entregas-forward-migrations/20261104121000_courier_monthly_4990_contract_not_deployed.sql","scripts/qa/entregas-courier-monthly-4990-fixture-v1.sql","scripts/qa/entregas-courier-monthly-4990-assertions-v1.sql"])
 if(!runner.includes("< "+file))throw Error("Courier fee must pass disposable PG17: "+file);
const report=readFileSync("database/review/20261104_entregas_courier_monthly_4990_READ_ONLY.sql","utf8");
for(const gate of ["merchant_monthly_price_6990","courier_monthly_price_4990","courier_acceptance_requires_paid_membership","courier_monthly_provider_webhook_verified"])
 if(!report.includes(gate))throw Error("Missing courier release gate: "+gate);
console.log("[PASS] Courier R$49.90 monthly schema is fail-closed pending provider and dispatch integration");
