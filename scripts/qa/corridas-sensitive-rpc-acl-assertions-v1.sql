-- Only the published SQL migration may modify privileges in this DB.
\set ON_ERROR_STOP on
DO $test$
DECLARE name text; found_oid oid; role_name text; expected boolean; actual boolean;
BEGIN
 FOR name IN SELECT unnest(ARRAY[
  'public.admin_get_dashboard_metrics()',
  'public.admin_get_finance_summary(timestamptz,timestamptz)',
  'public.admin_provision_staff(uuid,public.app_role,text)',
  'public.admin_set_driver_approval(uuid,text,text)',
  'public.admin_set_driver_suspension(uuid,boolean,text)'
 ]) LOOP
  found_oid:=to_regprocedure(name);
  IF found_oid IS NULL THEN RAISE EXCEPTION 'RPC missing: %',name; END IF;
  FOR role_name,expected IN SELECT * FROM (VALUES
   ('anon',false),('authenticated',true),('service_role',true)
  ) cases(role_name,expected) LOOP
   actual:=has_function_privilege(role_name,found_oid,'EXECUTE');
   IF actual IS DISTINCT FROM expected THEN
     RAISE EXCEPTION 'Wrong ACL % / %: % expected %',name,role_name,actual,expected;
   END IF;
  END LOOP;
 END LOOP;
 found_oid:=to_regprocedure('public.activate_prepaid_pix_ride(uuid,text)');
 FOR role_name,expected IN SELECT * FROM (VALUES
  ('anon',false),('authenticated',false),('service_role',true)
 ) cases(role_name,expected) LOOP
  actual:=has_function_privilege(role_name,found_oid,'EXECUTE');
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Pix activation role %: % expected %',role_name,actual,expected;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Five admin APIs are authenticated-only; legacy Pix activation is service-role-only';
END;
$test$;
-- Verify actual SQL EXECUTE denial and retained admin access, not only catalog.
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE forbidden boolean:=false;
BEGIN
 BEGIN
  PERFORM public.admin_get_dashboard_metrics();
 EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
 END;
 IF NOT forbidden THEN RAISE EXCEPTION 'Anonymous role executed sensitive admin API'; END IF;
 RAISE NOTICE '[PASS] Anonymous SQL caller cannot invoke privileged admin API';
END;
$test$;
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT public.admin_get_dashboard_metrics();
DO $test$
DECLARE forbidden boolean:=false;
BEGIN
 BEGIN
  PERFORM public.activate_prepaid_pix_ride(NULL,NULL);
 EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
 END;
 IF NOT forbidden THEN RAISE EXCEPTION 'Authenticated role executed service-only Pix API'; END IF;
 RAISE NOTICE '[PASS] Authenticated caller retains admin wrapper EXECUTE but not Pix activation';
END;
$test$;
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.activate_prepaid_pix_ride(NULL,NULL);
COMMIT;
