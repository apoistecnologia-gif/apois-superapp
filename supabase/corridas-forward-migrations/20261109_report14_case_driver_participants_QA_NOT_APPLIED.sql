-- APOIS Report 14 / INV-067 — FOR REVIEW ONLY — QA_NOT_APPLIED.
-- DO NOT run on production without formal approval, staging RLS/Storage E2E
-- and manual triage of legacy tickets. No rows are read or backfilled here.
-- Target (verified read-only 2026-11-09): Supabase Corridas tbbzkrfupmqdywnzgnms.
-- Changes: explicit per-ticket driver participants, staff-only audited grant/
-- revoke, immutable snapshot at request, shared access authority for ticket,
-- visible events, evidence metadata, storage.objects and RPCs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

-- Refuse to migrate an unexpected backend, changed policy or second application.
DO $apois_report14_guard$
DECLARE
  v_access text;
  v_request text;
BEGIN
  IF to_regclass('public.apois_case_driver_participants') IS NOT NULL THEN
    RAISE EXCEPTION 'REPORT14_NEEDS_REVIEW: participants table already exists';
  END IF;
  IF to_regprocedure('public.apois_case_access(uuid)') IS NULL
     OR to_regprocedure('public.apois_request_driver_statement(uuid)') IS NULL
     OR to_regprocedure('public.apois_case_reply(uuid,text)') IS NULL
     OR to_regprocedure('public.apois_case_register_evidence(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'REPORT14_NEEDS_REVIEW: case RPC contracts changed';
  END IF;
  v_access := pg_get_functiondef('public.apois_case_access(uuid)'::regprocedure);
  v_request := pg_get_functiondef('public.apois_request_driver_statement(uuid)'::regprocedure);
  IF position('r.driver_id' IN v_access) = 0
     OR position('t.driver_response_requested_at IS NOT NULL' IN v_access) = 0
     OR position('driver_response_requested_by' IN v_request) = 0
     OR position('FOR UPDATE' IN v_request) = 0 THEN
    RAISE EXCEPTION 'REPORT14_NEEDS_REVIEW: original authorization or request changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passenger_support_tickets'
      AND policyname = 'apois case ticket linked driver read'
      AND cmd = 'SELECT' AND qual LIKE '%ride.driver_id%'
  ) THEN
    RAISE EXCEPTION 'REPORT14_NEEDS_REVIEW: direct ticket policy changed';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN ('apois case read only authorized',
                           'apois case upload authorized')
        AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%apois_case_access%') <> 2
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE schemaname = 'public'
         AND tablename = 'apois_case_events' AND cmd = 'SELECT'
         AND qual LIKE '%visible_to_parties%'
         AND qual LIKE '%apois_case_access%'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE schemaname = 'public'
         AND tablename = 'apois_case_evidence' AND cmd = 'SELECT'
         AND qual LIKE '%apois_case_access%'
     ) THEN
    RAISE EXCEPTION 'REPORT14_NEEDS_REVIEW: case event/evidence/storage policy changed';
  END IF;
END;
$apois_report14_guard$;

