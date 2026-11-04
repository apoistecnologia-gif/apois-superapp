-- Production-derived QA cash protection triggers: synthetic PostgreSQL only.
-- Real Entregas pg_get_functiondef source reviewed 2026-11-03.
-- Runs after isolated RLS, cash cancellation and payment-stage tests.
\set ON_ERROR_STOP on
ALTER TABLE public.merchants ADD COLUMN name text NOT NULL DEFAULT 'Merchant QA';
ALTER TABLE public.merchants ADD COLUMN slug text;
ALTER TABLE public.merchants ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';
CREATE SCHEMA private;
CREATE TABLE private.apois_test_cash_access(
 merchant_id uuid NOT NULL,customer_user_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '3 days')
);
CREATE TABLE private.apois_test_cash_orders(
 order_id uuid PRIMARY KEY,merchant_id uuid NOT NULL,customer_user_id uuid NOT NULL
);
CREATE OR REPLACE FUNCTION private.apois_test_cash_authorized(_merchant_id uuid,_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM private.apois_test_cash_access a
  JOIN public.merchants m ON m.id=a.merchant_id
  WHERE a.merchant_id=_merchant_id
    AND a.customer_user_id=_customer_id
    AND a.enabled=true AND a.expires_at>now()
    AND m.name ILIKE 'APOIS TESTE%'
    AND m.is_active=true AND m.approval_status='approved'
 );
$function$;

CREATE OR REPLACE FUNCTION private.apois_test_cash_order_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_test boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN
  v_test:=NEW.payment_method='cash'
   AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id);
 ELSE
  SELECT EXISTS(SELECT 1 FROM private.apois_test_cash_orders x WHERE x.order_id=OLD.id)
   INTO v_test;
 END IF;
 IF v_test THEN
  IF NEW.payment_method<>'cash' OR NEW.payment_status NOT IN ('pending','cancelled') THEN
   RAISE EXCEPTION 'test order cannot become a real payment';
  END IF;
  NEW.merchant_net:=0;
  NEW.courier_earnings:=0;
  NEW.platform_fee:=0;
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.apois_qa_no_real_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_id uuid:=(SELECT id FROM public.merchants
             WHERE slug='apois-teste-entregas-homologacao-20261029');
BEGIN
 IF NEW.merchant_id<>v_id THEN RETURN NEW; END IF;
 IF NEW.payment_method<>'cash'
  OR NEW.payment_status NOT IN ('pending','cancelled') THEN
  RAISE EXCEPTION 'QA merchant rejects real payment methods or paid status';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NOT private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id) THEN
   RAISE EXCEPTION 'QA merchant needs explicit customer cash authorization';
  END IF;
 ELSIF NOT EXISTS(
  SELECT 1 FROM private.apois_test_cash_orders t WHERE t.order_id=OLD.id
 ) THEN
  RAISE EXCEPTION 'QA order marker missing';
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.apois_mark_cash_test_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF NEW.payment_method='cash'
  AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id) THEN
  INSERT INTO private.apois_test_cash_orders(order_id,merchant_id,customer_user_id)
  VALUES(NEW.id,NEW.merchant_id,NEW.customer_user_id)
  ON CONFLICT(order_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$function$;

CREATE TRIGGER apois_cash_test_financial_guard BEFORE INSERT OR UPDATE ON public.orders
 FOR EACH ROW EXECUTE FUNCTION private.apois_test_cash_order_guard();
CREATE TRIGGER apois_qa_never_real_payment BEFORE INSERT OR UPDATE ON public.orders
 FOR EACH ROW EXECUTE FUNCTION private.apois_qa_no_real_payment();
CREATE TRIGGER apois_cash_test_mark_order AFTER INSERT ON public.orders
 FOR EACH ROW EXECUTE FUNCTION private.apois_mark_cash_test_order();

INSERT INTO public.merchants(id,owner_user_id,is_active,name,slug,approval_status)
VALUES('afafafaf-afaf-4afa-8afa-afafafafafaf',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,
 'APOIS TESTE ENTREGAS HOMOLOGACAO',
 'apois-teste-entregas-homologacao-20261029','approved');
INSERT INTO private.apois_test_cash_access(merchant_id,customer_user_id,enabled,expires_at)
VALUES('afafafaf-afaf-4afa-8afa-afafafafafaf',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,now()+interval '1 day');

INSERT INTO public.orders(id,order_number,merchant_id,customer_user_id,status,
 payment_method,payment_status,subtotal,total,delivery_address,request_key,
 merchant_net,courier_earnings,platform_fee)
VALUES('34343434-3434-4343-8343-343434343434',3001,
 'afafafaf-afaf-4afa-8afa-afafafafafaf',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','pending',
 20,20,'{}'::jsonb,gen_random_uuid(),20,10,5);
DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.orders
  WHERE id='34343434-3434-4343-8343-343434343434'
    AND merchant_net=0 AND courier_earnings=0 AND platform_fee=0) THEN
  RAISE EXCEPTION 'QA cash order retained non-zero platform/merchant financial fields';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM private.apois_test_cash_orders
  WHERE order_id='34343434-3434-4343-8343-343434343434') THEN
  RAISE EXCEPTION 'QA cash order was not marked before financial guard checks';
 END IF;
 RAISE NOTICE '[PASS] Production QA cash guard marks order and zeroes electronic financial fields';
