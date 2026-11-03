-- REVIEW ONLY / NAO APLICAR SEM AUTORIZACAO — Supabase Corridas tbbzkrfupmqdywnzgnms
-- INCIDENT P0 / 2026-11-02: two PostgreSQL postgres-owned SECURITY DEFINER functions
-- allow anon/authenticated EXECUTE, with no actor authorization within function body.
-- settle_cancellation_fee() marks penalty paid, unlocks a passenger wallet and can
-- trigger credit_driver_cancellation_fee(); reverse_cancellation_fee_settlement()
-- marks penalty unpaid and re-blocks passenger wallet. No calls/money changes were made.
-- Verified legitimate webhook caller: pinned Corridas
-- supabase/functions/mercadopago-webhook/index.ts uses admin = createClient(SUPABASE_URL,SERVICE_ROLE)
-- and admin.rpc for both operations. These grants preserve service_role.
-- BEFORE any real migration: check deployed webhook has the same service_role behavior,
-- confirm no other legitimate anon/authenticated caller, backup current ACLs,
-- exercise real webhook sandbox success/reversal/idempotency and JWT-negative tests.
-- ROLLBACK requires explicit reviewed GRANT restoration and provider reconciliation.
BEGIN;
DO $preflight$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'public.settle_cancellation_fee(uuid)',
    'public.reverse_cancellation_fee_settlement(uuid)'
  ] LOOP
    IF to_regprocedure(item) IS NULL THEN
      RAISE EXCEPTION 'APOIS Corridas P0 migration blocked: missing RPC %',item;
    END IF;
  END LOOP;
END;
$preflight$;
REVOKE ALL ON FUNCTION public.settle_cancellation_fee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_cancellation_fee(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reverse_cancellation_fee_settlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_cancellation_fee_settlement(uuid) TO service_role;
DO $postflight$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'public.settle_cancellation_fee(uuid)',
    'public.reverse_cancellation_fee_settlement(uuid)'
  ] LOOP
    IF has_function_privilege('anon',to_regprocedure(item),'EXECUTE')
       OR has_function_privilege('authenticated',to_regprocedure(item),'EXECUTE')
       OR NOT has_function_privilege('service_role',to_regprocedure(item),'EXECUTE') THEN
      RAISE EXCEPTION 'APOIS Corridas P0 migration invalid RPC grants: %',item;
    END IF;
  END LOOP;
END;
$postflight$;
COMMIT;
