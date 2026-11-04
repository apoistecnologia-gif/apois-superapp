-- Staged APOIS Entregas finance hardening (NOT DEPLOYED).
-- Live read-only catalog: all listed RLS tables grant TRUNCATE to
-- anon/authenticated, a privilege not restricted by row-level security.
-- Narrow remediation: remove ONLY TRUNCATE, preserving all other grants,
-- RLS policies, authenticated flows, prices, cash and manual settlements.
BEGIN;
REVOKE TRUNCATE ON TABLE
 public.courier_settlement_deliveries,
 public.courier_settlements,
 public.payment_events,
 public.payment_transactions,
 public.payments,
 public.payout_accounts,
 public.payouts,
 public.refunds,
 public.wallet_transactions,
 public.wallets
FROM PUBLIC, anon, authenticated;
GRANT TRUNCATE ON TABLE
 public.courier_settlement_deliveries,
 public.courier_settlements,
 public.payment_events,
 public.payment_transactions,
 public.payments,
 public.payout_accounts,
 public.payouts,
 public.refunds,
 public.wallet_transactions,
 public.wallets
TO service_role;
COMMIT;
