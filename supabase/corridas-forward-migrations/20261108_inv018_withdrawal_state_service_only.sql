-- INV-018 Corridas — three withdrawal state mutations are service-role-only.
-- Existing functions already reject non-service callers; no business functions executed.
DO $$
DECLARE f regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mark_driver_withdrawal_failed(uuid,text,jsonb)'::regprocedure,
    'public.mark_driver_withdrawal_paid(uuid,text,text,jsonb)'::regprocedure,
    'public.mark_driver_withdrawal_processing(uuid)'::regprocedure
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid=f::oid AND p.prosecdef=true
      AND pg_get_functiondef(p.oid) ILIKE '%service_role_required%'
      AND pg_get_functiondef(p.oid) ILIKE '%auth.role()%'
    ) THEN RAISE EXCEPTION 'Unexpected service guard in %',f; END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
    IF has_function_privilege('anon',f::oid,'EXECUTE')
       OR has_function_privilege('authenticated',f::oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',f::oid,'EXECUTE')
    THEN RAISE EXCEPTION 'Invalid post ACL on %',f; END IF;
  END LOOP;
END $$;
