-- Real PostgreSQL execution with synthetic role/session, never production.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
SELECT set_config('apois.qa.merchant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
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
SELECT set_config('apois.qa.merchant_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
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
