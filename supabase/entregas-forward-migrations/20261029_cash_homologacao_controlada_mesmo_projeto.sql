-- APOIS ENTREGAS: homologação cash em banco EXISTENTE, sem projeto ou branch de Supabase.
-- Não executa operações financeiras, não habilita cash para clientes/lojas comuns.
-- TODOS os registros autorizados são TESTE, desabilitados por padrão.
-- Revisão de produção necessária antes da aplicação e ativação de qualquer conta.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.apois_test_cash_access (
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id),
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id,customer_user_id)
);
ALTER TABLE private.apois_test_cash_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.apois_test_cash_access FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.apois_test_cash_orders (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.apois_test_cash_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.apois_test_cash_orders FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.apois_test_cash_authorized(_merchant_id uuid,_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM private.apois_test_cash_access a
    JOIN public.merchants m ON m.id=a.merchant_id
    WHERE a.merchant_id=_merchant_id
      AND a.customer_user_id=_customer_id
      AND a.enabled=true AND a.expires_at>now()
      AND m.name ILIKE 'APOIS TESTE%'
      AND m.is_active=true AND m.approval_status='approved'
  );
$$;
REVOKE ALL ON FUNCTION private.apois_test_cash_authorized(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.apois_test_cash_authorized(uuid,uuid) TO service_role;

-- RPC acessível apenas ao SERVICE ROLE da Edge Function após auth.getUser().
CREATE OR REPLACE FUNCTION public.apois_check_test_cash_access(_merchant_id uuid,_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT private.apois_test_cash_authorized(_merchant_id,_customer_id); $$;
REVOKE ALL ON FUNCTION public.apois_check_test_cash_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apois_check_test_cash_access(uuid,uuid) TO service_role;

-- PIX permanece o único método normal. CASH só é aceito para a dupla TESTE.
CREATE OR REPLACE FUNCTION public.enforce_supported_order_payment_method()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
  IF NEW.payment_method='pix' THEN RETURN NEW; END IF;
  IF NEW.payment_method='cash'
     AND NEW.payment_status='pending'
     AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'payment method is not enabled in production';
END;
$$;

-- Uma loja homologada pode simular mensalidade sem gerar assinatura paga falsa.
-- Em todas as lojas normais, a regra antiga de cobrança permanece idêntica.
CREATE OR REPLACE FUNCTION public.merchant_subscription_in_good_standing(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id=_merchant_id AND m.approval_status='approved' AND m.is_active=true
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM private.apois_test_cash_access t
      JOIN public.merchants m ON m.id=t.merchant_id
      WHERE t.merchant_id=_merchant_id
        AND t.enabled=true AND t.expires_at>now()
        AND m.name ILIKE 'APOIS TESTE%'
        AND m.is_active=true AND m.approval_status='approved'
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.merchant_subscriptions ms
      JOIN public.platform_settings ps ON ps.key='mercado_pago_environment'
      WHERE ms.merchant_id=_merchant_id
        AND ms.current_period_end IS NOT NULL AND ms.current_period_end>now()
        AND COALESCE(ms.metadata->>'environment','')=COALESCE(ps.value #>> '{}','')
        AND COALESCE(ms.last_payment_status,'')='approved'
    )
  END;
$$;

-- Valores de teste: ZERO antes de qualquer eventual liquidação/carteira.
CREATE OR REPLACE FUNCTION private.apois_test_cash_order_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_test boolean := false;
BEGIN
  IF TG_OP='INSERT' THEN
    v_test := NEW.payment_method='cash'
      AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id);
  ELSE
    SELECT EXISTS(SELECT 1 FROM private.apois_test_cash_orders x WHERE x.order_id=OLD.id) INTO v_test;
  END IF;
  IF v_test THEN
    IF NEW.payment_method<>'cash' OR NEW.payment_status NOT IN ('pending','cancelled') THEN
      RAISE EXCEPTION 'test order cannot become a real payment';
    END IF;
    NEW.merchant_net := 0;
    NEW.courier_earnings := 0;
    NEW.platform_fee := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS apois_cash_test_financial_guard ON public.orders;
CREATE TRIGGER apois_cash_test_financial_guard
BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW
EXECUTE FUNCTION private.apois_test_cash_order_guard();

CREATE OR REPLACE FUNCTION private.apois_mark_cash_test_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.payment_method='cash'
     AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id) THEN
    INSERT INTO private.apois_test_cash_orders(order_id,merchant_id,customer_user_id)
    VALUES(NEW.id,NEW.merchant_id,NEW.customer_user_id)
    ON CONFLICT(order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS apois_cash_test_mark_order ON public.orders;
CREATE TRIGGER apois_cash_test_mark_order AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.apois_mark_cash_test_order();

CREATE OR REPLACE FUNCTION private.apois_zero_test_delivery_earnings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.apois_test_cash_orders t WHERE t.order_id=NEW.order_id) THEN
    NEW.estimated_earnings := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS apois_cash_test_delivery_earnings ON public.delivery_jobs;
CREATE TRIGGER apois_cash_test_delivery_earnings
BEFORE INSERT OR UPDATE ON public.delivery_jobs FOR EACH ROW
EXECUTE FUNCTION private.apois_zero_test_delivery_earnings();

-- Membros da loja TESTE podem visualizar somente seus pedidos autorizados.
CREATE OR REPLACE FUNCTION public.apois_is_test_cash_order_for_merchant(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT EXISTS(
   SELECT 1 FROM private.apois_test_cash_orders t
   WHERE t.order_id=_order_id AND public.current_user_is_merchant_member(t.merchant_id)
 );
$$;
REVOKE ALL ON FUNCTION public.apois_is_test_cash_order_for_merchant(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_is_test_cash_order_for_merchant(uuid) TO authenticated;

DROP POLICY IF EXISTS "APOIS test cash merchant orders" ON public.orders;
CREATE POLICY "APOIS test cash merchant orders" ON public.orders
FOR SELECT TO authenticated
USING(payment_method='cash' AND payment_status='pending'
  AND public.apois_is_test_cash_order_for_merchant(id));

DROP POLICY IF EXISTS "APOIS test cash merchant order items" ON public.order_items;
CREATE POLICY "APOIS test cash merchant order items" ON public.order_items
FOR SELECT TO authenticated
USING(public.apois_is_test_cash_order_for_merchant(order_id));

DROP POLICY IF EXISTS "APOIS test cash merchant history" ON public.order_status_history;
CREATE POLICY "APOIS test cash merchant history" ON public.order_status_history
FOR SELECT TO authenticated
USING(public.apois_is_test_cash_order_for_merchant(order_id));

-- Não há INSERT em apois_test_cash_access. Sem liberação explícita, o modo é inerte.
COMMIT;
