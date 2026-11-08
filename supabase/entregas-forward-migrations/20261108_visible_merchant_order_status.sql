-- INV-024: authoritative, batch open/closed status per visible merchant.
-- Backend remains single source of truth for timezone, exceptions, approval, city and temporary closures.
CREATE OR REPLACE FUNCTION public.apois_visible_merchant_order_status(p_merchant_ids uuid[])
RETURNS TABLE(merchant_id uuid, accepting_orders boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $$
 SELECT m.id, public.merchant_accepting_orders(m.id, now())
 FROM public.merchants m
 WHERE p_merchant_ids IS NOT NULL
   AND cardinality(p_merchant_ids) BETWEEN 1 AND 200
   AND m.id = ANY(p_merchant_ids);
$$;
REVOKE EXECUTE ON FUNCTION public.apois_visible_merchant_order_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apois_visible_merchant_order_status(uuid[]) TO authenticated, service_role;
