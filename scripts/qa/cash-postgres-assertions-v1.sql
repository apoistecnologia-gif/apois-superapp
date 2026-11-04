-- Real PostgreSQL execution with synthetic role/session, never production.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
-- Owner A is authorized by production-style merchants.owner_user_id, not a test tenant setting.
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.orders;
 IF n<>4 THEN RAISE EXCEPTION 'RLS orders expected 4 own records, saw %',n; END IF;
 SELECT count(*) INTO n FROM public.order_items;
 IF n<>1 THEN RAISE EXCEPTION 'RLS order_items leaked or hid records: %',n; END IF;
 SELECT count(*) INTO n FROM public.order_status_history;
 IF n<>1 THEN RAISE EXCEPTION 'RLS history leaked or hid records: %',n; END IF;
 RAISE NOTICE '[PASS] Cash pending order, item and history RLS are merchant-scoped';
END;
$test$;

-- Exercise exact ownership/member/status/profile/admin branches from the
-- production helper logic. All tests run as authenticated with synthetic JWT
-- subject; the real API still must validate JWT signature externally.
DO $test$
DECLARE test_id uuid; expected_orders integer; expected_details integer; actual_orders integer;
 actual_items integer; actual_history integer;
BEGIN
 FOR test_id,expected_orders,expected_details IN
  SELECT * FROM (VALUES
   ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,4,1), -- A owner
   ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,1,1), -- B owner
   ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,4,1), -- active A staff
   ('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,0,0), -- suspended A staff
   ('66666666-6666-4666-8666-666666666666'::uuid,0,0), -- removed A staff
   ('77777777-7777-4777-8777-777777777777'::uuid,0,0), -- disabled profile
   ('88888888-8888-4888-8888-888888888888'::uuid,5,2), -- admin
   ('99999999-9999-4999-8999-999999999999'::uuid,0,0)  -- outsider
  ) cases(uid,orders,details)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',test_id::text,true);
  SELECT count(*) INTO actual_orders FROM public.orders;
  SELECT count(*) INTO actual_items FROM public.order_items;
  SELECT count(*) INTO actual_history FROM public.order_status_history;
  IF actual_orders<>expected_orders OR actual_items<>expected_details OR actual_history<>expected_details THEN
   RAISE EXCEPTION 'JWT %: expected %/% items and orders, got orders %, items %, history %',
      test_id,expected_orders,expected_details,actual_orders,actual_items,actual_history;
  END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
 RAISE NOTICE '[PASS] Eight isolated JWT role/ownership/RLS states, including revoked and inactive accounts';
END;
$test$;

-- A rejected/suspended/inactive/nonmember cannot use SECURITY DEFINER
-- merchant_reject_order even when they know another merchant's order UUID.
DO $test$
DECLARE test_id uuid; rejected boolean;
BEGIN
 FOR test_id IN SELECT * FROM (VALUES
  ('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid),
  ('66666666-6666-4666-8666-666666666666'::uuid),
  ('77777777-7777-4777-8777-777777777777'::uuid),
  ('99999999-9999-4999-8999-999999999999'::uuid),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid)
 ) cases(uid) LOOP
  PERFORM set_config('request.jwt.claim.sub',test_id::text,true);
  rejected:=false;
  BEGIN
   PERFORM public.merchant_reject_order('11111111-1111-4111-8111-111111111111','cross tenant');
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'merchant access required' THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unauthorized role could cancel cash order: %',test_id; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
 RAISE NOTICE '[PASS] Five unauthorized member/tenant cancellation attempts denied';
END;
$test$;

-- Valid cash/pending cancellation without payment record.
SELECT public.merchant_reject_order('11111111-1111-4111-8111-111111111111','cash test cancellation');

-- Cash with an inconsistent payment record must fail before job/offer/refund mutations.
DO $test$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order('33333333-3333-4333-8333-333333333333','unexpected gateway');
 EXCEPTION WHEN SQLSTATE '55000' THEN
  IF SQLERRM <> 'cash_gateway_payment_record_requires_manual_reconciliation' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'cash with payment was not blocked'; END IF;
 RAISE NOTICE '[PASS] Cash + gateway record fails closed';
END;
$test$;

-- Cash marked paid without provider evidence must not create an electronic refund.
DO $test$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order('44444444-4444-4444-8444-444444444444','cash paid inconsistency');
 EXCEPTION WHEN SQLSTATE '55000' THEN
  IF SQLERRM <> 'cash_payment_state_requires_manual_reconciliation' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'cash paid mismatch was not blocked'; END IF;
 RAISE NOTICE '[PASS] Cash non-pending fails closed';
END;
$test$;

