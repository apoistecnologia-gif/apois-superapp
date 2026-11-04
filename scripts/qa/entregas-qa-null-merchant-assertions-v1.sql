-- Integration regression AFTER the unapplied QA guard migration above.
\set ON_ERROR_STOP on
UPDATE public.merchants SET slug=NULL
WHERE id='afafafaf-afaf-4afa-8afa-afafafafafaf';
INSERT INTO public.orders(id,order_number,merchant_id,customer_user_id,status,
 payment_method,payment_status,subtotal,total,delivery_address,request_key)
VALUES('34343434-3434-4343-8343-343434343437',3004,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'confirmed','pix','pending',20,20,'{}'::jsonb,gen_random_uuid());
DO $qa$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.orders
 WHERE id='34343434-3434-4343-8343-343434343437'
   AND payment_method='pix' AND payment_status='pending';
 IF n<>1 THEN RAISE EXCEPTION 'Missing QA merchant still blocks unrelated Pix order'; END IF;
 IF to_regprocedure('private.apois_qa_no_real_payment()') IS NULL
 OR position('IS DISTINCT FROM' IN pg_get_functiondef(
    'private.apois_qa_no_real_payment()'::regprocedure))=0 THEN
  RAISE EXCEPTION 'Missing NULL-safe financial guard definition';
 END IF;
 RAISE NOTICE '[PASS] Missing QA test merchant no longer blocks unrelated Pix orders';
END;
$qa$;
-- Restore the test slug; the QA merchant must remain protected after the fix.
UPDATE public.merchants
SET slug='apois-teste-entregas-homologacao-20261029'
WHERE id='afafafaf-afaf-4afa-8afa-afafafafafaf';
DO $qa$
DECLARE rejected boolean:=false; err text;
BEGIN
 BEGIN
  UPDATE public.orders SET payment_status='paid'
  WHERE id='34343434-3434-4343-8343-343434343434';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
  IF err<>'test order cannot become a real payment' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'QA cash guard lost paid-state protection'; END IF;
 RAISE NOTICE '[PASS] QA account remains cash-only and cannot fabricate paid';
END;
$qa$;
