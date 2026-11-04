// Fail closed if a draft operational migration could be accidentally deployed
// without verified provider receipts or current R$59.90 NEW-driver billing.
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
// Historical operational migration must remain unconditionally blocked: its
// embedded 4990 text is legacy and MUST NOT be mistaken for today's price.
if (!block.includes("APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED: 4990 cents monthly paid evidence")) {
 throw Error("Historical Corridas paid-membership HOLD was removed or rewritten");
}
const commercial=readFileSync("supabase/corridas-forward-migrations/20261104121500_driver_5990_new_memberships_preserve_legacy_STAGE_ONLY.sql","utf8");
for (const marker of [
 "driver_new_monthly_fee_must_be_5990",
 "driver_existing_monthly_fee_immutable",
 "driver_charge_must_match_original_contract",
 "monthly_fee_cents SET DEFAULT 5990",
 "to_jsonb(5990)",
 "STAGED / NOT DEPLOYED"
]) if(!commercial.includes(marker))throw Error("Staged new-driver price protection missing: "+marker);
const diagnostic=readFileSync("database/review/20261104_corridas_driver_monthly_billing_READ_ONLY.sql","utf8");
for (const marker of [
 "monthly_fee_setting_5990",
 "membership_amount_constraint_5990_legacy_preserved",
 "charge_amount_constraint_5990_legacy_preserved",
 "new_membership_5990_guard_present",
 "charge_matches_original_driver_contract_guard_present",
 "New driver monthly fee must be R$59.90"
]) if (!diagnostic.includes(marker)) throw Error("Corridas new-driver R$59.90 release diagnostic mismatch: "+marker);
console.log("[PASS] Commercial policy: new drivers 5990, legacy 4990 immutability, independent paid-provider HOLD");
console.log("[PASS] Corridas operational migration remains blocked until verified monthly receipts and active membership enforcement");
