-- APOIS Entregas courier monthly commercial contract, SELECT only.
-- Check target Supabase ptgkwyyolrdgnqketkjj. Never reads personal data.
-- No provider verified / no courier paid status / no dispatch enforcement yet.
WITH gate AS (
 SELECT 'merchant_monthly_price_6990'::text AS gate,true AS required,
  EXISTS(SELECT 1 FROM public.platform_settings WHERE key='merchant_monthly_amount_cents'
    AND value#>>'{}'='6990') AS ready,
  'Merchant plan remains R$69.90'::text AS detail
 UNION ALL SELECT 'courier_monthly_price_4990',true,
  EXISTS(SELECT 1 FROM public.platform_settings WHERE key='courier_monthly_amount_cents'
    AND value#>>'{}'='4990'),
  'Courier plan must be set to R$49.90'
 UNION ALL SELECT 'courier_monthly_tables_and_rls',true,
  (SELECT count(*)=2 AND bool_and(c.relrowsecurity)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN('courier_monthly_memberships','courier_monthly_charges')),
  'Both courier membership and charge tables need RLS'
 UNION ALL SELECT 'courier_monthly_service_only_writes',true,
  (SELECT count(*)=2 AND bool_and(
    has_table_privilege('authenticated',c.oid,'SELECT')
    AND NOT has_table_privilege('authenticated',c.oid,'UPDATE')
    AND NOT has_table_privilege('authenticated',c.oid,'TRUNCATE')
    AND NOT has_table_privilege('anon',c.oid,'SELECT')
    AND NOT has_table_privilege('anon',c.oid,'TRUNCATE')
    AND has_table_privilege('service_role',c.oid,'UPDATE')
   ) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('courier_monthly_memberships','courier_monthly_charges')),
  'Courier may read own records while financial mutation remains server-only'
 UNION ALL SELECT 'courier_acceptance_requires_paid_membership',true,
  coalesce(pg_get_functiondef(to_regprocedure('public.accept_delivery_offer(uuid)')) ILIKE '%courier_monthly%',false),
  'Courier offer acceptance must verify a real paid and unexpired monthly entitlement (not yet implemented)'
 UNION ALL SELECT 'courier_monthly_provider_webhook_verified',true,
  false,
  'Payment provider/webhook not yet selected, authorized or E2E verified: launch BLOCKED'
)
SELECT gate,required,ready,detail FROM gate ORDER BY gate;
