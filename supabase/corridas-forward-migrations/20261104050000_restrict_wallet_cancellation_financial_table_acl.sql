-- Staged Corridas financial ACL hardening: NOT DEPLOYED.
-- Read-only pg_catalog/pg_policies confirmed on 04/11/2026 that the
-- RLS-enabled driver wallets, wallet transactions and cancellation fees
-- grant TRUNCATE to anon and authenticated. RLS does not guard TRUNCATE.
-- Preserve authenticated own-SELECT policies and service_role mutations.
-- No balance, cancellation fee, rate, subscription or payment changes.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
 public.driver_wallets, public.driver_wallet_transactions, public.cancellation_fees
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
 public.driver_wallets, public.driver_wallet_transactions, public.cancellation_fees
TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.driver_wallets, public.driver_wallet_transactions, public.cancellation_fees
TO service_role;
COMMIT;
