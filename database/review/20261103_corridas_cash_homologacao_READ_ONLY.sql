-- APOIS CORRIDAS, production-aware read-only cash QA preflight.
-- NO DDL, no INSERT/UPDATE, no RPC invocation, no PII, no money.
-- Run only in project tbbzkrfupmqdywnzgnms.
WITH funcs AS (
 SELECT n.nspname AS schema_name,p.proname,
        pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='apois_rpc_private' AND p.proname IN
   ('driver_set_presence','driver_accept_ride_candidate_legacy','driver_finish_ride','driver_accept_ride'))
 OR (n.nspname='private' AND p.proname='enforce_driver_operational_stage_transition')
)
SELECT gate,required,passed,detail FROM (
 SELECT 'cash_electronic_checkout_disabled'::text AS gate,true AS required,
   EXISTS(SELECT 1 FROM public.app_settings WHERE
     key='finance.ride_electronic_payments_enabled' AND
     (value::text='false' OR value::text='"false"' OR value::text='"0"')) AS passed,
   'Electronic payment must be off while testing cash'::text AS detail
 UNION ALL
 SELECT 'driver_online_without_legacy_subscription',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='apois_rpc_private'
   AND proname='driver_set_presence'
   AND definition NOT ILIKE '%driver_subscription_allows_rides(v_driver.subscription_status)%'),
  'New approved KYC driver can go online without retired provider'
 UNION ALL
 SELECT 'driver_legacy_offer_without_subscription',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='apois_rpc_private'
   AND proname='driver_accept_ride_candidate_legacy'
   AND definition NOT ILIKE '%driver_subscription_allows_rides(v_driver.subscription_status)%'),
  'Offer acceptance does not require retired provider'
 UNION ALL
 SELECT 'driver_finish_without_subscription',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='apois_rpc_private'
   AND proname='driver_finish_ride'
   AND definition NOT ILIKE '%driver_subscription_allows_rides(v_driver.subscription_status)%'),
  'Queued rides promote based on KYC + online, not paid gateway'
 UNION ALL
 SELECT 'driver_operational_transition_without_subscription',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='private'
   AND proname='enforce_driver_operational_stage_transition'
   AND definition NOT ILIKE '%driver_subscription_allows_rides(v_driver.subscription_status)%'),
  'Ride state transition must not depend on legacy subscription'
 UNION ALL
 SELECT 'driver_online_checks_kyc',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='apois_rpc_private'
   AND proname='driver_set_presence' AND definition ILIKE '%driver_kyc_is_ready%'),
  'KYC must remain required; do not open test bypasses'
 UNION ALL
 SELECT 'direct_cash_ride_offer_supported',true,
  EXISTS(SELECT 1 FROM funcs WHERE schema_name='apois_rpc_private'
   AND proname='driver_accept_ride' AND definition ILIKE '%payment_method%'),
  'Canonical driver ride acceptance path has payment method boundary'
) gate_results ORDER BY gate;
