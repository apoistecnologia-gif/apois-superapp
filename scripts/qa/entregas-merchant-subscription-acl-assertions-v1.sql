-- Real staged migration has been applied to this disposable database only.
\set ON_ERROR_STOP on
DO $t$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY[
  'merchant_subscriptions','merchant_subscription_payments','merchant_subscription_events'
 ]) LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT')
    OR has_table_privilege('anon','public.'||t,'INSERT')
    OR has_table_privilege('anon','public.'||t,'UPDATE')
    OR has_table_privilege('anon','public.'||t,'DELETE')
    OR has_table_privilege('anon','public.'||t,'TRUNCATE')
    OR has_table_privilege('anon','public.'||t,'REFERENCES')
    OR has_table_privilege('anon','public.'||t,'TRIGGER')
    OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
    OR has_table_privilege('authenticated','public.'||t,'INSERT')
    OR has_table_privilege('authenticated','public.'||t,'UPDATE')
    OR has_table_privilege('authenticated','public.'||t,'DELETE')
    OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
    OR has_table_privilege('authenticated','public.'||t,'REFERENCES')
    OR has_table_privilege('authenticated','public.'||t,'TRIGGER')
    OR NOT has_table_privilege('service_role','public.'||t,'SELECT')
    OR NOT has_table_privilege('service_role','public.'||t,'INSERT')
    OR NOT has_table_privilege('service_role','public.'||t,'UPDATE')
    OR NOT has_table_privilege('service_role','public.'||t,'DELETE')
  THEN RAISE EXCEPTION 'Invalid merchant financial ACL: %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Merchant financial table ACL: anon denied, authenticated own-SELECT, backend service writes';
END;
$t$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $t$
DECLARE n integer; t text; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.merchant_subscriptions;
 IF n<>1 THEN RAISE EXCEPTION 'Merchant subscription SELECT leaked % rows',n; END IF;
 SELECT count(*) INTO n FROM public.merchant_subscription_payments;
 IF n<>1 THEN RAISE EXCEPTION 'Merchant payments SELECT leaked % rows',n; END IF;
 SELECT count(*) INTO n FROM public.merchant_subscription_events;
 IF n<>1 THEN RAISE EXCEPTION 'Merchant events SELECT leaked % rows',n; END IF;
 FOR t IN SELECT unnest(ARRAY[
  'merchant_subscriptions','merchant_subscription_payments','merchant_subscription_events'
 ]) LOOP
  denied:=false;
  BEGIN EXECUTE 'TRUNCATE public.'||t; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Merchant was allowed to TRUNCATE %',t; END IF;
  denied:=false;
  BEGIN EXECUTE 'UPDATE public.'||t||' SET id=id'; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Merchant was allowed to UPDATE %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Merchant can see own subscription/payment/event but cannot UPDATE or TRUNCATE';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.merchant_subscriptions;
 IF n<>2 THEN RAISE EXCEPTION 'Admin lost subscription read access: %',n; END IF;
 SELECT count(*) INTO n FROM public.merchant_subscription_payments;
 IF n<>2 THEN RAISE EXCEPTION 'Admin lost payment read access: %',n; END IF;
 SELECT count(*) INTO n FROM public.merchant_subscription_events;
 IF n<>2 THEN RAISE EXCEPTION 'Admin lost event read access: %',n; END IF;
 RAISE NOTICE '[PASS] Authenticated administrator retains cross-merchant read access via existing policy';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM count(*) FROM public.merchant_subscriptions;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous role read merchant subscription'; END IF;
 RAISE NOTICE '[PASS] Anonymous role denied subscription SELECT';
END;
$t$;
COMMIT;
DO $t$
BEGIN
 IF (SELECT count(*) FROM public.merchant_subscriptions)<>2
  OR (SELECT count(*) FROM public.merchant_subscription_payments)<>2
  OR (SELECT count(*) FROM public.merchant_subscription_events)<>2
 THEN RAISE EXCEPTION 'Merchant billing sample changed during ACL assertions'; END IF;
 RAISE NOTICE '[PASS] Test merchant billing records and direct payment model unchanged';
END;
$t$;
