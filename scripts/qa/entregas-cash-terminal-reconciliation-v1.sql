-- Cash terminal retry must not hide pre-existing gateway records,
-- stray refund rows or an inconsistent terminal payment state.
\set ON_ERROR_STOP on
INSERT INTO public.payments(
 id,order_id,provider,method,status,amount,idempotency_key)
VALUES('99999999-9999-4999-8999-999999999976',
 '77777777-7777-4777-8777-777777777771',
 'qa-unexpected-gateway','pix','paid',10,'qa-terminal-777');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $qa$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order(
   '77777777-7777-4777-8777-777777777771','repeated cash cancellation');
 EXCEPTION WHEN SQLSTATE '55000' THEN
  IF SQLERRM <> 'cash_gateway_payment_record_requires_manual_reconciliation' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cash retry hid a gateway record'; END IF;
 RAISE NOTICE '[PASS] Terminal cash retry fails closed with unexpected electronic payment';
END;
$qa$;
COMMIT;
DELETE FROM public.payments WHERE id='99999999-9999-4999-8999-999999999976';

INSERT INTO public.refunds(
 payment_id,order_id,amount,reason,status)
VALUES('99999999-9999-4999-8999-999999999977',
 '77777777-7777-4777-8777-777777777771',
 10,'synthetic cash-refund mismatch','pending');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $qa$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order(
   '77777777-7777-4777-8777-777777777771','cash refund mismatch retry');
 EXCEPTION WHEN SQLSTATE '55000' THEN
  IF SQLERRM <> 'cash_refund_record_requires_manual_reconciliation' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cash retry hid a refund record'; END IF;
 RAISE NOTICE '[PASS] Terminal cash retry fails closed with unexpected refund record';
END;
$qa$;
COMMIT;
DELETE FROM public.refunds WHERE order_id='77777777-7777-4777-8777-777777777771';

UPDATE public.orders SET payment_status='paid'
WHERE id='77777777-7777-4777-8777-777777777771';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $qa$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.merchant_reject_order(
   '77777777-7777-4777-8777-777777777771','cash paid-state mismatch retry');
 EXCEPTION WHEN SQLSTATE '55000' THEN
  IF SQLERRM <> 'cash_payment_state_requires_manual_reconciliation' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cash retry hid paid-state mismatch'; END IF;
 RAISE NOTICE '[PASS] Terminal cash retry rejects fabricated paid state';
END;
$qa$;
COMMIT;
UPDATE public.orders SET payment_status='cancelled'
WHERE id='77777777-7777-4777-8777-777777777771';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $qa$
DECLARE reply jsonb;
BEGIN
 SELECT public.merchant_reject_order(
  '77777777-7777-4777-8777-777777777771','legitimate cash cancellation retry')
 INTO reply;
 IF reply->>'status'<>'cancelled'
  OR reply->'refund_pending' IS DISTINCT FROM 'false'::jsonb
  OR reply->>'refund_id' IS NOT NULL
 THEN RAISE EXCEPTION 'Cash retry rejected after reconciliation: %',reply; END IF;
 RAISE NOTICE '[PASS] Clean terminal cash retry remains idempotent';
END;
$qa$;
COMMIT;
