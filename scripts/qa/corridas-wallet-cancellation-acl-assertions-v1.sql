-- Execute actual staged ACL in the existing PostgreSQL 17 synthetic DB.
\set ON_ERROR_STOP on
DO $t$
DECLARE t text;n integer;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_wallets','driver_wallet_transactions','cancellation_fees']) LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT')
   OR has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR has_table_privilege('anon','public.'||t,'UPDATE')
   OR has_table_privilege('anon','public.'||t,'DELETE')
   OR has_table_privilege('authenticated','public.'||t,'INSERT')
   OR has_table_privilege('authenticated','public.'||t,'UPDATE')
   OR has_table_privilege('authenticated','public.'||t,'DELETE')
   OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
   OR has_table_privilege('authenticated','public.'||t,'REFERENCES')
   OR has_table_privilege('authenticated','public.'||t,'TRIGGER')
   OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
   OR NOT has_table_privilege('service_role','public.'||t,'UPDATE')
   OR NOT has_table_privilege('service_role','public.'||t,'INSERT')
   OR NOT has_table_privilege('service_role','public.'||t,'DELETE') THEN
    RAISE EXCEPTION 'Financial ACL not least-privilege: %',t;
  END IF;
 END LOOP;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
  AND tablename IN('driver_wallets','driver_wallet_transactions','cancellation_fees')
  AND cmd='SELECT';
 IF n<>3 THEN RAISE EXCEPTION 'Own-read policies were lost'; END IF;
 RAISE NOTICE '[PASS] Financial ACL: anon denied, authenticated SELECT-only, service writes preserved';
END;
$t$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $t$
DECLARE n integer; t text; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.driver_wallets;
 IF n<>1 THEN RAISE EXCEPTION 'Driver A wallet read leaked %',n; END IF;
 SELECT count(*) INTO n FROM public.driver_wallet_transactions;
 IF n<>1 THEN RAISE EXCEPTION 'Driver A wallet transactions leaked %',n; END IF;
 SELECT count(*) INTO n FROM public.cancellation_fees;
 IF n<>1 THEN RAISE EXCEPTION 'Passenger A cancellation fees leaked %',n; END IF;
 FOR t IN SELECT unnest(ARRAY['driver_wallets','driver_wallet_transactions','cancellation_fees']) LOOP
  denied:=false;
  BEGIN
   EXECUTE format('TRUNCATE TABLE public.%I',t);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated TRUNCATE permitted: %',t; END IF;
 END LOOP;
 denied:=false;
 BEGIN
  UPDATE public.driver_wallets SET balance_cents=0
   WHERE driver_id='20000000-0000-4000-8000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Authenticated wallet change succeeded'; END IF;
 RAISE NOTICE '[PASS] Own wallet/fee visibility preserved; TRUNCATE and balance write denied';
END;
$t$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.driver_wallets;
 IF n<>1 THEN RAISE EXCEPTION 'Driver B wallet read leaked %',n; END IF;
 SELECT count(*) INTO n FROM public.driver_wallet_transactions;
 IF n<>1 THEN RAISE EXCEPTION 'Driver B transactions leaked %',n; END IF;
 SELECT count(*) INTO n FROM public.cancellation_fees;
 IF n<>1 THEN RAISE EXCEPTION 'Passenger B fees leaked %',n; END IF;
 RAISE NOTICE '[PASS] Second authenticated identity reads own rows only';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM count(*) FROM public.cancellation_fees;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous cancellation fee SELECT succeeded'; END IF;
 RAISE NOTICE '[PASS] Anonymous financial SELECT denied';
END;
$t$;
COMMIT;
DO $t$
BEGIN
 IF (SELECT count(*) FROM public.driver_wallets)<>2
  OR (SELECT count(*) FROM public.driver_wallet_transactions)<>2
  OR (SELECT count(*) FROM public.cancellation_fees)<>2
  OR (SELECT balance_cents FROM public.driver_wallets
       WHERE driver_id='20000000-0000-4000-8000-000000000001')<>1200 THEN
  RAISE EXCEPTION 'Synthetic wallet/fee values changed during ACL test';
 END IF;
 RAISE NOTICE '[PASS] Financial rows and values untouched by role/RLS regression';
END;
$t$;
