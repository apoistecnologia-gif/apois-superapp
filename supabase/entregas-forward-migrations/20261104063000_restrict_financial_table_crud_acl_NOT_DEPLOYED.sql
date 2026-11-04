-- APOIS Entregas — additional least-privilege after 04/11 TRUNCATE fix.
-- NOT DEPLOYED. Source: live production pg_policies + pg_catalog SELECT only.
-- Nine financial tables have SELECT-only authenticated RLS policies;
-- payout_accounts uniquely allows wallet-owner INSERT + UPDATE + SELECT.
-- Never remove legitimate payout account management permissions.
-- Guard rejects any policy/schema drift before changing grants.
BEGIN;
DO $apois_finance_acl_preflight$
DECLARE v_n integer;
BEGIN
 SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets','payout_accounts') AND c.relrowsecurity;
 IF v_n<>10 THEN RAISE EXCEPTION 'APOIS_FINANCE_ACL_SCHEMA_OR_RLS_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
 AND p.tablename IN ('courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets')
 AND p.cmd<>'SELECT') THEN
   RAISE EXCEPTION 'APOIS_FINANCE_ACL_WRITE_POLICY_DRIFT' USING ERRCODE='55000';
 END IF;
 -- The three real payout-account policies must continue to bind reads,
 -- inserts and updates to the wallet owner. A syntactically valid but
 -- permissive replacement policy must fail before client write grants.
 IF (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public'
  AND p.tablename='payout_accounts') <> 3
 OR NOT EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
  AND p.tablename='payout_accounts'
  AND p.policyname='Owners view payout accounts' AND p.cmd='SELECT'
  AND p.roles @> ARRAY['authenticated']::name[]
  AND p.qual ILIKE '%current_user_owns_wallet(wallet_id)%')
 OR NOT EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
  AND p.tablename='payout_accounts'
  AND p.policyname='Owners create payout accounts' AND p.cmd='INSERT'
  AND p.roles @> ARRAY['authenticated']::name[]
  AND p.with_check ILIKE '%current_user_owns_wallet(wallet_id)%')
 OR NOT EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
  AND p.tablename='payout_accounts'
  AND p.policyname='Owners update payout accounts' AND p.cmd='UPDATE'
  AND p.roles @> ARRAY['authenticated']::name[]
  AND p.qual ILIKE '%current_user_owns_wallet(wallet_id)%'
  AND p.with_check ILIKE '%current_user_owns_wallet(wallet_id)%') THEN
   RAISE EXCEPTION 'APOIS_PAYOUT_ACCOUNT_OWNER_POLICY_DRIFT' USING ERRCODE='55000';
 END IF;
END;
$apois_finance_acl_preflight$;
REVOKE ALL PRIVILEGES ON TABLE
 public.courier_settlement_deliveries,
 public.courier_settlements,
 public.payment_events,
 public.payment_transactions,
 public.payments,
 public.payouts,
 public.refunds,
 public.wallet_transactions,
 public.wallets,
 public.payout_accounts
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
 public.courier_settlement_deliveries,
 public.courier_settlements,
 public.payment_events,
 public.payment_transactions,
 public.payments,
 public.payouts,
 public.refunds,
 public.wallet_transactions,
 public.wallets,
 public.payout_accounts
TO authenticated;
-- ONLY payout_accounts retains client writes, subject to existing wallet-owner RLS.
GRANT INSERT, UPDATE ON TABLE public.payout_accounts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.courier_settlement_deliveries,
 public.courier_settlements,
 public.payment_events,
 public.payment_transactions,
 public.payments,
 public.payouts,
 public.refunds,
 public.wallet_transactions,
 public.wallets,
 public.payout_accounts
TO service_role;
COMMIT;
