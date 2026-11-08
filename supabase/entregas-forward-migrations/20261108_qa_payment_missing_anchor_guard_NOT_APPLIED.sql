-- INV-034 — APOIS ENTREGAS | SQL preparado para staging, NÃO APLICADO.
-- Conferido com pg_get_functiondef do Supabase Entregas em 2026-11-08.
-- Corrige apenas guarda NULL da função trigger. Não desabilita o bloqueio de
-- pagamentos eletrônicos do lojista QA e não altera dados/saldos/pedidos.
-- Testar em banco isolado com loja QA presente/ausente/renomeada e loja comum.
BEGIN;
CREATE OR REPLACE FUNCTION private.apois_qa_no_real_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_id uuid := (SELECT id FROM public.merchants WHERE slug='apois-teste-entregas-homologacao-20261029');
BEGIN
  -- Guard NULL safe: when QA anchor is missing, do not apply QA rules to merchants
  -- unrelated to the fixture. Explicitly do not infer a different QA merchant.
  IF v_id IS NULL OR NEW.merchant_id IS DISTINCT FROM v_id THEN RETURN NEW; END IF;
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
$function$;
COMMIT;

-- IMPORTANTE:
-- 1. Permissão para executar a migração em produção NÃO foi concedida.
-- 2. Em homologação validar casos com âncora presente, ausente e renomeada,
--    sem permitir pagamentos reais no estabelecimento QA.
-- 3. Preservar owner/ACL e todos os triggers existentes.
-- 4. Esta correção NÃO resolve por si só a seleção de um novo slug QA,
--    nem o bloqueio de liquidação financeira INV-009.
