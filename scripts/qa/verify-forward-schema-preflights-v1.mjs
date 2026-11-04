// Static guard for catalog-only Supabase schema-compatibility preflights.
// The live catalog checks run manually as SELECT against each official project.
// CI never connects to either production project.
import {readFileSync} from "node:fs";
for(const [project,projectId,required] of [
 ["entregas","ptgkwyyolrdgnqketkjj",[
  "public.merchant_subscription_in_good_standing(uuid)",
  "public.merchant_reject_order(uuid,text)",
  "apois_test_cash_orders",
  "orders_require_payment_before_fulfillment",
  "public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)"
 ]],
 ["corridas","tbbzkrfupmqdywnzgnms",[
  "private.driver_subscription_allows_rides(text)",
  "public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)",
  "private.enforce_driver_operational_stage_transition()",
  "rides_append_nearby_busy_candidates",
  "apois_rpc_private.driver_finish_ride(uuid)"
 ]]
]){
 const path=`database/review/20261104_${project}_forward_schema_compatibility_READ_ONLY.sql`;
 const source=readFileSync(path,"utf8");
 const executable=source.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
 if(!source.includes(projectId))throw Error("Supabase project mismatch: "+project);
 for(const marker of required)if(!source.includes(marker))throw Error("Missing "+project+" prerequisite: "+marker);
 if(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY)\b/i.test(executable)) {
  throw Error("Mutating SQL detected in read-only catalog preflight: "+project);
 }
 if(!/\bSELECT\s+kind,object_name,ready\b/i.test(executable)){
  throw Error("Preflight no longer returns per-object readiness: "+project);
 }
 console.log(`[PASS] ${project.toUpperCase()} catalog preflight is metadata-only and tracks staged migration dependencies`);
}

// Read-only release diagnostic for driver monthly billing; no direct DB access
// in CI. The live version must be invoked only with SELECT on Corridas.
{
 const path="database/review/20261104_corridas_driver_monthly_billing_READ_ONLY.sql";
 const src=readFileSync(path,"utf8");
 const sql=src.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
 if(!src.includes("tbbzkrfupmqdywnzgnms"))throw Error("Monthly billing diagnostic bound to wrong project");
 for(const mark of [
   "finance.driver_monthly_fee_cents",
   "driver_memberships_monthly_fee_cents_check",
   "driver_membership_charges_amount_cents_check",
   "driver_subscription_allows_rides(text)",
   "operational_ride_calls_reference_membership_evidence",
   "monthly_billing_tables_least_privilege"
 ]) if(!src.includes(mark))throw Error("Missing driver billing invariant: "+mark);
 // SQL privilege names inside quoted pg_catalog arguments (such as
 // has_table_privilege(...,'TRUNCATE')) are data, not TRUNCATE statements.
 // Strip SQL string literals for the statement guard; never allow EXECUTE.
 const statements=sql.replace(/'(?:''|[^'])*'/g,"''");
 if(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY|PERFORM|EXECUTE)\b/i.test(statements))
  throw Error("Monthly billing diagnostic contains mutating SQL");
 console.log("[PASS] Driver monthly R$49.90 evidence diagnostic is SELECT-only and tracks payment enforcement");
}
