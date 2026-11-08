-- APOIS INV-031 — automatic merchant promotion, limited to new orders finalized by
-- create_order_atomic_v2 (before the server replies to the payment flow).
-- Scope: 1 best eligible promotion per order, no stacking with explicit coupons.
-- Fee rules and order_item authoritative prices remain unchanged.
-- Requires frontend catalog/checkout preview and an E2E isolated regression BEFORE production.

CREATE TABLE IF NOT EXISTS private.apois_promotion_redemptions (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  discount_amount numeric(12,2) NOT NULL CHECK(discount_amount>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apois_promotion_redemptions_promotion_idx
 ON private.apois_promotion_redemptions(promotion_id);
ALTER TABLE private.apois_promotion_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.apois_promotion_redemptions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.apois_apply_auto_promotion_on_order_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $apois_promo$
DECLARE
  v_promo public.promotions;
  v_best_promo_id uuid;
  v_best_discount numeric(12,2):=0;
  v_eligible_subtotal numeric(12,2);
  v_candidate numeric(12,2);
  v_consumed bigint;
BEGIN
  IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME<>'orders' THEN
    RAISE EXCEPTION 'invalid promotion trigger context';
  END IF;

  -- Only once, during initial server-authoritative v2 order finalization.
  -- Do not touch paid, delivered, existing, retried or coupon orders.
  IF NEW.status <> 'confirmed' OR NEW.payment_status <> 'pending'
    OR OLD.status <> 'confirmed' OR OLD.payment_status <> 'pending'
    OR OLD.checkout_intent_key IS NOT NULL OR NEW.checkout_intent_key IS NOT NULL
    OR NEW.coupon_id IS NOT NULL OR OLD.coupon_id IS NOT NULL
    OR NEW.discount <> 0 OR OLD.discount <> 0
    OR EXISTS(SELECT 1 FROM private.apois_promotion_redemptions r WHERE r.order_id=NEW.id)
    OR NEW.total IS DISTINCT FROM
       round((NEW.subtotal+NEW.delivery_fee+NEW.service_fee)::numeric,2)
  THEN RETURN NEW; END IF;

  -- Lock promotion rows in deterministic order. Concurrent checkouts are serialized
  -- before counting redemptions; usage_limit cannot be oversubscribed.
  FOR v_promo IN
    SELECT p.* FROM public.promotions p
    WHERE p.merchant_id=NEW.merchant_id AND p.is_active
      AND p.starts_at <= now() AND p.ends_at > now()
      AND p.minimum_order <= NEW.subtotal
    ORDER BY p.id
    FOR UPDATE
  LOOP
    IF v_promo.usage_limit IS NOT NULL THEN
      SELECT count(*) INTO v_consumed
      FROM private.apois_promotion_redemptions r
      JOIN public.orders used_order ON used_order.id=r.order_id
      WHERE r.promotion_id=v_promo.id
        AND NOT (used_order.status='cancelled' AND
                 used_order.payment_status IN ('pending','failed'));
      IF v_consumed >= v_promo.usage_limit THEN CONTINUE; END IF;
    END IF;

    SELECT coalesce(sum(oi.line_total),0)
      INTO v_eligible_subtotal
    FROM public.order_items oi
    LEFT JOIN public.products product ON product.id=oi.product_id
    WHERE oi.order_id=NEW.id
      AND (v_promo.product_id IS NULL OR oi.product_id=v_promo.product_id)
      AND (v_promo.menu_category_id IS NULL OR
           product.menu_category_id=v_promo.menu_category_id);
    IF v_eligible_subtotal <= 0 THEN CONTINUE; END IF;

    v_candidate:=case when v_promo.discount_type='percent'
      then round((v_eligible_subtotal*v_promo.discount_value/100)::numeric,2)
      else least(v_eligible_subtotal,v_promo.discount_value) end;
    v_candidate:=least(v_candidate,NEW.subtotal,
      greatest(round((NEW.subtotal+NEW.delivery_fee+NEW.service_fee-0.01)::numeric,2),0));
    IF v_candidate > v_best_discount THEN
      v_best_discount:=v_candidate;
      v_best_promo_id:=v_promo.id;
    END IF;
  END LOOP;

  IF v_best_promo_id IS NOT NULL AND v_best_discount>0 THEN
    INSERT INTO private.apois_promotion_redemptions(order_id,promotion_id,discount_amount)
    VALUES(NEW.id,v_best_promo_id,v_best_discount);
    NEW.discount:=v_best_discount;
    NEW.total:=round((NEW.subtotal+NEW.delivery_fee+NEW.service_fee-v_best_discount)::numeric,2);
  END IF;
  RETURN NEW;
END
$apois_promo$;

REVOKE ALL ON FUNCTION private.apois_apply_auto_promotion_on_order_finalize()
 FROM PUBLIC,anon,authenticated;

-- Only order.v2's initial finalization UPDATE (old checkout key NULL)
-- can match these guards; existing orders are never retroactively repriced.
CREATE TRIGGER apois_automatic_promotion_checkout
BEFORE UPDATE OF fulfillment_type,delivery_fee,service_fee,coupon_id,discount,total
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION private.apois_apply_auto_promotion_on_order_finalize();

CREATE OR REPLACE FUNCTION public.apois_available_merchant_promotions(p_merchant_id uuid)
RETURNS TABLE(
  id uuid, name text, description text, discount_type text, discount_value numeric,
  minimum_order numeric, product_id uuid, menu_category_id uuid,
  starts_at timestamptz, ends_at timestamptz, remaining_uses bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $apois_public$
  SELECT p.id,p.name,p.description,p.discount_type,p.discount_value,
         p.minimum_order,p.product_id,p.menu_category_id,p.starts_at,p.ends_at,
         case when p.usage_limit is null then null
              else p.usage_limit-(select count(*) from private.apois_promotion_redemptions r
                  JOIN public.orders used_order ON used_order.id=r.order_id
                  WHERE r.promotion_id=p.id
                    AND NOT (used_order.status='cancelled' AND
                             used_order.payment_status IN ('pending','failed')))
         end as remaining_uses
  FROM public.promotions p
  JOIN public.merchants m ON m.id=p.merchant_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND public.current_user_is_active()
    AND p_merchant_id=p.merchant_id
    AND m.is_active=true AND m.approval_status='approved'
    AND public.apois_qa_read_allowed(m.id)
    AND p.is_active=true AND p.starts_at<=now() AND p.ends_at>now()
    AND (p.usage_limit IS NULL OR
      (SELECT count(*) FROM private.apois_promotion_redemptions r
        JOIN public.orders used_order ON used_order.id=r.order_id
        WHERE r.promotion_id=p.id
          AND NOT (used_order.status='cancelled' AND
                   used_order.payment_status IN ('pending','failed')))<p.usage_limit)
  ORDER BY p.id;
$apois_public$;
REVOKE EXECUTE ON FUNCTION public.apois_available_merchant_promotions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_available_merchant_promotions(uuid) TO authenticated, service_role;
