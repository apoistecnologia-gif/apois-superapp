-- INV-018 continuation: protect service-only notification/payout dispatcher RPCs.
-- Reviewed: dispatch-push-outbox Edge Function calls these with SERVICE_ROLE_KEY.
-- Enqueue and claim must not be callable from unauthenticated or end-user roles.
-- Read-only notification feed and device registration are intentionally unchanged.
DO $apois_internal_acl$
DECLARE
  rpc_signature text;
  rpc_oid oid;
  rpc_count integer := 0;
BEGIN
  FOREACH rpc_signature IN ARRAY ARRAY[
    'public.claim_notification_push_batch(integer)',
    'public.claim_notification_push_batch_v2(integer)',
    'public.verify_push_dispatch_key(text)',
    'public.verify_push_dispatch_runtime_key(text)',
    'public.verify_payout_dispatch_runtime_key(text)',
    'public.enqueue_notification(uuid,text,text,text,jsonb,text)'
  ]::text[]
  LOOP
    rpc_oid := to_regprocedure(rpc_signature);
    IF rpc_oid IS NULL THEN
      RAISE EXCEPTION 'Missing expected internal RPC: %', rpc_signature;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rpc_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rpc_signature);
    IF has_function_privilege('anon',rpc_oid,'EXECUTE')
      OR has_function_privilege('authenticated',rpc_oid,'EXECUTE')
      OR NOT has_function_privilege('service_role',rpc_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'INV-018 internal privilege invariant failed: %', rpc_signature;
    END IF;
    rpc_count := rpc_count + 1;
  END LOOP;
  IF rpc_count <> 6 THEN RAISE EXCEPTION 'Internal RPC list changed'; END IF;
END
$apois_internal_acl$;