-- QA storefront privacy patch on existing Supabase. Does not activate merchant.
-- Strictly scoped to one existing APOIS TESTE store and its allowlisted customer.
-- Must be installed BEFORE enabling that merchant. No data modifications.
BEGIN;

-- Fail closed when identifiers drift. No mass RLS changes on unexpected schema.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.merchants
  WHERE id='62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
    AND slug='apois-teste-entregas-homologacao-20261029'
    AND name='APOIS TESTE Entregas'
 ) THEN RAISE EXCEPTION 'QA merchant not found or identity differs'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='merchants' AND policyname='Authenticated browse billable active merchants'
 ) THEN RAISE EXCEPTION 'merchant browse RLS policy drift'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='products' AND policyname='Allow authenticated to select available products'
 ) THEN RAISE EXCEPTION 'product RLS policy drift'; END IF;
END;
$$;

-- Exactly one test merchant, authenticated QA principal, live allowlist.
CREATE OR REPLACE FUNCTION public.apois_qa_can_browse_store(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT
    _merchant_id='62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM private.apois_test_cash_access a
      WHERE a.merchant_id=_merchant_id
        AND a.customer_user_id=(SELECT auth.uid())
        AND a.enabled
        AND a.expires_at>now()
    );
$fn$;
REVOKE ALL ON FUNCTION public.apois_qa_can_browse_store(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_qa_can_browse_store(uuid) TO authenticated;

-- Default RLS policies are permissive (OR). Therefore replacing the existing
-- broad SELECT policies is necessary; merely adding a restrictive-looking QA
-- SELECT policy would NOT hide an active store from other authenticated users.
DROP POLICY "Authenticated browse billable active merchants" ON public.merchants;
CREATE POLICY "Authenticated browse billable active merchants"
ON public.merchants FOR SELECT TO authenticated
USING (
  is_active=true
  AND approval_status='approved'
  AND id <> '62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
  AND public.merchant_subscription_in_good_standing(id)
);

DROP POLICY IF EXISTS "APOIS QA specific merchant catalog" ON public.merchants;
CREATE POLICY "APOIS QA specific merchant catalog"
ON public.merchants FOR SELECT TO authenticated
USING (
  id='62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
  AND is_active=true
  AND approval_status='approved'
  AND public.apois_qa_can_browse_store(id)
);

DROP POLICY "Allow authenticated to select available products" ON public.products;
CREATE POLICY "Allow authenticated to select available products"
ON public.products FOR SELECT TO authenticated
USING (
  is_available=true
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id=products.merchant_id
      AND m.is_active=true
      AND (
        m.id <> '62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
        OR public.apois_qa_can_browse_store(m.id)
      )
  )
);

DROP POLICY IF EXISTS "APOIS QA specific merchant product read" ON public.products;
CREATE POLICY "APOIS QA specific merchant product read"
ON public.products FOR SELECT TO authenticated
USING (
  merchant_id='62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
  AND is_available
  AND public.apois_qa_can_browse_store(merchant_id)
);

-- RLS menu category browsing for this merchant is private, too.
DROP POLICY IF EXISTS "Allow authenticated to select active menu categories" ON public.menu_categories;
CREATE POLICY "Allow authenticated to select active menu categories"
ON public.menu_categories FOR SELECT TO authenticated
USING (
  is_active=true
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id=menu_categories.merchant_id AND m.is_active=true
      AND (
        m.id <> '62f314cd-e792-45bc-8363-bf2b60f2ee58'::uuid
        OR public.apois_qa_can_browse_store(m.id)
      )
  )
);

-- Important: merchant stays inactive and cash permissions stay disabled.
-- Activation is a separate, explicit gate after RLS tests under authenticated QA
-- and unrelated user JWT sessions.
COMMIT;
