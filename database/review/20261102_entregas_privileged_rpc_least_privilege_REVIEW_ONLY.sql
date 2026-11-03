-- REVIEW ONLY / NÃO APLICADO — APOIS Entregas ptgkwyyolrdgnqketkjj.
-- SECURITY FINDING: anonymous and authenticated currently have EXECUTE (both direct and PUBLIC grant).
-- All four are SECURITY DEFINER postgres-owned and mutate financial or courier dispatch state.
-- Call graph inspected 2026-11-02: dispatch is called by postgres-owned SECURITY DEFINER SQL functions
-- or trigger; reserve/refund are called by service-role Edge Functions. This script has NOT been deployed.
-- Before production approval, regression-test dispatch/offers and paid-order/refund paths under service_role.
-- Explicitly DO NOT grant to PUBLIC: PostgreSQL PUBLIC grants override direct anon/auth revocations.
BEGIN;
DO $preflight$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'public.dispatch_delivery_job_offers(uuid)',
    'public.ensure_cancelled_paid_order_refund(uuid)',
    'public.reserve_paid_order_merchant_net(uuid)',
    'public.reverse_paid_order_merchant_reserve(uuid)'
  ] LOOP
    IF to_regprocedure(item) IS NULL THEN
      RAISE EXCEPTION 'APOIS release blocked: missing RPC %',item;
    END IF;
  END LOOP;
END;
$preflight$;
REVOKE ALL ON FUNCTION public.dispatch_delivery_job_offers(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_delivery_job_offers(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_cancelled_paid_order_refund(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_cancelled_paid_order_refund(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_paid_order_merchant_net(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_paid_order_merchant_net(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reverse_paid_order_merchant_reserve(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_paid_order_merchant_reserve(uuid) TO service_role;
DO $postflight$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'public.dispatch_delivery_job_offers(uuid)',
    'public.ensure_cancelled_paid_order_refund(uuid)',
    'public.reserve_paid_order_merchant_net(uuid)',
    'public.reverse_paid_order_merchant_reserve(uuid)'
  ] LOOP
    IF has_function_privilege('anon',to_regprocedure(item),'EXECUTE')
       OR has_function_privilege('authenticated',to_regprocedure(item),'EXECUTE')
       OR NOT has_function_privilege('service_role',to_regprocedure(item),'EXECUTE')
    THEN RAISE EXCEPTION 'APOIS invalid RPC grants for %',item;
    END IF;
  END LOOP;
END;
$postflight$;
COMMIT;
