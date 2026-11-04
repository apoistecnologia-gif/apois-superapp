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
 SELECT 'cash_finish_has_no_platform_wallet_credit',true,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='handle_completed_ride_settlement'
      AND pg_get_functiondef(p.oid) ILIKE '%wallet_amount = 0%'
      AND pg_get_functiondef(p.oid) ILIKE '%payment_provider = null%'
      AND pg_get_functiondef(p.oid) ILIKE '%platform_fee = 0%'),
  'Cash finish is recorded as a direct handoff, not withdrawable APOIS wallet funds'
 UNION ALL
 SELECT 'cash_finish_auto_marks_operational_paid',false,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='handle_completed_ride_settlement'
      AND pg_get_functiondef(p.oid) ILIKE '%set payment_status = ''paid''%'),
  'Informational: ride completion auto-records paid cash WITHOUT external proof'
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
 UNION ALL
 SELECT 'driver_public_rpcs_authenticated_only',true,
  (SELECT count(*)=3 AND bool_and(
    has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND has_function_privilege('service_role',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('driver_set_presence','driver_accept_ride','driver_finish_ride')),
  'Public SECDEF driver API requires authenticated (anon revoked); staged migration only'
 UNION ALL
 SELECT 'driver_private_rpcs_service_role_only',true,
  (SELECT count(*)=4 AND bool_and(
    has_function_privilege('service_role',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='apois_rpc_private'
     AND p.proname IN ('driver_set_presence','driver_accept_ride',
       'driver_accept_ride_candidate_legacy','driver_finish_ride')),
  'Private driver RPC remains service-role-only with the public wrappers as the app API'
 UNION ALL
 SELECT 'driver_stage_reassignment_preserves_eligibility_checks',true,
  EXISTS(
    SELECT 1 FROM funcs WHERE schema_name='private'
     AND proname='enforce_driver_operational_stage_transition'
     AND definition ILIKE '%new.driver_id is not distinct from old.driver_id%'
     AND definition NOT ILIKE '%new.status is not distinct from old.status or%'
  ) AND EXISTS(
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.rides'::regclass
      AND t.tgfoid=to_regprocedure('private.enforce_driver_operational_stage_transition()')
      AND NOT t.tgisinternal
      AND pg_get_triggerdef(t.oid) ILIKE '%UPDATE OF status, driver_id%'
  ), 'Driver change with unchanged operational status must still run block/approval/KYC/online validation'
) gate_results ORDER BY gate;
