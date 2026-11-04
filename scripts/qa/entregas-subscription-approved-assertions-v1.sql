-- Disposable PostgreSQL regression after the forward hardening above.
\set ON_ERROR_STOP on
INSERT INTO public.merchants(id,name,is_active,approval_status) VALUES
('11111111-1111-4111-8111-111111111111','Pending test merchant',true,'pending'),
('22222222-2222-4222-8222-222222222222','Inactive approved',false,'approved'),
('33333333-3333-4333-8333-333333333333','Approved with expired monthly plan',true,'approved');
INSERT INTO public.merchant_subscriptions(merchant_id,current_period_end,last_payment_status,metadata) VALUES
('11111111-1111-4111-8111-111111111111',now()+interval '30 days','approved','{"environment":"production"}'),
('22222222-2222-4222-8222-222222222222',now()+interval '30 days','approved','{"environment":"production"}'),
('33333333-3333-4333-8333-333333333333',now()-interval '1 day','approved','{"environment":"production"}');
DO $check$
DECLARE id uuid; verdict boolean; denied boolean; message text; before_count integer;
BEGIN
 FOR id IN SELECT * FROM (VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid),
  ('33333333-3333-4333-8333-333333333333'::uuid),
  ('44444444-4444-4444-8444-444444444444'::uuid)
 ) t(v) LOOP
  verdict:=public.merchant_subscription_in_good_standing(id);
  IF verdict IS DISTINCT FROM false THEN RAISE EXCEPTION 'Unqualified merchant eligible: % %',id,verdict; END IF;
 END LOOP;
 -- Existing legacy paid plan still qualifies; re-activate QA token only inside fixture.
 IF public.merchant_subscription_in_good_standing('cccccccc-cccc-4ccc-8ccc-cccccccccccc') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Legacy paid approved merchant lost access'; END IF;
 UPDATE private.apois_test_cash_access SET enabled=true,expires_at=now()+interval '1 day'
 WHERE merchant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 IF public.merchant_subscription_in_good_standing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Explicit QA merchant lost access'; END IF;
 SELECT count(*) INTO before_count FROM public.orders;
 FOR id IN SELECT * FROM (VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid),
  ('33333333-3333-4333-8333-333333333333'::uuid)
 ) t(v) LOOP
  denied:=false;
  BEGIN
   INSERT INTO public.orders(merchant_id,customer_user_id,payment_method,payment_status)
   VALUES(id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','pix','pending');
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
   IF message<>'merchant subscription inactive' THEN RAISE; END IF;
   denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unqualified merchant inserted order: %',id; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.orders)<>before_count
 THEN RAISE EXCEPTION 'Failed insert mutated orders'; END IF;
 RAISE NOTICE '[PASS] Subscription entitlement rejects unknown, pending, inactive and expired merchants';
 RAISE NOTICE '[PASS] Existing approved paid and explicitly authorized QA merchants preserved';
END;
$check$;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.merchant_subscription_in_good_standing(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous may execute subscription SECURITY DEFINER'; END IF;
 IF NOT has_function_privilege('authenticated','public.merchant_subscription_in_good_standing(uuid)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.merchant_subscription_in_good_standing(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Required authenticated/service-role privileges missing'; END IF;
 RAISE NOTICE '[PASS] Subscription SECURITY DEFINER rejects anon, preserves authenticated/service-role';
END;
$acl$;
