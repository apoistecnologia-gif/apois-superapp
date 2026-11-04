\set ON_ERROR_STOP on
DO $t$
DECLARE t text; expected_select boolean; n int;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_payout_destinations','passenger_wallets','payment_methods',
 'payment_webhook_receipts','ride_pix_payments','ride_settlements']) LOOP
  expected_select := t<>'payment_webhook_receipts';
  IF has_table_privilege('anon','public.'||t,'SELECT')
   OR has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR has_table_privilege('anon','public.'||t,'UPDATE')
   OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
   OR has_table_privilege('authenticated','public.'||t,'INSERT')
   OR has_table_privilege('authenticated','public.'||t,'UPDATE')
   OR has_table_privilege('authenticated','public.'||t,'DELETE')
   OR has_table_privilege('authenticated','public.'||t,'REFERENCES')
   OR has_table_privilege('authenticated','public.'||t,'TRIGGER')
   OR has_table_privilege('authenticated','public.'||t,'SELECT') IS DISTINCT FROM expected_select
   OR NOT has_table_privilege('service_role','public.'||t,'INSERT')
   OR NOT has_table_privilege('service_role','public.'||t,'UPDATE')
   OR NOT has_table_privilege('service_role','public.'||t,'DELETE') THEN
   RAISE EXCEPTION 'Payment/payout financial ACL wrong: %',t;
  END IF;
 END LOOP;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('driver_payout_destinations','passenger_wallets','payment_methods',
  'payment_webhook_receipts','ride_pix_payments','ride_settlements');
 IF n<>9 THEN RAISE EXCEPTION 'Synthetic finance read/deny policies missing: %',n; END IF;
 RAISE NOTICE '[PASS] Six finance ACLs deny anon and writes; only 5 tables allow client SELECT';
END;
$t$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $t$
DECLARE n int;t text;denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.driver_payout_destinations;
 IF n<>1 THEN RAISE EXCEPTION 'Driver A payout destinations leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.passenger_wallets;
 IF n<>1 THEN RAISE EXCEPTION 'Passenger A wallet leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.ride_pix_payments;
 IF n<>1 THEN RAISE EXCEPTION 'Driver A/Passenger A Pix records leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.ride_settlements;
 IF n<>1 THEN RAISE EXCEPTION 'Driver/Passenger A settlements leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.payment_methods;
 IF n<>1 THEN RAISE EXCEPTION 'Active payment methods wrong: %',n; END IF;
 denied:=false;
 BEGIN
  PERFORM count(*) FROM public.payment_webhook_receipts;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Client read payment webhook receipts'; END IF;
 FOR t IN SELECT unnest(ARRAY['driver_payout_destinations','passenger_wallets','payment_methods',
 'payment_webhook_receipts','ride_pix_payments','ride_settlements']) LOOP
  denied:=false;
  BEGIN
   EXECUTE format('TRUNCATE TABLE public.%I',t);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated TRUNCATE succeeded: %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Client A own-select, catalog active-only, webhook secret and TRUNCATE denied';
END;
$t$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $t$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM public.driver_payout_destinations;
 IF n<>1 THEN RAISE EXCEPTION 'Driver B payout destination leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.passenger_wallets;
 IF n<>1 THEN RAISE EXCEPTION 'Passenger B wallet leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.ride_pix_payments;
 IF n<>1 THEN RAISE EXCEPTION 'Rider B Pix record leaked: %',n; END IF;
 SELECT count(*) INTO n FROM public.ride_settlements;
 IF n<>1 THEN RAISE EXCEPTION 'Rider B settlement leaked: %',n; END IF;
 RAISE NOTICE '[PASS] Second identity remains restricted to its own finance records';
END;
$t$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
DO $t$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM public.ride_settlements;
 IF n<>2 THEN RAISE EXCEPTION 'Synthetic finance admin lost settlement read: %',n; END IF;
 RAISE NOTICE '[PASS] Finance admin authorized cross-driver settlement READ retained';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM count(*) FROM public.payment_methods;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous payment catalog was readable'; END IF;
 RAISE NOTICE '[PASS] Anonymous cannot read payment catalog';
END;
$t$;
COMMIT;
DO $t$
BEGIN
 IF (SELECT count(*) FROM public.driver_payout_destinations)<>2
  OR (SELECT count(*) FROM public.passenger_wallets)<>2
  OR (SELECT count(*) FROM public.payment_methods)<>2
  OR (SELECT count(*) FROM public.payment_webhook_receipts)<>1
  OR (SELECT count(*) FROM public.ride_pix_payments)<>2
  OR (SELECT count(*) FROM public.ride_settlements)<>2 THEN
  RAISE EXCEPTION 'Synthetic financial rows changed while checking grants';
 END IF;
 RAISE NOTICE '[PASS] All payment, payout and settlement synthetic data preserved';
END;
$t$;
