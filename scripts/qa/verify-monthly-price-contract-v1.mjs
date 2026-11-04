import {readFileSync} from "node:fs";
const p=JSON.parse(readFileSync("config/apois-monthly-pricing.json","utf8"));
if(p.currency!=="BRL"||p.driver_monthly_cents!==5990||p.merchant_monthly_cents!==6990||p.courier_monthly_cents!==4990) throw Error("Commercial pricing contract mismatch");
const sql=readFileSync("supabase/corridas-forward-migrations/20261104120000_driver_membership_monthly_5990_not_deployed.sql","utf8");
for(const token of ["HISTORIC_DRIVER_FEE_REQUIRES_RECONCILIATION","monthly_fee_cents=5990","amount_cents=5990","to_jsonb(5990)"])
 if(!sql.includes(token))throw Error("Driver price migration contract missing: "+token);
const hold=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8");
if(!hold.includes("5990 cents monthly paid evidence")||!hold.includes("APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED"))
 throw Error("Motorista commercial release HOLD price mismatch");
const ui=readFileSync("scripts/harden-motorista-finance-boundary.mjs","utf8");
if(!ui.includes("DRIVER_MONTHLY_FEE_BRL = ${driverMonthlyCents / 100}")||!ui.includes("driverMonthlyCents !== 5990"))
 throw Error("Driver subscription UI does not source reviewed price");
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
for(const f of ["scripts/qa/corridas-driver-fee-5990-fixture-v1.sql","supabase/corridas-forward-migrations/20261104120000_driver_membership_monthly_5990_not_deployed.sql","scripts/qa/corridas-driver-fee-5990-assertions-v1.sql"]) if(!runner.includes("< "+f))
 throw Error("Driver price missing actual PG17 regression: "+f);
console.log("[PASS] Commercial price contract R$59.90 driver / R$69.90 establishment / R$49.90 courier");
