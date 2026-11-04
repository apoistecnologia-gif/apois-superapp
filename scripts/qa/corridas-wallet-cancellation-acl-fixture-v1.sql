-- Run in the disposable corridas_membership_acl_qa database AFTER its
-- existing identity/role setup and membership ACL assertions. No production.
\set ON_ERROR_STOP on
CREATE TABLE public.driver_wallets(
 driver_id uuid PRIMARY KEY REFERENCES public.drivers(id),balance_cents bigint NOT NULL
);
CREATE TABLE public.driver_wallet_transactions(
 id uuid PRIMARY KEY,driver_id uuid NOT NULL REFERENCES public.drivers(id),amount_cents bigint NOT NULL
);
CREATE TABLE public.cancellation_fees(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL REFERENCES public.users(id),amount_cents bigint NOT NULL
);
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_wallets_read_own ON public.driver_wallets FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.drivers d
 WHERE d.id=driver_wallets.driver_id AND d.user_id=public.mobility_user_id()));
CREATE POLICY driver_wallet_transactions_read_own ON public.driver_wallet_transactions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.drivers d
 WHERE d.id=driver_wallet_transactions.driver_id AND d.user_id=public.mobility_user_id()));
CREATE POLICY cancellation_fees_passenger_read_own ON public.cancellation_fees FOR SELECT TO authenticated
 USING(passenger_id=public.mobility_user_id());
INSERT INTO public.driver_wallets VALUES
 ('20000000-0000-4000-8000-000000000001',1200),
 ('20000000-0000-4000-8000-000000000002',2300);
INSERT INTO public.driver_wallet_transactions VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1200),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',2300);
INSERT INTO public.cancellation_fees VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',500),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',700);
GRANT ALL PRIVILEGES ON TABLE public.driver_wallets,
 public.driver_wallet_transactions,public.cancellation_fees
TO PUBLIC,anon,authenticated,service_role;
DO $t$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_wallets','driver_wallet_transactions','cancellation_fees']) LOOP
  IF NOT has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR NOT has_table_privilege('authenticated','public.'||t,'TRUNCATE') THEN
   RAISE EXCEPTION 'Failed to reproduce TRUNCATE exposure: %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Reproduced broad TRUNCATE on three protected financial tables';
END;
$t$;