END;
$qa$;

DO $qa$
DECLARE denied boolean:=false; msg text;
BEGIN
 -- Unauthorized customer is NOT allowed to create cash for a test merchant.
 BEGIN
  INSERT INTO public.orders(order_number,merchant_id,customer_user_id,status,
   payment_method,payment_status,subtotal,total,delivery_address,request_key)
  VALUES(3002,'afafafaf-afaf-4afa-8afa-afafafafafaf',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','confirmed',
   'cash','pending',20,20,'{}'::jsonb,gen_random_uuid());
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'QA merchant needs explicit customer cash authorization' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthorized customer wrote cash test order'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.orders SET payment_status='paid'
  WHERE id='34343434-3434-4343-8343-343434343434';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'test order cannot become a real payment' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'QA order illegally marked paid'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.orders SET payment_method='pix'
  WHERE id='34343434-3434-4343-8343-343434343434';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'test order cannot become a real payment' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'QA cash order converted to electronic Pix'; END IF;
 RAISE NOTICE '[PASS] QA cash rejects unauthorized customers, forged paid status and Pix conversion';
END;
$qa$;

-- The actual staged merchant rejection must operate with all real QA triggers.
UPDATE public.orders SET status='preparing'
WHERE id='34343434-3434-4343-8343-343434343434';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $qa$
DECLARE reply jsonb;
BEGIN
 SELECT public.merchant_reject_order(
 '34343434-3434-4343-8343-343434343434','synthetic QA cash cancellation') INTO reply;
 IF reply->>'status'<>'cancelled'
  OR reply->'refund_pending' IS DISTINCT FROM 'false'::jsonb THEN
  RAISE EXCEPTION 'Production-style QA triggers blocked merchant cash cancellation: %',reply;
 END IF;
 SELECT public.merchant_reject_order(
 '34343434-3434-4343-8343-343434343434','synthetic QA retry') INTO reply;
 IF reply->>'status'<>'cancelled'
  OR reply->'refund_pending' IS DISTINCT FROM 'false'::jsonb THEN
  RAISE EXCEPTION 'Production-style QA triggers blocked terminal cash retry: %',reply;
 END IF;
 RAISE NOTICE '[PASS] Merchant cancels and retries QA cash with both production financial guards';
END;
$qa$;
COMMIT;
DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.orders
  WHERE id='34343434-3434-4343-8343-343434343434'
  AND status='cancelled' AND payment_status='cancelled'
  AND merchant_net=0 AND courier_earnings=0 AND platform_fee=0) THEN
  RAISE EXCEPTION 'QA cash order terminal state or zeroing guard inconsistent';
 END IF;
 IF (SELECT count(*) FROM public.order_status_history
  WHERE order_id='34343434-3434-4343-8343-343434343434'
  AND status='cancelled')<>1 THEN
  RAISE EXCEPTION 'QA cash retry duplicated cancellation history';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds
  WHERE order_id='34343434-3434-4343-8343-343434343434')
 OR EXISTS(SELECT 1 FROM public.payments
  WHERE order_id='34343434-3434-4343-8343-343434343434') THEN
  RAISE EXCEPTION 'QA cash cancellation created gateway records';
 END IF;
 RAISE NOTICE '[PASS] QA cash trigger integration: cancelled/pending->cancelled, zero fees, no gateway records';
END;
$qa$;
