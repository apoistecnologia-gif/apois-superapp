-- PostgreSQL 17 isolated role/ACL model, no data, JWT or Supabase APIs.
\set ON_ERROR_STOP on
CREATE TYPE public.app_role AS ENUM ('admin','driver');
CREATE FUNCTION public.admin_get_dashboard_metrics() RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.admin_get_finance_summary(timestamptz,timestamptz) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.admin_provision_staff(uuid,public.app_role,text DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.admin_set_driver_approval(uuid,text,text DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.admin_set_driver_suspension(uuid,boolean,text DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.activate_prepaid_pix_ride(uuid,text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT '{}'::jsonb $$;
DO $test$
DECLARE name text; found_oid oid;
BEGIN
 FOR name IN SELECT unnest(ARRAY[
  'public.admin_get_dashboard_metrics()',
  'public.admin_get_finance_summary(timestamptz,timestamptz)',
  'public.admin_provision_staff(uuid,public.app_role,text)',
  'public.admin_set_driver_approval(uuid,text,text)',
  'public.admin_set_driver_suspension(uuid,boolean,text)',
  'public.activate_prepaid_pix_ride(uuid,text)'
 ]) LOOP
  found_oid:=to_regprocedure(name);
  IF found_oid IS NULL OR NOT has_function_privilege('anon',found_oid,'EXECUTE')
  THEN RAISE EXCEPTION 'Expected default PUBLIC EXECUTE before staged hardening: %',name; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Reproduced anonymous EXECUTE exposure on six sensitive RPC signatures';
END;
$test$;
