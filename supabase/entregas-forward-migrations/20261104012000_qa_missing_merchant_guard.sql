-- Forward-only QA trigger hardening; not applied automatically.
-- If the special APOIS test merchant no longer exists, the prior comparison
-- NEW.merchant_id <> NULL evaluates UNKNOWN, incorrectly blocking all Pix
-- orders for unrelated merchants. Null/missing QA merchant must be harmless.
-- Preserve the rest of the exact production QA anti-real-payment contract.
BEGIN;
DO $preflight$
BEGIN
 IF to_regprocedure('private.apois_qa_no_real_payment()') IS NULL
   OR to_regprocedure('private.apois_test_cash_authorized(uuid,uuid)') IS NULL
   OR to_regclass('private.apois_test_cash_orders') IS NULL
   OR to_regclass('public.merchants') IS NULL
 THEN RAISE EXCEPTION 'QA cash guard hardening requires exact production dependencies';
 END IF;
END;
$preflight$;
CREATE OR REPLACE FUNCTION private.apois_qa_no_real_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_id uuid := (SELECT id FROM public.merchants
               WHERE slug='apois-teste-entregas-homologacao-20261029');
BEGIN
 -- NULL-safe: missing QA merchant must not block unrelated public merchants.
 IF v_id IS NULL OR NEW.merchant_id IS DISTINCT FROM v_id THEN
  RETURN NEW;
 END IF;
 IF NEW.payment_method <> 'cash'
   OR NEW.payment_status NOT IN ('pending','cancelled') THEN
  RAISE EXCEPTION 'QA merchant rejects real payment methods or paid status';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NOT private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id) THEN
   RAISE EXCEPTION 'QA merchant needs explicit customer cash authorization';
  END IF;
 ELSIF NOT EXISTS (
  SELECT 1 FROM private.apois_test_cash_orders t WHERE t.order_id=OLD.id
 ) THEN
  RAISE EXCEPTION 'QA order marker missing';
 END IF;
 RETURN NEW;
END;
$function$;
COMMIT;
