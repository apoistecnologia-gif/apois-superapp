-- Actual staged price migration was run in this isolated database.
\set ON_ERROR_STOP on
DO $t$
DECLARE fee text;
BEGIN
 SELECT value#>>'{}' INTO fee FROM public.app_settings
 WHERE key='finance.driver_monthly_fee_cents';
 IF fee <> '5990' THEN RAISE EXCEPTION 'Current driver fee must be 5990: %',fee; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
  WHERE a.attrelid='public.driver_memberships'::regclass AND a.attname='monthly_fee_cents'
  AND pg_get_expr(d.adbin,d.adrelid) LIKE '%5990%') THEN
  RAISE EXCEPTION 'Default driver fee did not change to 5990';
 END IF;
 RAISE NOTICE '[PASS] New driver pricing setting and default exactly R$59.90';
END;
$t$;
INSERT INTO public.driver_memberships(driver_id) VALUES('20000000-0000-4000-8000-000000000002');
INSERT INTO public.driver_membership_charges(amount_cents) VALUES(5990);
DO $t$
DECLARE denied1 boolean:=false;denied2 boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.driver_memberships(driver_id,monthly_fee_cents)
  VALUES('20000000-0000-4000-8000-000000000003',4990);
 EXCEPTION WHEN check_violation THEN denied1:=true;
 END;
 BEGIN
  INSERT INTO public.driver_membership_charges(amount_cents) VALUES(4990);
 EXCEPTION WHEN check_violation THEN denied2:=true;
 END;
 IF NOT denied1 OR NOT denied2 THEN RAISE EXCEPTION 'New 4990 fee improperly allowed'; END IF;
 RAISE NOTICE '[PASS] R$59.90 driver rows accepted and old R$49.90 new rows denied';
END;
$t$;
