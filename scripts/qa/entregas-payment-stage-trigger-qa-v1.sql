-- Production-derived trigger: pg_get_functiondef on Supabase Entregas
-- on 2026-11-03. Executed only in the disposable PostgreSQL 17 fixture.
-- A non-cash order cannot enter fulfillment before payment is confirmed.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION public.enforce_order_payment_before_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status
  AND NEW.status IN ('accepted','preparing','ready','ready_for_pickup',
   'searching_driver','driver_assigned','driver_arriving_store','picked_up',
   'out_for_delivery','on_the_way','delivered')
  AND NEW.payment_method<>'cash'
  AND NEW.payment_status<>'paid'
 THEN
  RAISE EXCEPTION 'payment must be confirmed before fulfillment';
 END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER orders_require_payment_before_fulfillment
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_payment_before_fulfillment();

-- Data here is SYNTHETIC; all direct mutations below run after the original
-- RLS/refund assertions to avoid modifying their expected fixture counts.
INSERT INTO public.orders(
 id,order_number,merchant_id,customer_user_id,
 status,payment_method,payment_status,subtotal,total,delivery_address,request_key)
VALUES
 ('66666666-6666-4666-8666-666666666661',2001,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'confirmed','pix','pending',10,10,'{}'::jsonb,gen_random_uuid()),
 ('77777777-7777-4777-8777-777777777771',2002,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'confirmed','cash','pending',10,10,'{}'::jsonb,gen_random_uuid());

DO $test$
DECLARE denied boolean := false; msg text;
BEGIN
 -- A pending Pix may be read but cannot progress into the kitchen workflow.
 BEGIN
  UPDATE public.orders SET status='preparing'
  WHERE id='66666666-6666-4666-8666-666666666661';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'payment must be confirmed before fulfillment' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Unpaid Pix entered fulfillment'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.orders WHERE id='66666666-6666-4666-8666-666666666661'
    AND status='confirmed' AND payment_status='pending')
 THEN RAISE EXCEPTION 'Rejected Pix stage modified the order'; END IF;
 UPDATE public.orders SET payment_status='paid'
 WHERE id='66666666-6666-4666-8666-666666666661';
 UPDATE public.orders SET status='preparing'
 WHERE id='66666666-6666-4666-8666-666666666661';
 IF NOT EXISTS (
  SELECT 1 FROM public.orders WHERE id='66666666-6666-4666-8666-666666666661'
    AND status='preparing' AND payment_status='paid')
 THEN RAISE EXCEPTION 'Paid Pix failed to progress'; END IF;
 -- Cash remains pending because APOIS cannot verify physical payment.
 UPDATE public.orders SET status='preparing'
 WHERE id='77777777-7777-4777-8777-777777777771';
 IF NOT EXISTS (
  SELECT 1 FROM public.orders WHERE id='77777777-7777-4777-8777-777777777771'
    AND status='preparing' AND payment_status='pending')
 THEN RAISE EXCEPTION 'Cash/pending blocked incorrectly by payment trigger'; END IF;
 RAISE NOTICE '[PASS] Production-style fulfillment trigger: pending cash progresses; pending Pix denied; paid Pix progresses';
END;
$test$;

-- Cash cancellation, through the REAL prepared merchant RPC, must still work
-- when the production-style fulfillment trigger is installed.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $test$
DECLARE outcome jsonb;
BEGIN
 SELECT public.merchant_reject_order('77777777-7777-4777-8777-777777777771',
  'synthetic cash order cancelled after preparation') INTO outcome;
 IF outcome->>'status'<>'cancelled' OR (outcome->>'refund_pending')::boolean IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Cash cancellation failed with payment guard: %',outcome; END IF;
 RAISE NOTICE '[PASS] Direct cash cancellation bypasses no refund and preserves payment trigger';
END;
$test$;
COMMIT;
DO $test$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.orders
  WHERE id='77777777-7777-4777-8777-777777777771'
  AND status='cancelled' AND payment_status='cancelled') THEN
  RAISE EXCEPTION 'Cash cancellation state missing after trigger integration';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds
  WHERE order_id='77777777-7777-4777-8777-777777777771') THEN
  RAISE EXCEPTION 'Cash cancellation fabricated a gateway refund';
 END IF;
 RAISE NOTICE '[PASS] Cash cancellation integrated with production-style fulfillment trigger';
END;
$test$;