-- No generic authenticated SELECT; this table is accessible only through
-- SECURITY DEFINER helpers which enforce auth.uid()/staff permission.
-- Identity is the SNAPSHOT of drivers.user_id, not rides.driver_id at read time.
CREATE TABLE public.apois_case_driver_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.passenger_support_tickets(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  driver_user_id uuid NOT NULL REFERENCES public.users(id),
  grant_kind text NOT NULL CHECK (grant_kind IN ('statement_request','staff_grant')),
  grant_reason text NOT NULL CHECK (length(btrim(grant_reason)) BETWEEN 8 AND 500),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_auth_id uuid NOT NULL,
  revoked_at timestamptz,
  revoked_by_auth_id uuid,
  revoke_reason text,
  CONSTRAINT apois_case_driver_revocation_consistent CHECK (
    (revoked_at IS NULL AND revoked_by_auth_id IS NULL AND revoke_reason IS NULL)
    OR
    (revoked_at IS NOT NULL AND revoked_by_auth_id IS NOT NULL
     AND length(btrim(coalesce(revoke_reason,''))) BETWEEN 16 AND 500)
  )
);
-- Append-only grant history: revoked invitations remain auditable, and a
-- later explicit re-grant inserts a new row rather than overwriting the old.
CREATE UNIQUE INDEX apois_case_driver_participants_active_unique_idx
  ON public.apois_case_driver_participants(ticket_id,driver_user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX apois_case_driver_participants_active_lookup_idx
  ON public.apois_case_driver_participants(driver_user_id,ticket_id)
  WHERE revoked_at IS NULL;
ALTER TABLE public.apois_case_driver_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apois_case_driver_participants FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.apois_case_driver_participants IS
  'Report14: explicit audited per-case driver invitations; revoked rows retained for review; no automatic legacy backfill or current ride driver read grants.';

-- Keep former staff/passenger rights and exact 'none' semantics.
-- Driver rights now require a staff-created participant and a statement request.
CREATE OR REPLACE FUNCTION public.apois_case_access(_ticket_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.passenger_support_tickets%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RETURN 'none'; END IF;
 SELECT * INTO t FROM public.passenger_support_tickets WHERE id=_ticket_id;
 IF NOT FOUND THEN RETURN 'none'; END IF;
 IF private.has_permission('support.read') THEN RETURN 'staff'; END IF;
 IF t.passenger_id=public.mobility_user_id() THEN RETURN 'passenger'; END IF;
 IF t.ride_id IS NOT NULL AND t.driver_response_requested_at IS NOT NULL
    AND EXISTS(
      SELECT 1 FROM public.apois_case_driver_participants p
       WHERE p.ticket_id=t.id
         AND p.driver_user_id=public.mobility_user_id()
         AND p.revoked_at IS NULL
    )
 THEN RETURN 'driver'; END IF;
 RETURN 'none';
END; $function$;

-- Preserve original permission, open-case guard, idempotence, requestor field
-- and visible status event. Lock ride assignment before capturing target A.
CREATE OR REPLACE FUNCTION public.apois_request_driver_statement(_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_case public.passenger_support_tickets%rowtype;
 v_driver_id uuid;
 v_driver_user_id uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL
    OR NOT private.has_permission('support.read') THEN
   RAISE EXCEPTION 'forbidden';
 END IF;
 SELECT * INTO v_case FROM public.passenger_support_tickets
   WHERE id=_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_case.status NOT IN ('open','in_progress') THEN
   RAISE EXCEPTION 'case_unavailable';
 END IF;
 -- Legacy tickets with an existing request but no verified participant stay
 -- fail-closed. Repeated requests must NOT grant the current substitute.
 IF v_case.driver_response_requested_at IS NOT NULL THEN RETURN; END IF;
 IF v_case.ride_id IS NULL THEN RAISE EXCEPTION 'driver_not_assigned'; END IF;
 SELECT r.driver_id,d.user_id INTO v_driver_id,v_driver_user_id
 FROM public.rides r
 JOIN public.drivers d ON d.id=r.driver_id
 WHERE r.id=v_case.ride_id
 FOR SHARE OF r,d;
 IF v_driver_id IS NULL OR v_driver_user_id IS NULL THEN
   RAISE EXCEPTION 'driver_not_assigned';
 END IF;

 INSERT INTO public.apois_case_driver_participants
 (ticket_id,driver_id,driver_user_id,grant_kind,grant_reason,granted_by_auth_id)
 VALUES (_ticket_id,v_driver_id,v_driver_user_id,'statement_request',
         'Solicitação formal de esclarecimento ao motorista',(SELECT auth.uid()));
 UPDATE public.passenger_support_tickets
 SET driver_response_requested_at=now(),
     driver_response_requested_by=(SELECT auth.uid()),
     updated_at=now()
 WHERE id=_ticket_id;
 INSERT INTO public.apois_case_events
 (ticket_id,actor_user_id,actor_role,kind,message)
 VALUES(_ticket_id,(SELECT auth.uid()),'staff','status',
        'A equipe APOIS solicitou esclarecimentos ao motorista.');
END; $function$;

-- Existing ticket SELECT was a second, inconsistent grant based on mutable
-- ride assignment. The same helper used by events, metadata, RPC and bucket
-- is now the single driver authority. Staff/owner policies remain unchanged.
DROP POLICY "apois case ticket linked driver read"
  ON public.passenger_support_tickets;
CREATE POLICY "apois case ticket linked driver read"
  ON public.passenger_support_tickets FOR SELECT TO authenticated
  USING (public.apois_case_access(id) = 'driver');

-- Deliberate, audited admin inclusion: needed only if a new recipient B must
-- participate or a LEGACY case is reviewed with independent evidence.
-- No automatic backfill; grant is never based on the current ride driver.
CREATE FUNCTION public.apois_grant_case_driver_participant(
 _ticket_id uuid, _driver_id uuid, _reason text
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_case public.passenger_support_tickets%rowtype;
 v_user_id uuid;
 v_reason text := btrim(coalesce(_reason,''));
 v_changed integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.has_permission('support.read')
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(v_reason) NOT BETWEEN 16 AND 500 THEN
   RAISE EXCEPTION 'review_reason_required';
 END IF;
 SELECT * INTO v_case FROM public.passenger_support_tickets
   WHERE id=_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_case.status NOT IN ('open','in_progress')
    OR v_case.ride_id IS NULL OR v_case.driver_response_requested_at IS NULL
 THEN RAISE EXCEPTION 'case_not_eligible'; END IF;
 SELECT d.user_id INTO v_user_id FROM public.drivers d WHERE d.id=_driver_id FOR SHARE OF d;
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'driver_not_found'; END IF;

 INSERT INTO public.apois_case_driver_participants
  (ticket_id,driver_id,driver_user_id,grant_kind,grant_reason,granted_by_auth_id)
 VALUES(_ticket_id,_driver_id,v_user_id,'staff_grant',v_reason,(SELECT auth.uid()))
 ON CONFLICT (ticket_id,driver_user_id) WHERE revoked_at IS NULL DO NOTHING;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed <> 1 THEN RAISE EXCEPTION 'participant_already_active'; END IF;

 INSERT INTO public.apois_case_events
 (ticket_id,actor_user_id,actor_role,kind,message,visible_to_parties)
 VALUES(_ticket_id,(SELECT auth.uid()),'staff','internal_note',
        'Concessão explícita de acesso ao motorista '||_driver_id::text||
        ' (usuário '||v_user_id::text||'). Justificativa: '||v_reason,FALSE);
END; $function$;

-- A logged revocation is necessary when an invite was granted in error.
-- Previously issued signed URLs can survive until their own expiry; document
-- and test this separately. No direct table UPDATE is granted to the client.
CREATE FUNCTION public.apois_revoke_case_driver_participant(
 _ticket_id uuid, _driver_user_id uuid, _reason text
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_case public.passenger_support_tickets%rowtype;
 v_reason text := btrim(coalesce(_reason,''));
 v_changed integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.has_permission('support.read')
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(v_reason) NOT BETWEEN 16 AND 500 THEN
   RAISE EXCEPTION 'review_reason_required';
 END IF;
 SELECT * INTO v_case FROM public.passenger_support_tickets
   WHERE id=_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;
 UPDATE public.apois_case_driver_participants
 SET revoked_at=now(),revoked_by_auth_id=(SELECT auth.uid()),
     revoke_reason=v_reason
 WHERE ticket_id=_ticket_id AND driver_user_id=_driver_user_id
   AND revoked_at IS NULL;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed <> 1 THEN RAISE EXCEPTION 'active_participant_not_found'; END IF;

 INSERT INTO public.apois_case_events
 (ticket_id,actor_user_id,actor_role,kind,message,visible_to_parties)
 VALUES(_ticket_id,(SELECT auth.uid()),'staff','internal_note',
        'Revogação de acesso ao usuário motorista '||_driver_user_id::text||
        '. Justificativa: '||v_reason,FALSE);
END; $function$;

-- Default function EXECUTE can include PUBLIC. Only authenticated clients
-- may call these staff-gated RPCs. Do not expose service_role secrets.
REVOKE ALL ON FUNCTION
  public.apois_grant_case_driver_participant(uuid,uuid,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION
  public.apois_revoke_case_driver_participant(uuid,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION
  public.apois_grant_case_driver_participant(uuid,uuid,text)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  public.apois_revoke_case_driver_participant(uuid,uuid,text)
  TO authenticated,service_role;

-- Existing apois_case_reply, apois_case_register_evidence, visible_to_parties,
-- evidence metadata RLS and storage.objects bucket policies remain unchanged.
-- All use public.apois_case_access; do not widen or remove their RLS.
-- Legacy requested tickets have no participant and thus no driver access until
-- audited staff review; NEVER assign their current rides.driver_id blindly.
COMMIT;
