-- APOIS Corridas monthly driver fee: production-derived READ-ONLY diagnostic.
-- No person-identifiable data, payment IDs, mutation, RPC invocation, or providers contacted.
-- Target project: tbbzkrfupmqdywnzgnms. Readiness does NOT certify gateway payment.
WITH checks AS (
 SELECT 'monthly_fee_setting_5990'::text AS gate,TRUE AS required,
 EXISTS(SELECT 1 FROM public.app_settings WHERE key='finance.driver_monthly_fee_cents' AND value#>>'{}'='5990') AS ready,
 'New driver monthly fee must be R$59.90; legacy BRL 49.90 contracts stay unchanged'::text AS detail
 UNION ALL SELECT 'membership_amount_constraint_5990_legacy_preserved',TRUE,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conname='driver_memberships_monthly_fee_cents_check' AND pg_get_constraintdef(oid) LIKE '%4990%' AND pg_get_constraintdef(oid) LIKE '%5990%'),
 'Membership table accepts legacy 4990 and new 5990, with trigger enforcing new-contract price'
 UNION ALL SELECT 'charge_amount_constraint_5990_legacy_preserved',TRUE,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conname='driver_membership_charges_amount_cents_check' AND pg_get_constraintdef(oid) LIKE '%4990%' AND pg_get_constraintdef(oid) LIKE '%5990%'),
 'Charge table accepts both contractual rates; trigger must match each driver contract'
 UNION ALL SELECT 'new_membership_5990_guard_present',TRUE,
 EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE c.relname='driver_memberships' AND t.tgname='apois_driver_new_membership_fee_guard'
 AND NOT t.tgisinternal AND t.tgenabled='O'),
 'New driver memberships must be 5990 even if clients supply 4990 explicitly'
 UNION ALL SELECT 'charge_matches_original_driver_contract_guard_present',TRUE,
 EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE c.relname='driver_membership_charges' AND t.tgname='apois_driver_charge_contract_amount_guard'
 AND NOT t.tgisinternal AND t.tgenabled='O'),
 'Future charges must preserve each driver original monthly contract'
 UNION ALL SELECT 'membership_tables_rls_on',TRUE,
 (SELECT count(*)=2 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('driver_memberships','driver_membership_charges')),
 'Both billing tables require row-level security'
 UNION ALL SELECT 'membership_rows_exist',FALSE,
 EXISTS(SELECT 1 FROM public.driver_memberships),
 'Informational: a membership row is available for real-provider reconciliation'
 UNION ALL SELECT 'confirmed_charge_rows_exist',FALSE,
 EXISTS(SELECT 1 FROM public.driver_membership_charges WHERE status IN ('confirmed','received') AND paid_at IS NOT NULL AND amount_cents IN (4990,5990)),
 'Informational: paid-status 4990/5990 record exists; gateway receipt and contract amount must be verified'
 UNION ALL SELECT 'legacy_status_helper_requires_paid_receipt',TRUE,
 COALESCE(pg_get_functiondef(to_regprocedure('private.driver_subscription_allows_rides(text)')) ILIKE '%driver_membership_charges%',false),
 'Legacy helper must be replaced with verified monthly receipt, not only active/ativa/teste status'
 UNION ALL SELECT 'operational_ride_calls_reference_membership_evidence',TRUE,
 COALESCE((SELECT count(*)=3 AND bool_and(pg_get_functiondef(p.oid) ILIKE '%driver_membership%' OR pg_get_functiondef(p.oid) ILIKE '%paid_membership%') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='apois_rpc_private' AND p.proname IN ('driver_set_presence','driver_accept_ride_candidate_legacy','driver_finish_ride')),false),
 'Live operational RPCs need backend-authoritative paid membership (static heuristic, not E2E proof)'
 UNION ALL SELECT 'monthly_billing_tables_least_privilege',TRUE,
 (
 SELECT count(*)=2 AND bool_and(
  NOT has_table_privilege('anon',c.oid,'SELECT')
  AND NOT has_table_privilege('anon',c.oid,'TRUNCATE')
  AND NOT has_table_privilege('anon',c.oid,'INSERT')
  AND NOT has_table_privilege('anon',c.oid,'UPDATE')
  AND NOT has_table_privilege('anon',c.oid,'DELETE')
  AND has_table_privilege('authenticated',c.oid,'SELECT')
  AND NOT has_table_privilege('authenticated',c.oid,'TRUNCATE')
  AND NOT has_table_privilege('authenticated',c.oid,'INSERT')
  AND NOT has_table_privilege('authenticated',c.oid,'UPDATE')
  AND NOT has_table_privilege('authenticated',c.oid,'DELETE')
  AND has_table_privilege('service_role',c.oid,'UPDATE')
 ) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
   AND c.relname IN ('driver_memberships','driver_membership_charges')
 ),
 'Payment history stays own-SELECT for authenticated, zero anon grants, mutations service-only'
)
SELECT gate,required,ready,detail FROM checks ORDER BY gate;
