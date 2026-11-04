// Fail closed if a draft operational migration could be accidentally deployed
// without reintroducing and validating monthly R$49.90 paid membership.
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8");
const start=sql.indexOf("DO $apois_driver_monthly_billing_release_hold$");
const stop=sql.indexOf("$apois_driver_monthly_billing_release_hold$;",start);
const firstOperational=sql.indexOf("create or replace function apois_rpc_private.driver_set_presence(");
if(start<0||stop<start||firstOperational<stop)throw Error("Driver billing hold missing or runs after operational changes");
const block=sql.slice(start,stop);
if(!/RAISE EXCEPTION\s+'APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED:/i.test(block)
 || !/USING ERRCODE='55000'/i.test(block))throw Error("Driver monthly billing hold is no longer fail-closed");
if(sql.indexOf("DO $apois_driver_monthly_billing_release_hold$",start+1)!==-1)throw Error("Duplicate hold block");
const runner=readFileSync("scripts/test-cash-postgres-isolated-v1.sh","utf8");
if(!runner.includes("driver_billing_release_hold_qa")||!runner.includes("APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED"))throw Error("Disposable PostgreSQL failure-mode test was removed");
// Independent business-rule guard: do not silently change the approved
// driver fee during cash-only QA or mistake a pricing draft for approval.
if (!/APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED:\\s*4990 cents monthly paid evidence/.test(block)) {
 throw Error("Corridas monthly release HOLD must require the authorized R$49.90");
}
const diagnostic=readFileSync("database/review/20261104_corridas_driver_monthly_billing_READ_ONLY.sql","utf8");
for (const marker of [
 "monthly_fee_setting_4990",
 "membership_amount_constraint_4990",
 "charge_amount_constraint_4990",
 "amount_cents=4990",
 "Monthly driver price remains R$49.90"
]) {
 if (!diagnostic.includes(marker)) throw Error("Corridas R$49.90 release diagnostic mismatch: "+marker);
}
console.log("[PASS] Corridas driver fee is pinned at R$49.90; no new paid membership unlock");
console.log("[PASS] Corridas operational migration is unconditionally HOLD until R$49.90 paid membership is implemented and approved");
