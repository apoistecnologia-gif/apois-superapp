\set ON_ERROR_STOP on
DO $test$
DECLARE t text;n boolean;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payout_accounts','payouts','refunds','wallet_transactions','wallets']) LOOP
  IF has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
   OR NOT has_table_privilege('service_role','public.'||t,'TRUNCATE')
   OR NOT has_table_privilege('anon','public.'||t,'SELECT')
   OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
   OR NOT has_table_privilege('authenticated','public.'||t,'UPDATE') THEN
   RAISE EXCEPTION 'Entregas TRUNCATE ACL failed / unrelated grants changed: %',t;
  END IF;
  SELECT c.relrowsecurity INTO STRICT n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relname=t;
  -- Verify RLS without touching synthetic rows.
  IF n IS DISTINCT FROM true THEN RAISE EXCEPTION 'Synthetic RLS was removed from %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Entregas anon/authenticated TRUNCATE removed; other grants and service retained';
END;
$test$;
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE t text; denied boolean;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payout_accounts','payouts','refunds','wallet_transactions','wallets']) LOOP
  denied:=false;
  BEGIN
   EXECUTE format('TRUNCATE TABLE public.%I',t);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated TRUNCATE succeeded: %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Real authenticated role denied TRUNCATE of ten synthetic finance tables';
END;
$test$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  TRUNCATE TABLE public.payments;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous user TRUNCATE payments succeeded'; END IF;
 RAISE NOTICE '[PASS] Anonymous SQL role cannot truncate protected payments';
END;
$test$;
COMMIT;
DO $test$
DECLARE t text;n int;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payout_accounts','payouts','refunds','wallet_transactions','wallets']) LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'Synthetic row changed: %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] All ten synthetic finance tables retained their rows';
END;
$test$;
