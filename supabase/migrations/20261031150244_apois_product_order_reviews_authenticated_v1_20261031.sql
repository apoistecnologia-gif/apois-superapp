-- APOIS ENTREGAS: PROPOSTA DE MIGRAÇÃO — NÃO APLICADA EM PRODUÇÃO.
-- Requer aprovação expressa e revisão de segurança antes de executar.
-- Objetivo: persistir avaliações dos produtos distintos da nota do
-- estabelecimento e da entrega, mantendo a RPC existente intacta.
-- Sem migrations remotas / sem deploy nesta homologação.
CREATE TABLE IF NOT EXISTS public.product_order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_order_reviews_one_per_item UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS product_order_reviews_order_idx
  ON public.product_order_reviews(order_id);

ALTER TABLE public.product_order_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_order_reviews FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.product_order_reviews TO authenticated;

CREATE POLICY "Customers read own product reviews"
ON public.product_order_reviews
FOR SELECT TO authenticated
USING (customer_user_id = (SELECT auth.uid()));

CREATE POLICY "Customers insert own delivered order product reviews"
ON public.product_order_reviews
FOR INSERT TO authenticated
WITH CHECK (
  customer_user_id = (SELECT auth.uid())
  AND public.current_user_is_active()
  AND EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = product_order_reviews.order_id
      AND r.customer_user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.id = product_order_reviews.order_id
      AND o.customer_user_id = (SELECT auth.uid())
      AND o.status = 'delivered'
      AND oi.id = product_order_reviews.order_item_id
  )
);

CREATE FUNCTION public.submit_order_product_reviews(
  _order_id uuid,
  _products jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_expected integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'login required';
  END IF;
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'active account required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND o.customer_user_id = (SELECT auth.uid())
      AND o.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'delivered order not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id=_order_id
      AND r.customer_user_id=(SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'order review required before product ratings';
  END IF;
  IF _products IS NULL OR jsonb_typeof(_products) <> 'array' THEN
    RAISE EXCEPTION 'ratings must be an array';
  END IF;
  v_total := jsonb_array_length(_products);
  IF v_total < 1 OR v_total > 50 THEN
    RAISE EXCEPTION 'invalid number of product ratings';
  END IF;
  SELECT count(*) INTO v_expected FROM public.order_items
    WHERE order_id = _order_id;
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'every ordered item must be rated';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_products)
      AS r(order_item_id uuid, rating smallint, comment text)
    LEFT JOIN public.order_items oi ON oi.id=r.order_item_id AND oi.order_id=_order_id
    WHERE r.order_item_id IS NULL
       OR oi.id IS NULL
       OR r.rating IS NULL OR r.rating NOT BETWEEN 1 AND 5
       OR (r.comment IS NOT NULL AND char_length(r.comment) > 500)
  ) THEN
    RAISE EXCEPTION 'invalid order item or product rating';
  END IF;
  IF (SELECT count(DISTINCT (r.order_item_id))
      FROM jsonb_to_recordset(_products)
      AS r(order_item_id uuid, rating smallint, comment text)) <> v_total
  THEN
    RAISE EXCEPTION 'duplicate order item in ratings';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_order_reviews pr
    WHERE pr.order_id = _order_id
  ) THEN
    RAISE EXCEPTION 'products already reviewed';
  END IF;
  INSERT INTO public.product_order_reviews(
    order_id,order_item_id,customer_user_id,rating,comment
  )
  SELECT _order_id, r.order_item_id, (SELECT auth.uid()),
         r.rating, nullif(btrim(r.comment),'')
  FROM jsonb_to_recordset(_products)
    AS r(order_item_id uuid, rating smallint, comment text);
  RETURN v_total;
END;
$$;

CREATE FUNCTION public.submit_order_review_with_products(
  _order_id uuid,
  _merchant_rating smallint,
  _courier_rating smallint,
  _comment text,
  _products jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_review_id uuid;
BEGIN
  -- Existing implementation enforces active authenticated customer,
  -- delivered state, merchant/courier notes and one review per order.
  -- The transaction rolls back this review if product validation fails.
  SELECT public.submit_order_review(
    _order_id,_merchant_rating,_courier_rating,_comment
  ) INTO v_review_id;
  PERFORM public.submit_order_product_reviews(_order_id,_products);
  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_product_reviews(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_order_review_with_products(uuid,smallint,smallint,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_product_reviews(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_review_with_products(uuid,smallint,smallint,text,jsonb) TO authenticated;

