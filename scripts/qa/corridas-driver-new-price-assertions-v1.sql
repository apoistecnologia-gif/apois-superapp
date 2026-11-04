-- Execute AFTER the REAL staged migration against disposable PG17.
\set ON_ERROR_STOP on
DO $qa$
DECLARE caught boolean;
BEGIN
 IF (SELECT value#>>'{}' FROM public.app_settings WHERE key='finance.driver_monthly_fee_cents')<>'5990' THEN
  RAISE EXCEPTION 'New driver commercial setting was not changed';
 END IF;
 IF (SELECT monthly_fee_cents FROM public.driver_memberships
 WHERE driver_id='11111111-1111-4111-8111-111111111111')<>4990
 OR (SELECT amount_cents FROM public.driver_membership_charges WHERE id=1)<>4990 THEN
  RAISE EXCEPTION 'Existing legacy contract/charge was repriced';
 END IF;
 INSERT INTO public.driver_memberships(driver_id)
 VALUES('22222222-2222-4222-8222-222222222222');
 IF (SELECT monthly_fee_cents FROM public.driver_memberships
 WHERE driver_id='22222222-2222-4222-8222-222222222222')<>5990 THEN
  RAISE EXCEPTION 'New membership did not default to 5990';
 END IF;
 caught:=false;
 BEGIN
  INSERT INTO public.driver_memberships(driver_id,monthly_fee_cents)
   VALUES('33333333-3333-4333-8333-333333333333',4990);
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'New 4990 membership incorrectly accepted'; END IF;
 caught:=false;
 BEGIN
  UPDATE public.driver_memberships SET monthly_fee_cents=5990
  WHERE driver_id='11111111-1111-4111-8111-111111111111';
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Legacy membership repricing unexpectedly accepted'; END IF;
 caught:=false;
 BEGIN
  UPDATE public.driver_memberships SET monthly_fee_cents=4990
  WHERE driver_id='22222222-2222-4222-8222-222222222222';
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'New membership downgraded to old fee'; END IF;
 -- An old contracted 4990 driver may still renew after the policy cutover.
 INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
 VALUES('11111111-1111-4111-8111-111111111111',4990);
 INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
 VALUES('22222222-2222-4222-8222-222222222222',5990);
 caught:=false;
 BEGIN
  INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
  VALUES('22222222-2222-4222-8222-222222222222',4990);
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'New driver was charged legacy 4990'; END IF;
 caught:=false;
 BEGIN
  INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
  VALUES('11111111-1111-4111-8111-111111111111',5990);
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Legacy driver was charged new 5990'; END IF;
 caught:=false;
 BEGIN
  INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
  VALUES('44444444-4444-4444-8444-444444444444',5990);
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Orphan charge was incorrectly accepted'; END IF;
 caught:=false;
 BEGIN
  INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
  VALUES('22222222-2222-4222-8222-222222222222',6990);
 EXCEPTION WHEN check_violation THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Merchant fee 6990 was allowed as driver fee'; END IF;
 UPDATE public.driver_memberships SET status='active'
 WHERE driver_id='11111111-1111-4111-8111-111111111111';
 UPDATE public.driver_membership_charges SET status='confirmed' WHERE id=1;
 IF (SELECT count(*) FROM public.driver_membership_charges)<>3 THEN
  RAISE EXCEPTION 'Unexpected charge count after positive/negative tests';
 END IF;
 RAISE NOTICE '[PASS] 5990 for new drivers; existing 4990 contract unchanged and renewable; cross-contract charges rejected';
END;$qa$;
DO $qa$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
 'apois_driver_new_membership_fee_guard','apois_driver_charge_contract_amount_guard'))<>2 THEN
  RAISE EXCEPTION 'Driver commercial fee validation triggers not installed';
 END IF;
 IF (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d
 JOIN pg_class c ON c.oid=d.adrelid JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.adnum
 WHERE c.relname='driver_memberships' AND a.attname='monthly_fee_cents')<>'5990' THEN
  RAISE EXCEPTION 'New membership default is not 5990';
 END IF;
 RAISE NOTICE '[PASS] Price-cutover schema contains two backend immutable-contract guards';
END;$qa$;
