-- APOIS Corridas: staged financial least-privilege ACL (NOT DEPLOYED).
-- Read-only live catalog: all six RLS-enabled tables grant TRUNCATE to
-- anon/authenticated; their RLS SELECT rules are documented below.
-- Preserve authenticated SELECT for five read-enabled tables, but NO client
-- SELECT for payment_webhook_receipts (RLS denies ALL in production).
-- Keep service_role writes; no balance, settlement, provider or data changes.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
 public.driver_payout_destinations,
 public.passenger_wallets,
 public.payment_methods,
 public.payment_webhook_receipts,
 public.ride_pix_payments,
 public.ride_settlements
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
 public.driver_payout_destinations,
 public.passenger_wallets,
 public.payment_methods,
 public.ride_pix_payments,
 public.ride_settlements
TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.driver_payout_destinations,
 public.passenger_wallets,
 public.payment_methods,
 public.payment_webhook_receipts,
 public.ride_pix_payments,
 public.ride_settlements
TO service_role;
COMMIT;
