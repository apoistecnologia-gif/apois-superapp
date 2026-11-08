-- APOIS INV-018: restrict direct anonymous access to admin SECURITY DEFINER RPCs.
-- Scope: existing public.admin_* privileged functions only.
-- Preserves admin authentication checks and authenticated/service_role execution.
-- No order, payout, provider, customer data, or schema mutation.
-- Rollback (only if specifically required): GRANT EXECUTE ON FUNCTION ... TO anon;
-- Do not regrant to PUBLIC: that would also reopen anonymous access.
DO $apois_admin_acl$
DECLARE
  function_record record;
  target_signature text;
  function_count integer := 0;
BEGIN
  FOR function_record IN
    SELECT p.oid, n.nspname, p.proname
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND left(p.proname, 6) = 'admin_'
    ORDER BY p.proname, p.oid
  LOOP
    target_signature := format(
      '%I.%I(%s)',
      function_record.nspname,
      function_record.proname,
      pg_catalog.pg_get_function_identity_arguments(function_record.oid)
    );
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', target_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', target_signature);
    function_count := function_count + 1;
  END LOOP;

  IF function_count < 20 THEN
    RAISE EXCEPTION 'Expected at least 20 privileged admin functions, found %', function_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef AND left(p.proname,6)='admin_'
      AND (
        pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        OR NOT pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'INV-018 admin privilege invariant failed';
  END IF;
END
$apois_admin_acl$;