-- Electronic paid cancellation keeps the pre-existing refund behavior.
SELECT public.merchant_reject_order('55555555-5555-4555-8555-555555555555','electronic regression');

-- Wrong merchant cannot reject another merchant's order.
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
DO $test$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order('11111111-1111-4111-8111-111111111111','unowned order');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'merchant access required' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'cross-merchant cancellation succeeded'; END IF;
 RAISE NOTICE '[PASS] Cross-merchant action denied';
END;
$test$;
COMMIT;

-- Contracts verified against information_schema (production read-only, 2026-11-03).
DO $test$
DECLARE relname text; colname text; expected text; got text; required boolean;
BEGIN
 FOR relname,colname,expected IN SELECT * FROM (VALUES
 ('orders','id','uuid'),('orders','order_number','int8'),
 ('orders','request_key','uuid'),('orders','payment_method','text'),
 ('orders','payment_status','text'),('order_items','quantity','int4'),
 ('order_status_history','id','uuid'),('delivery_events','id','uuid'),
 ('admin_audit_logs','id','uuid'),('delivery_jobs','merchant_id','uuid'),
 ('delivery_offers','courier_id','uuid'),('payments','idempotency_key','text')
 ) AS c(rel,col,udt) LOOP
  SELECT typ.typname,att.attnotnull INTO got,required
  FROM pg_attribute att JOIN pg_class cls ON cls.oid=att.attrelid
  JOIN pg_namespace n ON n.oid=cls.relnamespace
  JOIN pg_type typ ON typ.oid=att.atttypid
  WHERE n.nspname='public' AND cls.relname=relname
   AND att.attname=colname AND att.attnum>0 AND NOT att.attisdropped;
  IF got IS DISTINCT FROM expected OR required IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Fixture drift %.% type %, required % (expected %)',relname,colname,got,required,expected;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] 12 critical PostgreSQL column contracts use production types and NOT NULL';
END;
$test$;
DO $test$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  UPDATE public.orders SET payment_status='processing' WHERE id='22222222-2222-4222-8222-222222222222';
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Order payment status constraint missing'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.orders SET payment_method='unknown' WHERE id='22222222-2222-4222-8222-222222222222';
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Order payment method constraint missing'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.delivery_jobs SET status='unknown' WHERE id='88888888-8888-4888-8888-888888888833';
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Delivery job status constraint missing'; END IF;
 RAISE NOTICE '[PASS] Production-like constraints prevent unsupported payment and delivery states';
END;
$test$;

-- Production migration should not grant anonymous EXECUTE to a SECURITY DEFINER RPC.
DO $test$
BEGIN
 IF has_function_privilege('anon','public.merchant_reject_order(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous role may execute merchant cancellation';
 END IF;
 IF NOT has_function_privilege('authenticated','public.merchant_reject_order(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Authenticated merchant may not execute merchant cancellation';
 END IF;
 RAISE NOTICE '[PASS] Merchant privileged RPC EXECUTE is denied to anon and granted to authenticated';
END;
$test$;

-- Postconditions as fixture owner (not as a user). No sensitive real data exists.
DO $test$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='11111111-1111-4111-8111-111111111111'
   AND status='cancelled' AND payment_status='cancelled') THEN
   RAISE EXCEPTION 'ordinary cash cancellation did not persist';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds WHERE order_id='11111111-1111-4111-8111-111111111111') THEN
   RAISE EXCEPTION 'cash cancellation fabricated refund';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='33333333-3333-4333-8333-333333333333'
   AND status='confirmed' AND payment_status='pending') THEN
   RAISE EXCEPTION 'blocked cash order was modified';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.delivery_jobs WHERE id='88888888-8888-4888-8888-888888888833' AND status='searching') THEN
   RAISE EXCEPTION 'blocked cash mutated delivery job';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.delivery_offers WHERE id='77777777-7777-4777-8777-777777777733' AND status='offered') THEN
   RAISE EXCEPTION 'blocked cash mutated delivery offer';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds WHERE order_id='33333333-3333-4333-8333-333333333333') THEN
   RAISE EXCEPTION 'blocked cash created refund';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='44444444-4444-4444-8444-444444444444' AND status='confirmed') THEN
   RAISE EXCEPTION 'nonpending cash was modified';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.refunds WHERE order_id='55555555-5555-4555-8555-555555555555' AND status='pending') THEN
   RAISE EXCEPTION 'previous electronic refund path regressed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='55555555-5555-4555-8555-555555555555' AND status='cancelled') THEN
   RAISE EXCEPTION 'previous electronic cancellation regressed';
 END IF;
 RAISE NOTICE '[PASS] PostgreSQL synthetic cash cancellation, no refund, failure isolation and paid-electronic regression';
END;
$test$;
