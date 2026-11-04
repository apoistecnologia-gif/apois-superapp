-- Execute after ACTUAL staged ACL SQL against disposable PostgreSQL 17.
\set ON_ERROR_STOP on
DO $qa$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets','payout_accounts']) LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT')
   OR has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR has_table_privilege('anon','public.'||t,'UPDATE')
   OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
   OR has_table_privilege('authenticated','public.'||t,'DELETE')
   OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
   OR has_table_privilege('authenticated','public.'||t,'REFERENCES')
   OR has_table_privilege('authenticated','public.'||t,'TRIGGER')
   OR NOT has_table_privilege('service_role','public.'||t,'UPDATE')
   OR NOT has_table_privilege('service_role','public.'||t,'INSERT')
   OR NOT has_table_privilege('service_role','public.'||t,'TRUNCATE') THEN
    RAISE EXCEPTION 'Finance least-privilege ACL failed: %',t;
  END IF;
  IF t='payout_accounts' THEN
    IF NOT has_table_privilege('authenticated','public.'||t,'INSERT')
      OR NOT has_table_privilege('authenticated','public.'||t,'UPDATE') THEN
     RAISE EXCEPTION 'Owner payout-account mutation permission lost';
    END IF;
  ELSIF has_table_privilege('authenticated','public.'||t,'INSERT')
      OR has_table_privilege('authenticated','public.'||t,'UPDATE') THEN
    RAISE EXCEPTION 'Client may change backend-owned financial table %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Nine financial tables read-only; payout_accounts preserves RLS owner writes only';
END;
$qa$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $qa$
DECLARE t text;n integer; denied boolean; affected integer;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets']) LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'Wrong own SELECT count for %: %',t,n; END IF;
  denied:=false;
  BEGIN
    EXECUTE format('UPDATE public.%I SET note=note WHERE id=1',t);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Backend-owned finance row updated by client: %',t; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM public.payout_accounts;
 IF n<>1 THEN RAISE EXCEPTION 'Owner A payout_accounts own SELECT failed: %',n; END IF;
 UPDATE public.payout_accounts SET note='owner A edit' WHERE id=1;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Owner A legitimate update failed'; END IF;
 UPDATE public.payout_accounts SET note='forbidden owner B edit' WHERE id=2;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Owner A updated owner B payout account'; END IF;
 INSERT INTO public.payout_accounts(id,note,wallet_id)
 VALUES(3,'owner A new','aaaa0000-0000-4000-8000-000000000001');
 denied:=false;
 BEGIN
  INSERT INTO public.payout_accounts(id,note,wallet_id)
  VALUES(4,'bad cross wallet','aaaa0000-0000-4000-8000-000000000002');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Owner A inserted owner B payout account'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.payout_accounts SET wallet_id='aaaa0000-0000-4000-8000-000000000002'
  WHERE id=1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Owner A transferred own payout account to owner B'; END IF;
 RAISE NOTICE '[PASS] Two-owner RLS: legitimate payout INSERT/UPDATE preserved, cross-owner writes denied';
END;
$qa$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM count(*) FROM public.payout_accounts;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous client read payout_accounts'; END IF;
 RAISE NOTICE '[PASS] Anonymous cannot read financial payout accounts';
END;
$qa$;
ROLLBACK;
DO $qa$
DECLARE t text;n integer;
BEGIN
 FOR t IN SELECT unnest(ARRAY['courier_settlement_deliveries','courier_settlements','payment_events','payment_transactions','payments','payouts','refunds','wallet_transactions','wallets']) LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>2 THEN RAISE EXCEPTION 'Financial synthetic rows changed for %: %',t,n; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.payout_accounts)<>2
   OR (SELECT note FROM public.payout_accounts WHERE id=1)<>'synthetic' THEN
  RAISE EXCEPTION 'Payout owner transaction rollback failed';
 END IF;
 RAISE NOTICE '[PASS] All synthetic finance rows and payout owner records unchanged';
END;
$qa$;
