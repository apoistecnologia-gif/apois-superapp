-- Actual staged migration executed against disposable PG17.
\set ON_ERROR_STOP on
DO $t$
DECLARE val text;
BEGIN
 SELECT value #>> '{}' INTO val FROM public.platform_settings WHERE key='courier_monthly_amount_cents';
 IF val<>'4990' THEN RAISE EXCEPTION 'Courier fee must be R$49.90: %',val; END IF;
 SELECT value #>> '{}' INTO val FROM public.platform_settings WHERE key='merchant_monthly_amount_cents';
 IF val<>'6990' THEN RAISE EXCEPTION 'Merchant price R$69.90 changed: %',val; END IF;
 IF NOT (SELECT bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relname IN ('courier_monthly_memberships','courier_monthly_charges')) THEN
  RAISE EXCEPTION 'Courier billing RLS missing'; END IF;
 RAISE NOTICE '[PASS] Courier R$49.90 and merchant R$69.90 isolated pricing, courier RLS enabled';
END;
$t$;
INSERT INTO public.courier_monthly_memberships(courier_id) VALUES
('20000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002');
INSERT INTO public.courier_monthly_charges(courier_id) VALUES
('20000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002');
DO $t$
DECLARE denied1 boolean:=false;denied2 boolean:=false;denied3 boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.courier_monthly_memberships(courier_id,monthly_fee_cents)
  VALUES('20000000-0000-4000-8000-000000000003',5990);
 EXCEPTION WHEN check_violation THEN denied1:=true;
 END;
 BEGIN
  INSERT INTO public.courier_monthly_charges(courier_id,amount_cents)
  VALUES('20000000-0000-4000-8000-000000000001',5990);
 EXCEPTION WHEN check_violation THEN denied2:=true;
 END;
 BEGIN
  INSERT INTO public.courier_monthly_charges(courier_id,status)
  VALUES('20000000-0000-4000-8000-000000000001','received');
 EXCEPTION WHEN check_violation THEN denied3:=true;
 END;
 IF NOT denied1 OR NOT denied2 OR NOT denied3 THEN
  RAISE EXCEPTION 'Invalid courier monthly amount or unverified receipt was admitted';
 END IF;
 RAISE NOTICE '[PASS] Only R$49.90 courier records accepted; unverified paid receipts denied';
END;
$t$;
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.courier_monthly_memberships WHERE status='active';
 IF n<>0 THEN RAISE EXCEPTION 'Courier monthly memberships were falsely activated'; END IF;
 RAISE NOTICE '[PASS] Courier billing starts pending; no invented active membership or gateway';
END;
$t$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $t$
DECLARE count_rows integer; denied boolean;
BEGIN
 SELECT count(*) INTO count_rows FROM public.courier_monthly_memberships;
 IF count_rows<>1 THEN RAISE EXCEPTION 'Own courier monthly membership read leaked % rows',count_rows; END IF;
 SELECT count(*) INTO count_rows FROM public.courier_monthly_charges;
 IF count_rows<>1 THEN RAISE EXCEPTION 'Own courier monthly charges read leaked % rows',count_rows; END IF;
 denied:=false;
 BEGIN
  UPDATE public.courier_monthly_memberships SET status='active';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Courier forged active membership'; END IF;
 denied:=false;
 BEGIN
  TRUNCATE public.courier_monthly_charges;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Courier truncated financial records'; END IF;
 RAISE NOTICE '[PASS] Courier reads only own charges and cannot activate/erase subscriptions';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM count(*) FROM public.courier_monthly_memberships;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous courier finance read allowed'; END IF;
 RAISE NOTICE '[PASS] Anonymous caller cannot read courier monthly finance';
END;
$t$;
COMMIT;
