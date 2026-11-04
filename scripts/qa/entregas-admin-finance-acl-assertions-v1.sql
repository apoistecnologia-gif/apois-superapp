-- Execute after exact staged ACL migration, on synthetic PG17 only.
DO $qa$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT p.oid,p.oid::regprocedure::text AS signature,
    pg_get_functiondef(p.oid) AS source
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.proname IN(
   'admin_settle_payout','admin_update_platform_setting','admin_create_fee_rule',
   'admin_update_fee_rule','admin_set_fee_rule_active'
  ) LOOP
  n:=n+1;
  IF has_function_privilege('anon',r.oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',r.oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',r.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Admin ACL mismatch after staged fix: %',r.signature;
  END IF;
  IF r.source IS DISTINCT FROM
      (SELECT source FROM public.qa_admin_function_source_before b
       WHERE b.signature=r.signature) THEN
    RAISE EXCEPTION 'Admin business function body unexpectedly altered: %',r.signature;
  END IF;
 END LOOP;
 IF n<>5 THEN RAISE EXCEPTION 'Expected 5 admin ACL signatures, found %',n; END IF;
 IF (SELECT pronargdefaults FROM pg_proc WHERE
    oid='public.admin_settle_payout(uuid,text,text,text,text)'::regprocedure)<>3 THEN
   RAISE EXCEPTION 'Admin payout default arguments were changed';
 END IF;
 RAISE NOTICE '[PASS] Five critical Entregas admin functions: no anon access; auth and service kept; bodies unchanged';
END;
$qa$;

-- SQL privilege refusal is asserted with an actual anonymous role call,
-- but the local dummy function has no real database/payout side effects.
SET ROLE anon;
DO $qa$
BEGIN
 BEGIN
  PERFORM public.admin_settle_payout(NULL::uuid,'paid');
  RAISE EXCEPTION 'Unexpected anonymous payout function execution';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '[PASS] Anonymous role cannot execute payout settlement RPC';
 END;
END;
$qa$;
RESET ROLE;
SET ROLE authenticated;
SELECT public.admin_settle_payout(NULL::uuid,'paid');
SELECT public.admin_update_platform_setting('qa-only','{}'::jsonb);
RESET ROLE;
SET ROLE service_role;
SELECT public.admin_settle_payout(NULL::uuid,'paid');
RESET ROLE;
