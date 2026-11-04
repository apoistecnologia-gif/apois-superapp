// Fail closed if a draft operational migration could be accidentally deployed
// without reintroducing and validating monthly R$59.90 paid membership.
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
console.log("[PASS] Corridas operational migration is unconditionally HOLD until R$59.90 paid membership is implemented and approved");
