-- APOIS / Report 14 / INV-067 — EMERGENCY FAIL-CLOSED containment only.
-- QA_NOT_APPLIED. NOT a reverse-to-vulnerable-state rollback.
-- Do not execute without explicit approval and staging testing.
-- It keeps participant audit data and protects the passenger and staff.
-- It temporarily DISABLES ALL driver access to case content after an issue.
-- Previously issued signed URLs cannot be revoked just by this SQL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $guard$
DECLARE v_access text;
BEGIN
 IF to_regclass('public.apois_case_driver_participants') IS NULL
    OR to_regprocedure('public.apois_grant_case_driver_participant(uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.apois_revoke_case_driver_participant(uuid,uuid,text)') IS NULL THEN
   RAISE EXCEPTION 'REPORT14_ROLLBACK_NOT_APPLICABLE: migration not installed';
 END IF;
 v_access := pg_get_functiondef('public.apois_case_access(uuid)'::regprocedure);
 IF position('public.apois_case_driver_participants' IN v_access)=0
    OR NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='passenger_support_tickets'
        AND policyname='apois case ticket linked driver read'
        AND qual LIKE '%apois_case_access%'
    ) THEN
   RAISE EXCEPTION 'REPORT14_ROLLBACK_NEEDS_REVIEW: authorization contract drift';
 END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.apois_case_access(_ticket_id uuid)
 RETURNS text
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE t public.passenger_support_tickets%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RETURN 'none'; END IF;
 SELECT * INTO t FROM public.passenger_support_tickets WHERE id=_ticket_id;
 IF NOT FOUND THEN RETURN 'none'; END IF;
 IF private.has_permission('support.read') THEN RETURN 'staff'; END IF;
 IF t.passenger_id=public.mobility_user_id() THEN RETURN 'passenger'; END IF;
 -- Emergency containment: no participant or current ride driver can read cases.
 RETURN 'none';
END; $function$;

DROP POLICY "apois case ticket linked driver read"
  ON public.passenger_support_tickets;
CREATE POLICY "apois case ticket linked driver read"
  ON public.passenger_support_tickets FOR SELECT TO authenticated
  USING (false);

REVOKE ALL ON FUNCTION
  public.apois_grant_case_driver_participant(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.apois_revoke_case_driver_participant(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;

-- DO NOT DROP audit/participant records, RLS, status events, evidence or RPCs.
-- A new, reviewed migration is required to restore authorized driver access.
-- Keep the original per-request driver's former access disabled until repaired.
COMMIT;
