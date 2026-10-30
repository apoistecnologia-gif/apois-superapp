-- APOIS QA: protective-only changes for ONE merchant in the existing Entregas database.
-- Add RESTRICTIVE SELECT policies to stop other authenticated users from
-- observing its household pickup location when merchant is activated.
-- No merchant is activated and no test customer is authorized by this SQL.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
     SELECT 1 FROM public.merchants
     WHERE id=(SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029')
       AND name='APOIS TESTE Entregas'
       AND slug='apois-teste-entregas-homologacao-20261029'
       AND is_active=false AND approval_status='pending'
  ) THEN RAISE EXCEPTION 'QA merchant safety preflight failed'; END IF;
  IF EXISTS (
     SELECT 1 FROM private.apois_test_cash_access a
     WHERE a.merchant_id=(SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029')
       AND a.enabled AND a.expires_at>now()
  ) THEN RAISE EXCEPTION 'QA already enabled: abort applying privacy patch'; END IF;
  IF EXISTS (
     SELECT 1 FROM public.orders o
     WHERE o.merchant_id=(SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029')
  ) THEN RAISE EXCEPTION 'QA merchant already has orders'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.apois_qa_can_view_merchant(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
  SELECT
    _merchant_id=(SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029')
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM private.apois_test_cash_access a
      WHERE a.merchant_id=_merchant_id
        AND a.customer_user_id=(SELECT auth.uid())
        AND a.enabled AND a.expires_at>now()
    );
$fn$;
REVOKE ALL ON FUNCTION private.apois_qa_can_view_merchant(uuid) FROM PUBLIC,anon,authenticated;

-- One restrictive AND filter is safer than replacing existing broad production
-- policies: ALL production merchant/product policies remain intact.
CREATE OR REPLACE FUNCTION public.apois_qa_read_allowed(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT
   _merchant_id <> (SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029')
   OR public.current_user_is_admin()
   OR public.current_user_is_merchant_member(_merchant_id)
   OR private.apois_qa_can_view_merchant(_merchant_id);
$fn$;
REVOKE ALL ON FUNCTION public.apois_qa_read_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_qa_read_allowed(uuid) TO authenticated;

DROP POLICY IF EXISTS "APOIS QA merchant privacy restriction" ON public.merchants;
CREATE POLICY "APOIS QA merchant privacy restriction"
ON public.merchants AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.apois_qa_read_allowed(id));

DROP POLICY IF EXISTS "APOIS QA products privacy restriction" ON public.products;
CREATE POLICY "APOIS QA products privacy restriction"
ON public.products AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.apois_qa_read_allowed(merchant_id));

DROP POLICY IF EXISTS "APOIS QA categories privacy restriction" ON public.menu_categories;
CREATE POLICY "APOIS QA categories privacy restriction"
ON public.menu_categories AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.apois_qa_read_allowed(merchant_id));

-- On activation, the standard authenticated browse policy already exists.
-- It still needs merchant_subscription_in_good_standing(...) (granted to
-- this merchant only while the QA private cash allowlist is enabled).

-- The ordinary Pix checkout must NEVER issue a payable order to this store
-- even if a customer guesses the UUID and calls an API directly.
CREATE OR REPLACE FUNCTION private.apois_qa_no_real_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_id uuid := (SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029');
BEGIN
  IF NEW.merchant_id <> v_id THEN RETURN NEW; END IF;
  IF NEW.payment_method <> 'cash'
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
$fn$;

DROP TRIGGER IF EXISTS apois_qa_never_real_payment ON public.orders;
CREATE TRIGGER apois_qa_never_real_payment
BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW
EXECUTE FUNCTION private.apois_qa_no_real_payment();

COMMIT;
