-- REVIEW ONLY / NOT APPLIED. CORRIDAS tbbzkrfupmqdywnzgnms.
-- Active mailer v4 uses a staff-only RPC and can never reach its already_processed
-- branch because the current RPC rejects outboxes already accepted by the provider.
-- Preserve users.manage authorization; allow staff only to READ the accepted state.
-- Mailer still sends only for queued/failed and uses provider Idempotency-Key.
-- Test in isolated PostgreSQL before applying; do not apply to production blindly.
BEGIN;
DO $preflight$
BEGIN
 IF to_regprocedure('public.apois_admin_can_dispatch_driver_correction_mail(uuid)') IS NULL
    OR to_regclass('public.apois_driver_correction_email_outbox') IS NULL THEN
    RAISE EXCEPTION 'apois_mailer_idempotent_prerequisite_missing';
 END IF;
END;
$preflight$;
CREATE OR REPLACE FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL AND private.has_permission('users.manage')
   AND EXISTS(SELECT 1 FROM public.apois_driver_correction_email_outbox o
    WHERE o.request_id=_request_id AND o.status IN ('queued','failed','accepted_by_provider'));
$function$;
REVOKE ALL ON FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(uuid) TO authenticated,service_role;
DO $permissions$
BEGIN
 IF has_function_privilege('anon','public.apois_admin_can_dispatch_driver_correction_mail(uuid)','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.apois_admin_can_dispatch_driver_correction_mail(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'apois_mailer_idempotent_grant_regression'; END IF;
END;
$permissions$;
COMMIT;
-- Rollback after disabling the revised Edge: restore the original function with status IN ('queued','failed').
