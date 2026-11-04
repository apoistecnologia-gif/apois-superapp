-- APOIS Entregas: fix QA checkout administrative role recognition.
-- The customer quote remains protected, and the server-side order creation
-- independently requires an enabled, non-expired QA customer allowance.
-- Production payment providers, orders, coverage and geographic rules unchanged.

CREATE OR REPLACE FUNCTION private.apois_qa_checkout_customer_allowed(
  _merchant_id uuid,
  _customer_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $check$
  SELECT EXISTS (
    SELECT 1
      FROM private.apois_test_cash_access a
     WHERE a.merchant_id = _merchant_id
       AND a.customer_user_id = _customer_user_id
       AND a.enabled IS TRUE
       AND a.expires_at > now()
  );
$check$;

REVOKE ALL ON FUNCTION private.apois_qa_checkout_customer_allowed(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.apois_qa_checkout_customer_allowed(uuid,uuid) TO service_role;

DO $guard_patch$
DECLARE
  v_quote_sql text;
  v_order_sql text;
BEGIN
  v_quote_sql := pg_get_functiondef('public.resolve_delivery_quote(uuid,jsonb)'::regprocedure);
  IF strpos(v_quote_sql, $old_role$COALESCE(current_setting('request.jwt.claim.role',true),'') <> 'service_role'$old_role$) = 0 THEN
    RAISE EXCEPTION 'QA guard patch refused: unexpected resolve_delivery_quote definition';
  END IF;
  v_quote_sql := replace(
    v_quote_sql,
    $old_role$COALESCE(current_setting('request.jwt.claim.role',true),'') <> 'service_role'$old_role$,
    $new_role$COALESCE(auth.role(),'') <> 'service_role'$new_role$
  );
  EXECUTE v_quote_sql;

  v_order_sql := pg_get_functiondef(
    'public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)'::regprocedure
  );
  IF strpos(v_order_sql, $old_quote$    select q.eligible,q.reason,q.delivery_fee,q.minimum_order$old_quote$) = 0 THEN
    RAISE EXCEPTION 'QA guard patch refused: unexpected create_order_atomic_v2 definition';
  END IF;
  v_order_sql := replace(
    v_order_sql,
    $old_quote$    select q.eligible,q.reason,q.delivery_fee,q.minimum_order$old_quote$,
    $new_quote$    -- The service-role RPC has no auth.uid(); explicitly authorize the verified
    -- customer_user_id before allowing the QA merchant through the privileged quote.
    IF EXISTS (
      SELECT 1 FROM public.merchants m
       WHERE m.id=p_merchant_id
         AND m.slug='apois-teste-entregas-homologacao-20261029'
    ) AND NOT private.apois_qa_checkout_customer_allowed(p_merchant_id,p_customer_user_id) THEN
      RAISE EXCEPTION 'merchant is inactive';
    END IF;
    select q.eligible,q.reason,q.delivery_fee,q.minimum_order$new_quote$
  );
  EXECUTE v_order_sql;
END;
$guard_patch$;

-- Remove temporary per-user debugging logs from preview_delivery_quote.
CREATE OR REPLACE FUNCTION public.preview_delivery_quote(
  p_merchant_id uuid,
  p_delivery_address jsonb
)
RETURNS TABLE(
  eligible boolean, reason text, zone_id uuid,
  delivery_fee numeric, minimum_order numeric, distance_km numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $preview$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'active account required';
  END IF;
  RETURN QUERY SELECT * FROM public.resolve_delivery_quote(
    p_merchant_id, p_delivery_address
  );
END;
$preview$;
