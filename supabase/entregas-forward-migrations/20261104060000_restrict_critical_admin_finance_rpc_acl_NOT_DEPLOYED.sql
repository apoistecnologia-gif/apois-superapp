-- APOIS ENTREGAS: future-only least-privilege ACL for five critical admin RPCs.
-- READ-ONLY diagnosis verified live anon EXECUTE on 2026-11-04.
-- NOT DEPLOYED to production. No changes to function bodies or financial data.
-- Preserve existing authenticated admin interface and backend service access.
BEGIN;
DO $apois_admin_acl_guard$
BEGIN
 IF to_regprocedure('public.admin_settle_payout(uuid,text,text,text,text)') IS NULL
 OR to_regprocedure('public.admin_update_platform_setting(text,jsonb)') IS NULL
 OR to_regprocedure('public.admin_create_fee_rule(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)') IS NULL
 OR to_regprocedure('public.admin_update_fee_rule(uuid,numeric,numeric,numeric,numeric,numeric)') IS NULL
 OR to_regprocedure('public.admin_set_fee_rule_active(uuid,boolean)') IS NULL THEN
  RAISE EXCEPTION 'ENTREGAS_CRITICAL_ADMIN_RPC_SIGNATURE_DRIFT'
    USING ERRCODE='55000';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_proc p WHERE p.oid IN (
    'public.admin_settle_payout(uuid,text,text,text,text)'::regprocedure,
    'public.admin_update_platform_setting(text,jsonb)'::regprocedure,
    'public.admin_create_fee_rule(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure,
    'public.admin_update_fee_rule(uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure,
    'public.admin_set_fee_rule_active(uuid,boolean)'::regprocedure
  ) AND NOT p.prosecdef
 ) THEN
  RAISE EXCEPTION 'ENTREGAS_CRITICAL_ADMIN_RPC_SECURITY_MODE_DRIFT'
    USING ERRCODE='55000';
 END IF;
END;
$apois_admin_acl_guard$;
REVOKE EXECUTE ON FUNCTION public.admin_settle_payout(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_platform_setting(text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_fee_rule(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_fee_rule(uuid,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_fee_rule_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settle_payout(uuid,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_setting(text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_fee_rule(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_fee_rule(uuid,numeric,numeric,numeric,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_fee_rule_active(uuid,boolean) TO authenticated, service_role;
COMMIT;
