-- Entregas financial tables: staged ACL hardening, no production deployment.
-- Verified against actual pg_catalog / pg_policies on 2026-11-04:
-- all three tables have RLS, exactly own/admin SELECT policies, but anon and
-- authenticated retain full grants including TRUNCATE (not guarded by RLS).
-- Preserve establishment/admin SELECT via unchanged RLS policies; only server
-- service_role may modify subscription, payment and idempotent event records.
-- Does not activate a provider, charge any customer or change monthly R$69.90.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
 public.merchant_subscriptions,
 public.merchant_subscription_payments,
 public.merchant_subscription_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
 public.merchant_subscriptions,
 public.merchant_subscription_payments,
 public.merchant_subscription_events
TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.merchant_subscriptions,
 public.merchant_subscription_payments,
 public.merchant_subscription_events
TO service_role;
COMMIT;
