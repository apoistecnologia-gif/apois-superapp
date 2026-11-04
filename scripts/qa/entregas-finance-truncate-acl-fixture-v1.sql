-- Reuse the disconnected synthetic entregas_subscription_acl_qa cluster and roles.
-- No real order, payout, wallet or personal data.
\set ON_ERROR_STOP on
DO $test$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payout_accounts','payouts','refunds','wallet_transactions','wallets']) LOOP
  EXECUTE format('CREATE TABLE public.%I (id integer PRIMARY KEY, note text NOT NULL)',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('INSERT INTO public.%I(id,note) VALUES(1,%L)',t,'synthetic');
  EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO PUBLIC,anon,authenticated,service_role',t);
  IF NOT has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR NOT has_table_privilege('authenticated','public.'||t,'TRUNCATE') THEN
   RAISE EXCEPTION 'Missing production-like TRUNCATE grant on %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Ten Entregas financial tables have production-like broad TRUNCATE grants';
END;
$test$;
