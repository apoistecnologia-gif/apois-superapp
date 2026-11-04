-- APOIS Corridas monthly driver fee: production-derived READ-ONLY diagnostic.
-- No person-identifiable data, payment IDs, mutation, RPC invocation, or providers contacted.
-- Target project: tbbzkrfupmqdywnzgnms. Readiness does NOT certify gateway payment.
WITH checks AS (
 SELECT 'monthly_fee_setting_4990'::text AS gate,TRUE AS required,
 EXISTS(SELECT 1 FROM public.app_settings WHERE key='finance.driver_monthly_fee_cents' AND value#>>'{}'='4990') AS ready,
 'Monthly driver price remains R$49.90'::text AS detail
 UNION ALL SELECT 'membership_amount_constraint_4990',TRUE,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conname='driver_memberships_monthly_fee_cents_check' AND pg_get_constraintdef(oid) LIKE '%4990%'),
 'Membership table rejects fees other than 4990 cents'
 UNION ALL SELECT 'charge_amount_constraint_4990',TRUE,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conname='driver_membership_charges_amount_cents_check' AND pg_get_constraintdef(oid) LIKE '%4990%'),
 'Monthly charge rows reject fees other than 4990 cents'
 UNION ALL SELECT 'membership_tables_rls_on',TRUE,
 (SELECT count(*)=2 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('driver_memberships','driver_membership_charges')),
 'Both billing tables require row-level security'
 UNION ALL SELECT 'membership_rows_exist',FALSE,
 EXISTS(SELECT 1 FROM public.driver_memberships),
 'Informational: a membership row is available for real-provider reconciliation'
 UNION ALL SELECT 'confirmed_charge_rows_exist',FALSE,
 EXISTS(SELECT 1 FROM public.driver_membership_charges WHERE status IN ('confirmed','received') AND paid_at IS NOT NULL AND amount_cents=4990),
 'Informational: paid-status database record exists; gateway receipt must still be verified'
 UNION ALL SELECT 'legacy_status_helper_requires_paid_receipt',TRUE,
 COALESCE(pg_get_functiondef(to_regprocedure('private.driver_subscription_allows_rides(text)')) ILIKE '%driver_membership_charges%',false),
 'Legacy helper must be replaced with verified monthly receipt, not only active/ativa/teste status'
 UNION ALL SELECT 'operational_ride_calls_reference_membership_evidence',TRUE,
 COALESCE((SELECT count(*)=3 AND bool_and(pg_get_functiondef(p.oid) ILIKE '%driver_membership%' OR pg_get_functiondef(p.oid) ILIKE '%paid_membership%') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='apois_rpc_private' AND p.proname IN ('driver_set_presence','driver_accept_ride_candidate_legacy','driver_finish_ride')),false),
 'Live operational RPCs need backend-authoritative paid membership (static heuristic, not E2E proof)'
)
SELECT gate,required,ready,detail FROM checks ORDER BY gate;
