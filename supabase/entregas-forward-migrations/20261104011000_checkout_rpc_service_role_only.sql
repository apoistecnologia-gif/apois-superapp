-- APOIS ENTREGAS — forward-only service-role-only checkout RPC boundary.
-- Staged for review; no automatic deploy or change to source submodule.
-- The original migration revoked anon/authenticated but left PUBLIC EXECUTE,
-- so inherited permission continued to expose the backend-only RPCs.
BEGIN;
DO $preflight$
BEGIN
 IF to_regprocedure('public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)') IS NULL
  OR to_regprocedure('public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)') IS NULL
  OR to_regprocedure('public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'checkout RPC ACL migration refused: expected signatures missing';
 END IF;
END;
$preflight$;
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)
 TO service_role;
COMMIT;
