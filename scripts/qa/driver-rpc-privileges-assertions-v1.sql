-- Fail CI if the role boundary differs from the production sample.
\set ON_ERROR_STOP on
DO $test$
DECLARE sig text; entrypoint text; direct boolean;
BEGIN
 FOR sig,entrypoint,direct IN
  SELECT * FROM (VALUES
   ('apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric)','public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)',false),
   ('apois_rpc_private.driver_accept_ride(uuid)','public.driver_accept_ride(uuid)',false),
   ('apois_rpc_private.driver_accept_ride_candidate_legacy(uuid)',NULL::text,true),
   ('apois_rpc_private.driver_finish_ride(uuid)','public.driver_finish_ride(uuid)',false)
  ) cases(private_signature,public_signature,legacy)
 LOOP
  IF to_regprocedure(sig) IS NOT NULL THEN
   IF has_function_privilege('anon',sig,'EXECUTE')
      OR has_function_privilege('authenticated',sig,'EXECUTE')
      OR NOT has_function_privilege('service_role',sig,'EXECUTE') THEN
    RAISE EXCEPTION 'Private RPC privilege boundary violated: %',sig;
   END IF;
   IF NOT direct THEN
    IF to_regprocedure(entrypoint) IS NULL
       OR NOT has_function_privilege('authenticated',entrypoint,'EXECUTE')
       OR has_function_privilege('anon',entrypoint,'EXECUTE') THEN
     RAISE EXCEPTION 'Production-compatible public wrapper ACL missing: %',entrypoint;
    END IF;
   END IF;
  END IF;
 END LOOP;
 IF has_function_privilege('authenticated','private.driver_kyc_is_ready(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'KYC helper exposed to authenticated';
 END IF;
 RAISE NOTICE '[PASS] Private Corridas RPCs are service_role-only; staged public wrappers deny anon and permit authenticated';
END;
$test$;
-- Stage removes anon EXECUTE on all three public wrappers. A test anon
-- connection must now be denied by PostgreSQL privileges before execution.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $test$
DECLARE sig text; rejected boolean; reason text;
BEGIN
 FOR sig IN SELECT * FROM (VALUES
  ('public.driver_set_presence(false)'),
  ('public.driver_accept_ride(''30000000-0000-4000-8000-000000000101''::uuid)'),
  ('public.driver_finish_ride(''30000000-0000-4000-8000-000000000301''::uuid)')
 ) s(call) LOOP
  -- Only wrappers present in this fixture are called.
  IF (sig LIKE '%driver_set_presence%' AND to_regprocedure('public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)') IS NULL)
  OR (sig LIKE '%driver_accept_ride%' AND to_regprocedure('public.driver_accept_ride(uuid)') IS NULL)
  OR (sig LIKE '%driver_finish_ride%' AND to_regprocedure('public.driver_finish_ride(uuid)') IS NULL)
  THEN CONTINUE; END IF;
  rejected:=false;
  BEGIN
   EXECUTE 'SELECT ' || sig;
  EXCEPTION WHEN SQLSTATE '42501' THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason NOT LIKE 'permission denied for function %' THEN
    RAISE EXCEPTION 'Anonymous wrapper got %, expected SQL privilege denial',reason;
   END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Anonymous caller bypassed authorization: %',sig; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Anon wrapper calls denied by PostgreSQL EXECUTE ACL';
END;
$test$;
COMMIT;
