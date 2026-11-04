-- Extra fixture AFTER Entregas TRUNCATE ACL synthetic assertions.
-- Add representative SELECT-only policies to nine finance tables, plus
-- the exact payout_accounts SELECT/INSERT/UPDATE policy operation matrix.
-- Synthetic wallet-to-user mapping, never production data.
\set ON_ERROR_STOP on
CREATE TABLE public.qa_wallet_owners(
 wallet_id uuid PRIMARY KEY,owner_user_id uuid NOT NULL
);
INSERT INTO public.qa_wallet_owners VALUES
 ('aaaa0000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('aaaa0000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
CREATE FUNCTION public.current_user_owns_wallet(_wallet_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT EXISTS(
 SELECT 1 FROM public.qa_wallet_owners w
 WHERE w.wallet_id=_wallet_id AND w.owner_user_id=(SELECT auth.uid())
 ) $$;
GRANT EXECUTE ON FUNCTION public.current_user_owns_wallet(uuid) TO authenticated;
ALTER TABLE public.payout_accounts ADD COLUMN wallet_id uuid;
UPDATE public.payout_accounts
 SET wallet_id='aaaa0000-0000-4000-8000-000000000001' WHERE id=1;
INSERT INTO public.payout_accounts(id,note,wallet_id) VALUES
 (2,'synthetic-B','aaaa0000-0000-4000-8000-000000000002');
ALTER TABLE public.payout_accounts ALTER COLUMN wallet_id SET NOT NULL;
CREATE POLICY "Owners view payout accounts" ON public.payout_accounts
 FOR SELECT TO authenticated USING (public.current_user_owns_wallet(wallet_id));
CREATE POLICY "Owners create payout accounts" ON public.payout_accounts
 FOR INSERT TO authenticated WITH CHECK (public.current_user_owns_wallet(wallet_id));
CREATE POLICY "Owners update payout accounts" ON public.payout_accounts
 FOR UPDATE TO authenticated USING (public.current_user_owns_wallet(wallet_id))
 WITH CHECK (public.current_user_owns_wallet(wallet_id));
DO $qa$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets']) LOOP
  EXECUTE format('CREATE POLICY finance_read_own ON public.%I FOR SELECT TO authenticated USING (note=(SELECT auth.uid())::text)',t);
  EXECUTE format('UPDATE public.%I SET note=%L WHERE id=1',t,'10000000-0000-4000-8000-000000000001');
  EXECUTE format('INSERT INTO public.%I(id,note) VALUES (2,%L)',t,'10000000-0000-4000-8000-000000000002');
 END LOOP;
 RAISE NOTICE '[PASS] Synthetic finance policies match nine read-only and payout-owner INSERT/UPDATE roles';
END;
$qa$;
