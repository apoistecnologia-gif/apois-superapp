-- Forward-only staged security hardening, NOT applied to production.
-- Verified against Corridas pg_proc / pg_get_functiondef on 2026-11-04 UTC.
-- All five admin wrappers delegate to apois_rpc_private protected by
-- auth.uid() + private.has_permission. Authenticated admin calls remain valid.
-- The legacy Pix activation already requires service_role within its body;
-- enforcing that restriction at ACL level reduces anonymous attack surface.
-- Do NOT change business logic, auth checks, or the payment provider.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.admin_get_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_metrics() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_get_finance_summary(timestamp with time zone,timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_finance_summary(timestamp with time zone,timestamp with time zone) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_provision_staff(uuid,public.app_role,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_staff(uuid,public.app_role,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_set_driver_approval(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_approval(uuid,text,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_set_driver_suspension(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_suspension(uuid,boolean,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.activate_prepaid_pix_ride(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_prepaid_pix_ride(uuid,text) TO service_role;
COMMIT;
