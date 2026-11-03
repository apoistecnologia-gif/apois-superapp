-- REVIEW ONLY / NAO EXECUTAR NA PRODUCAO — APOIS Corridas tbbzkrfupmqdywnzgnms.
-- LIVE ACL AUDIT 2026-11-02: anon and authenticated can execute every RPC here.
-- All four are SECURITY DEFINER. Direct execution must not bypass authenticated
-- passenger ownership, provider confirmation, protected ledger, or cron authorization.
-- Audited legitimate callers:
--   service_cancel_passenger_ride -> public.cancel_own_ride (SECURITY DEFINER wrapper
--     uses auth.uid(); this wrapper must remain callable by authenticated users).
--   ensure_ride_settlement -> public.handle_completed_ride_settlement trigger,
--     public.driver_confirm_cash_payment and apois_rpc_private.get_passenger_ride_receipt.
--   activate_due_scheduled_rides -> server cron hook using supabaseAdmin + CRON_SECRET.
--   settle_asaas_ride_payment -> retired provider; no current frontend use found.
-- No user account, financial record or RPC has been modified. TEST BEFORE PRODUCTION:
-- cancellation by own user, rejection of stranger, scheduled activation, cash/Pix
-- settlement, receipt, settlement idempotency and any retired Asaas paths.
BEGIN;
DO $preflight$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY[
  'public.service_cancel_passenger_ride(uuid,uuid,text)',
  'public.settle_asaas_ride_payment(uuid,text,numeric,numeric)',
  'public.ensure_ride_settlement(uuid)',
  'public.activate_due_scheduled_rides(integer,integer)'
 ] LOOP
   IF to_regprocedure(item) IS NULL THEN
     RAISE EXCEPTION 'APOIS Corridas internal RPC missing signature %',item;
   END IF;
 END LOOP;
END;
$preflight$;
REVOKE ALL ON FUNCTION public.service_cancel_passenger_ride(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_cancel_passenger_ride(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.settle_asaas_ride_payment(uuid,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_asaas_ride_payment(uuid,text,numeric,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_ride_settlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ride_settlement(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.activate_due_scheduled_rides(integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_due_scheduled_rides(integer,integer) TO service_role;
DO $postflight$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY[
  'public.service_cancel_passenger_ride(uuid,uuid,text)',
  'public.settle_asaas_ride_payment(uuid,text,numeric,numeric)',
  'public.ensure_ride_settlement(uuid)',
  'public.activate_due_scheduled_rides(integer,integer)'
 ] LOOP
   IF has_function_privilege('anon',to_regprocedure(item),'EXECUTE')
     OR has_function_privilege('authenticated',to_regprocedure(item),'EXECUTE')
     OR NOT has_function_privilege('service_role',to_regprocedure(item),'EXECUTE')
   THEN RAISE EXCEPTION 'APOIS Corridas internal RPC unsafe grant %',item;
   END IF;
 END LOOP;
END;
$postflight$;
COMMIT;
