-- INV-018 Corridas: database-verified, least-privilege ACL.
-- These three financial/pix RPC bodies already enforce auth.role()='service_role'.
-- This migration does not execute the RPCs or modify rides, payments or wallet rows.
-- Admin action RPCs have an additional role check in their delegate/body.
-- Keep admin_is_authorized() public for pre-login/auth-gate compatibility.
DO $apois_corridas_acl$
DECLARE
  rec record;
  sig text;
  admin_count integer:=0;
  financial_count integer:=0;
BEGIN
  FOR rec IN
    SELECT p.oid,p.proname,n.nspname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
      AND p.proname IN (
        'activate_prepaid_pix_ride',
        'claim_prepaid_pix_initial_dispatch',
        'reverse_refunded_ride_payment'
      )
    ORDER BY p.proname
  LOOP
    IF position('service_role_required' IN pg_get_functiondef(rec.oid)) = 0 THEN
      RAISE EXCEPTION 'RPC no longer has expected service-role check: %',rec.proname;
    END IF;
    sig:=format('%I.%I(%s)',rec.nspname,rec.proname,rec.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',sig);
    financial_count:=financial_count+1;
  END LOOP;
  IF financial_count<>3 THEN RAISE EXCEPTION 'Unexpected financial RPC count: %',financial_count; END IF;
  FOR rec IN
    SELECT p.oid,p.proname,n.nspname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
      AND p.proname LIKE 'admin_%' AND p.proname<>'admin_is_authorized'
    ORDER BY p.proname
  LOOP
    sig:=format('%I.%I(%s)',rec.nspname,rec.proname,rec.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon',sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',sig);
    admin_count:=admin_count+1;
  END LOOP;
  IF admin_count<>12 THEN RAISE EXCEPTION 'Unexpected admin RPC count: %',admin_count; END IF;
  IF EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
    AND (
      (p.proname IN ('activate_prepaid_pix_ride','claim_prepaid_pix_initial_dispatch','reverse_refunded_ride_payment')
       AND (has_function_privilege('anon',p.oid,'EXECUTE')
         OR has_function_privilege('authenticated',p.oid,'EXECUTE')
         OR NOT has_function_privilege('service_role',p.oid,'EXECUTE')))
      OR
      (p.proname LIKE 'admin_%' AND p.proname<>'admin_is_authorized'
       AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR NOT has_function_privilege('service_role',p.oid,'EXECUTE')))
    )
  ) THEN RAISE EXCEPTION 'INV-018 Corridas privilege invariant failed'; END IF;
END
$apois_corridas_acl$;