-- Run after applying staged checkout_rpc_service_role_only.sql in the same DB.
\set ON_ERROR_STOP on
DO $acl$
DECLARE signature text; v_record record;
BEGIN
 FOR signature IN SELECT * FROM (VALUES
 ('public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)'::text),
 ('public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)'::text),
 ('public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)'::text)
 ) x(sig) LOOP
  IF to_regprocedure(signature) IS NULL THEN RAISE EXCEPTION 'Missing function %',signature; END IF;
  IF has_function_privilege('anon',signature,'EXECUTE')
    OR has_function_privilege('authenticated',signature,'EXECUTE')
  THEN RAISE EXCEPTION 'Public checkout RPC remains callable: %',signature; END IF;
  IF NOT has_function_privilege('service_role',signature,'EXECUTE')
  THEN RAISE EXCEPTION 'Backend execution revoked: %',signature; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Three backend-only checkout RPCs deny anonymous/authenticated and permit service_role';
END;
$acl$;
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.create_order_for_checkout_intent_v2(NULL::uuid,NULL::uuid,NULL::jsonb,
   NULL::text,NULL::jsonb,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anon could call restricted backend checkout'; END IF;
 RAISE NOTICE '[PASS] Anonymous checkout RPC call fails at PostgreSQL EXECUTE ACL';
END;
$test$;
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.create_order_atomic_v2(NULL::uuid,NULL::uuid,NULL::jsonb,
   NULL::text,NULL::jsonb,NULL::uuid,NULL::text,NULL::text,NULL::text);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Authenticated could call backend-only order writer'; END IF;
 RAISE NOTICE '[PASS] Authenticated direct order writer fails at PostgreSQL ACL';
END;
$test$;
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
DO $test$
DECLARE result text;
BEGIN
 SELECT public.create_order_for_checkout_intent_v2(NULL::uuid,NULL::uuid,NULL::jsonb,
  NULL::text,NULL::jsonb,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text)
 INTO result;
 IF result <> 'synthetic-intent' THEN RAISE EXCEPTION 'Service-role checkout call lost access'; END IF;
 RAISE NOTICE '[PASS] Authenticated Edge backend service_role retains checkout RPC access';
END;
$test$;
COMMIT;
