-- APOIS ENTREGAS — INV-009 — HOMOLOGAÇÃO SOMENTE / NÃO APLICADA EM PRODUÇÃO
-- Preparada em 2026-11-08 a partir da leitura do catálogo AO VIVO.
-- Objetivo restrito: impedir invocação direta de liquidação pelo cliente HTTP.
-- Não modifica valores, payment_status, wallets, ledger ou regras de pagamento direto.
-- Validar em staging com contas anon/A/B, courier, merchant e wrappers legítimos ANTES do rollout.
-- Atenção: não confundir proteção por ACL com homologação integral da contabilidade.
BEGIN;

DO $apois_guard$
DECLARE
  v_settle oid := to_regprocedure('public.settle_delivered_order_financials(uuid)');
  v_delivery oid := to_regprocedure('public.complete_delivery_with_pin(uuid,text)');
  v_pickup oid := to_regprocedure('public.complete_pickup_with_pin(uuid,text)');
BEGIN
  IF v_settle IS NULL OR v_delivery IS NULL OR v_pickup IS NULL THEN
    RAISE EXCEPTION 'INV-009: funções financeiras/chamadoras esperadas ausentes; interrompa';
  END IF;
  IF NOT (
    SELECT a.prosecdef AND b.prosecdef AND c.prosecdef
       AND a.proowner = b.proowner AND a.proowner = c.proowner
    FROM pg_proc a, pg_proc b, pg_proc c
    WHERE a.oid = v_settle AND b.oid = v_delivery AND c.oid = v_pickup
  ) THEN
    RAISE EXCEPTION 'INV-009: privilégios/ownership mudaram; revise chamadas internas antes de aplicar';
  END IF;
END
$apois_guard$;

-- SECURITY DEFINER continua acessível ao dono (mesmo dono dos wrappers),
-- mas não diretamente a visitantes e usuários comuns.
REVOKE EXECUTE ON FUNCTION public.settle_delivered_order_financials(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_delivered_order_financials(uuid)
  TO service_role;

DO $apois_assert$
BEGIN
  IF has_function_privilege('anon', 'public.settle_delivered_order_financials(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.settle_delivered_order_financials(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.settle_delivered_order_financials(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'INV-009: ACL final não corresponde ao contrato de privilégios mínimos';
  END IF;
END
$apois_assert$;

COMMIT;

-- Homologação separada obrigatória:
-- 1. Confirmar rejeição de invocação direta anon e authenticated via Data API.
-- 2. Exercitar complete_delivery_with_pin/complete_pickup_with_pin em banco isolado.
-- 3. Verificar liquidação idempotente, concorrência, rollback, ausência de crédito fictício
--    e regras diferenciadas para pagamento direto/manual e eletrônico.
-- 4. Investigar outras funções DEFINER expostas; esta migration não corrige INV-018.
-- 5. Rollout somente após autorização expressa; rollback de ACL exige revisão do DBA.
