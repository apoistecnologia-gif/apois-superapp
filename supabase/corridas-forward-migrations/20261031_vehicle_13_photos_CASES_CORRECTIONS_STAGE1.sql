-- APOIS CORRIDAS STAGE-1: BASE STRUCTURES, NO DRIVER APPROVAL ENFORCEMENT
-- Authorized by user 2026-10-31: continue coordinated releases.
-- It creates additive private structures + staff RPCs but intentionally leaves the THREE driver-table triggers inactive.
-- DO NOT consider new 13-photo rule fully live until partner app distribution and stage-2 gate activation.
-- Legacy 3 approved drivers untouched; no test messages or user records created.

-- APOIS CORRIDAS — homologação: vistoria fotográfica e ocorrências com trilha auditável.
-- NÃO APLICADA: validar E2E, revisão jurídica LGPD e preflight sem APK antes da implantação.
-- Não migra nem modifica históricos, corridas, pagamentos ou cadastros aprovados.
-- Fotos e provas SEMPRE privadas, sem acesso público e sem sobrescrita por clientes.

CREATE TABLE IF NOT EXISTS public.apois_vehicle_inspection_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id uuid NOT NULL REFERENCES public.drivers(id),
 slot text NOT NULL CHECK(slot IN ('front','right','left','dashboard','front_seats','rear_seats','tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on')),
 bucket_id text NOT NULL CHECK(bucket_id IN ('vehicle-documents','apois-inspections')),
 object_path text NOT NULL UNIQUE,
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 declared_plate text,
 review_status text NOT NULL DEFAULT 'pending'
    CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_at timestamptz,
 reviewed_by uuid,
 review_note text,
 CHECK (review_note IS NULL OR length(review_note)<=500)
);
CREATE INDEX IF NOT EXISTS apois_vehicle_inspection_driver_slot_idx
 ON public.apois_vehicle_inspection_photos(driver_id,slot,submitted_at DESC);
ALTER TABLE public.apois_vehicle_inspection_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_vehicle_inspection_photos FROM PUBLIC,anon,authenticated;

-- Every admin review decision is permanently recorded, including reversals.
CREATE TABLE IF NOT EXISTS public.apois_vehicle_inspection_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 photo_id uuid NOT NULL REFERENCES public.apois_vehicle_inspection_photos(id),
 actor_auth_id uuid,
 previous_status text NOT NULL,
 new_status text NOT NULL,
 review_note text,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apois_inspection_reviews_photo_idx
 ON public.apois_vehicle_inspection_review_events(photo_id,recorded_at);
ALTER TABLE public.apois_vehicle_inspection_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_vehicle_inspection_review_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.apois_audit_inspection_photo_review()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF OLD.review_status IS DISTINCT FROM NEW.review_status OR OLD.review_note IS DISTINCT FROM NEW.review_note THEN
   INSERT INTO public.apois_vehicle_inspection_review_events(photo_id,actor_auth_id,previous_status,new_status,review_note)
   VALUES(NEW.id,NEW.reviewed_by,OLD.review_status,NEW.review_status,NEW.review_note);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS apois_audit_inspection_review ON public.apois_vehicle_inspection_photos;
CREATE TRIGGER apois_audit_inspection_review
AFTER UPDATE OF review_status,review_note ON public.apois_vehicle_inspection_photos
FOR EACH ROW EXECUTE FUNCTION private.apois_audit_inspection_photo_review();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('apois-inspections','apois-inspections',false,8388608,ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('apois-case-evidence','apois-case-evidence',false,8388608,ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[])
ON CONFLICT(id) DO NOTHING;

-- Original signup already uploads selfie, CNH, CRLV, front vehicle view and avatar;
-- production storage currently has no INSERT policies, so keep all uploads private
-- and limit these existing buckets to the signed-in user's own UUID prefix.
CREATE POLICY "apois initial driver documents upload own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id IN ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
 AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND (storage.foldername(name))[2] IS NULL
 AND storage.extension(name) IN ('jpg','png','webp','pdf')
);
-- No client UPDATE/DELETE of document evidence; users can send a new UUID path.

-- Own temporary upload path: auth-uuid / slot / random-file (cannot overwrite).
CREATE POLICY "apois vehicle inspection upload own file" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='apois-inspections'
 AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND (storage.foldername(name))[2] IN ('right','left','dashboard','front_seats','rear_seats','tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on')
 AND (storage.foldername(name))[3] IS NULL
 AND storage.extension(name) IN ('jpg','png','webp')
);
-- No public SELECT, UPDATE or DELETE of private inspection files.

CREATE OR REPLACE FUNCTION public.apois_submit_driver_vehicle_inspection(_slots jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
 d public.drivers%rowtype;
 slot_name text;
 path_name text;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
 IF NOT FOUND OR d.category<>'carros' THEN RAISE EXCEPTION 'driver_car_required'; END IF;
 IF d.vehicle_photo_url IS NULL OR split_part(d.vehicle_photo_url,'/',1)<>(SELECT auth.uid())::text
 THEN RAISE EXCEPTION 'front_photo_required'; END IF;
 IF _slots IS NULL OR jsonb_typeof(_slots)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(_slots))<>12 THEN
   RAISE EXCEPTION 'twelve_additional_photos_required';
 END IF;
 -- Front is already verified at registration; keep immutable review snapshot.
 INSERT INTO public.apois_vehicle_inspection_photos(driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
 VALUES(d.id,'front','vehicle-documents',d.vehicle_photo_url,(SELECT auth.uid()),d.vehicle_plate)
 ON CONFLICT (object_path) DO NOTHING;
 FOREACH slot_name IN ARRAY ARRAY['right','left','dashboard','front_seats','rear_seats','tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on']
 LOOP
   path_name := _slots->>slot_name;
   IF path_name IS NULL OR length(path_name)>255
      OR path_name !~ ('^'||(SELECT auth.uid())::text||'/'||slot_name||'/[a-zA-Z0-9_-]{12,64}\.(jpg|png|webp)$')
   THEN RAISE EXCEPTION 'invalid_photo_path'; END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='apois-inspections'
       AND o.name=path_name AND o.owner_id=(SELECT auth.uid())::text)
   THEN RAISE EXCEPTION 'photo_not_uploaded'; END IF;
   INSERT INTO public.apois_vehicle_inspection_photos(driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
   VALUES(d.id,slot_name,'apois-inspections',path_name,(SELECT auth.uid()),d.vehicle_plate)
   ON CONFLICT(object_path) DO NOTHING;
 END LOOP;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apois_submit_driver_vehicle_inspection(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_submit_driver_vehicle_inspection(jsonb) TO authenticated;

-- Fail closed for new car registrations; preserve legacy approved drivers.
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS apois_inspection_required boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.apois_review_vehicle_photo(_id uuid,_approved boolean,_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF NOT private.has_permission('users.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(coalesce(_note,''))>500 THEN RAISE EXCEPTION 'invalid_note'; END IF;
 UPDATE public.apois_vehicle_inspection_photos
 SET review_status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
     reviewed_at=now(),reviewed_by=(SELECT auth.uid()),review_note=nullif(trim(_note),'')
 WHERE id=_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'photo_not_found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.apois_review_vehicle_photo(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_review_vehicle_photo(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.apois_require_vehicle_inspection()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   NEW.apois_inspection_required := (NEW.category='carros');
 ELSE
   -- Canonical registration v3 UPSERT may UPDATE an existing pending driver row.
   -- When a new car/photo is registered, mark it for inspection without blocking
   -- already approved legacy drivers whose vehicle has not changed.
   IF NEW.category='carros'
      AND (OLD.category IS DISTINCT FROM NEW.category
           OR OLD.vehicle_photo_url IS DISTINCT FROM NEW.vehicle_photo_url)
   THEN NEW.apois_inspection_required := true;
   END IF;
   -- Only UPDATE has a valid OLD record; avoid referencing it on INSERT.
   IF NEW.approval_status='aprovado' AND OLD.approval_status IS DISTINCT FROM 'aprovado'
      AND NEW.apois_inspection_required THEN
      -- Vehicle year is declared *year of manufacture*, max 10 full calendar years.
      IF NEW.vehicle_year IS NULL OR NEW.vehicle_year < extract(year from CURRENT_DATE)::int-10
         OR NEW.vehicle_year > extract(year from CURRENT_DATE)::int THEN
        RAISE EXCEPTION 'apois_car_manufacture_year_out_of_policy';
      END IF;
   IF (SELECT count(*) FROM (
         SELECT DISTINCT ON (slot) slot,review_status
           FROM public.apois_vehicle_inspection_photos
          WHERE driver_id=NEW.id
            AND declared_plate=NEW.vehicle_plate
            AND submitted_at>=NEW.created_at
          ORDER BY slot,submitted_at DESC,id DESC
       ) latest WHERE latest.review_status='approved')<13 THEN
       RAISE EXCEPTION 'vehicle_inspection_13_photos_incomplete';
   END IF;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
-- STAGE-1 RELEASE: apois_require_vehicle_inspection_on_driver deliberately NOT activated; old app remains compatible.

-- Existing canonical passenger ticket is retained; do not create a parallel case.
CREATE TABLE IF NOT EXISTS public.apois_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES public.passenger_support_tickets(id),
 actor_user_id uuid,
 actor_role text NOT NULL CHECK(actor_role IN ('passenger','driver','staff','system')),
 kind text NOT NULL CHECK(kind IN ('opened','comment','driver_response','status','internal_note')),
 visible_to_parties boolean NOT NULL DEFAULT true,
 message text NOT NULL CHECK(length(message) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind<>'internal_note' OR visible_to_parties=false)
);
CREATE INDEX IF NOT EXISTS apois_case_events_ticket_created_idx ON public.apois_case_events(ticket_id,created_at,id);
CREATE TABLE IF NOT EXISTS public.apois_case_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES public.passenger_support_tickets(id),
 event_id uuid REFERENCES public.apois_case_events(id),
 uploader_auth_id uuid NOT NULL,
 bucket_id text NOT NULL DEFAULT 'apois-case-evidence' CHECK(bucket_id='apois-case-evidence'),
 object_path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 160),
 content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
 uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apois_case_evidence_ticket_idx ON public.apois_case_evidence(ticket_id,uploaded_at);
ALTER TABLE public.apois_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apois_case_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_case_events,public.apois_case_evidence FROM PUBLIC,anon,authenticated;

-- The staff must triage before disclosing allegations/evidence to the driver.
ALTER TABLE public.passenger_support_tickets
 ADD COLUMN IF NOT EXISTS driver_response_requested_at timestamptz,
 ADD COLUMN IF NOT EXISTS driver_response_requested_by uuid;

-- Driver may consult only cases involving a ride assigned to their account.
CREATE POLICY "apois case ticket linked driver read" ON public.passenger_support_tickets
FOR SELECT TO authenticated
USING (ride_id IS NOT NULL AND driver_response_requested_at IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.rides ride JOIN public.drivers d ON d.id=ride.driver_id
  WHERE ride.id=passenger_support_tickets.ride_id AND d.user_id=public.mobility_user_id()
));

-- Security-definer identity predicate checks ownership against the existing ride.
CREATE OR REPLACE FUNCTION public.apois_case_access(_ticket_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE t public.passenger_support_tickets%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RETURN 'none'; END IF;
 SELECT * INTO t FROM public.passenger_support_tickets WHERE id=_ticket_id;
 IF NOT FOUND THEN RETURN 'none'; END IF;
 IF private.has_permission('support.read') THEN RETURN 'staff'; END IF;
 IF t.passenger_id=public.mobility_user_id() THEN RETURN 'passenger'; END IF;
 IF t.ride_id IS NOT NULL AND t.driver_response_requested_at IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.rides r JOIN public.drivers d ON d.id=r.driver_id
   WHERE r.id=t.ride_id AND d.user_id=public.mobility_user_id())
 THEN RETURN 'driver'; END IF;
 RETURN 'none';
END; $$;
REVOKE ALL ON FUNCTION public.apois_case_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_case_access(uuid) TO authenticated;

CREATE POLICY "apois case events read authorized" ON public.apois_case_events
 FOR SELECT TO authenticated USING (
   public.apois_case_access(ticket_id)='staff'
   OR (visible_to_parties AND public.apois_case_access(ticket_id) IN ('passenger','driver'))
 );
CREATE POLICY "apois case evidence metadata read authorized" ON public.apois_case_evidence
 FOR SELECT TO authenticated USING (public.apois_case_access(ticket_id) IN ('staff','passenger','driver'));
GRANT SELECT ON public.apois_case_events,public.apois_case_evidence TO authenticated;
-- No direct INSERT, UPDATE, DELETE of evidence/event rows via Data API.

CREATE OR REPLACE FUNCTION public.apois_open_ride_case(_ride_id uuid,_category text,_subject text,_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_ticket public.passenger_support_tickets%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR public.mobility_user_id() IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rides r WHERE r.id=_ride_id AND r.passenger_id=public.mobility_user_id())
 THEN RAISE EXCEPTION 'ride_not_owned'; END IF;
 IF _category NOT IN ('driver_behavior','vehicle_condition','vehicle_safety','route_problem','fare_question','other')
 OR length(trim(coalesce(_subject,''))) NOT BETWEEN 5 AND 160
 OR length(trim(coalesce(_message,''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'invalid_case'; END IF;
 INSERT INTO public.passenger_support_tickets(protocol,passenger_id,ride_id,category,subject,message,status,priority)
 VALUES('APOIS-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.apois_case_protocol_seq')::text,7,'0'),
 public.mobility_user_id(),_ride_id,_category,trim(_subject),trim(_message),'open',
 CASE WHEN _category='vehicle_safety' THEN 'high' ELSE 'normal' END)
 RETURNING * INTO v_ticket;
 INSERT INTO public.apois_case_events(ticket_id,actor_user_id,actor_role,kind,message)
 VALUES(v_ticket.id,(SELECT auth.uid()),'passenger','opened',trim(_message));
 RETURN jsonb_build_object('id',v_ticket.id,'protocol',v_ticket.protocol,'status',v_ticket.status);
END; $$;
CREATE SEQUENCE IF NOT EXISTS public.apois_case_protocol_seq AS bigint;
REVOKE ALL ON FUNCTION public.apois_open_ride_case(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_open_ride_case(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apois_request_driver_statement(_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_case public.passenger_support_tickets%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.has_permission('support.read') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO v_case FROM public.passenger_support_tickets WHERE id=_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_case.status NOT IN ('open','in_progress') THEN RAISE EXCEPTION 'case_unavailable'; END IF;
 IF v_case.ride_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.rides r WHERE r.id=v_case.ride_id AND r.driver_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'driver_not_assigned'; END IF;
 IF v_case.driver_response_requested_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.passenger_support_tickets
 SET driver_response_requested_at=now(),driver_response_requested_by=(SELECT auth.uid()),updated_at=now()
 WHERE id=_ticket_id;
 INSERT INTO public.apois_case_events(ticket_id,actor_user_id,actor_role,kind,message)
 VALUES(_ticket_id,(SELECT auth.uid()),'staff','status',
        'A equipe APOIS solicitou esclarecimentos ao motorista.');
END; $$;
REVOKE ALL ON FUNCTION public.apois_request_driver_statement(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_request_driver_statement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apois_case_reply(_ticket_id uuid,_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE role_name text; event_id uuid;
BEGIN
 role_name:=public.apois_case_access(_ticket_id);
 IF role_name NOT IN ('passenger','driver','staff') THEN RAISE EXCEPTION 'case_not_authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.passenger_support_tickets WHERE id=_ticket_id AND status IN ('open','in_progress')) THEN RAISE EXCEPTION 'case_closed'; END IF;
 IF length(trim(coalesce(_message,''))) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'invalid_reply'; END IF;
 INSERT INTO public.apois_case_events(ticket_id,actor_user_id,actor_role,kind,message)
 VALUES(_ticket_id,(SELECT auth.uid()),role_name,
   CASE WHEN role_name='driver' THEN 'driver_response' ELSE 'comment' END,trim(_message))
 RETURNING id INTO event_id;
 RETURN event_id;
END; $$;
REVOKE ALL ON FUNCTION public.apois_case_reply(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_case_reply(uuid,text) TO authenticated;

-- Staff private note is not visible to passenger or driver; records remain immutable.
CREATE OR REPLACE FUNCTION public.apois_case_internal_note(_ticket_id uuid,_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.has_permission('support.read') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(coalesce(_message,''))) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'invalid_note'; END IF;
 INSERT INTO public.apois_case_events(ticket_id,actor_user_id,actor_role,kind,visible_to_parties,message)
 VALUES(_ticket_id,(SELECT auth.uid()),'staff','internal_note',false,trim(_message))
 RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.apois_case_internal_note(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_case_internal_note(uuid,text) TO authenticated;

-- Evidence must be append-only and attributable to account and case; upload 8MB max.
CREATE POLICY "apois case upload authorized" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='apois-case-evidence'
 AND (storage.foldername(name))[2]=(SELECT auth.uid())::text
 AND (storage.foldername(name))[3] IS NULL
 AND storage.extension(name) IN ('jpg','png','webp','pdf')
 AND public.apois_case_access(
   CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
   THEN (storage.foldername(name))[1]::uuid ELSE NULL END
 ) IN ('passenger','driver','staff')
);
CREATE POLICY "apois case read only authorized" ON storage.objects FOR SELECT TO authenticated
USING (
 bucket_id='apois-case-evidence'
 AND public.apois_case_access(
    CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    THEN (storage.foldername(name))[1]::uuid ELSE NULL END
 ) IN ('passenger','driver','staff')
);
CREATE POLICY "apois inspections staff read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='apois-inspections' AND private.has_permission('drivers.read'));

CREATE OR REPLACE FUNCTION public.apois_case_register_evidence(_ticket_id uuid,_path text,_name text,_mime text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid; v_role text;
BEGIN
 v_role:=public.apois_case_access(_ticket_id);
 IF v_role NOT IN ('passenger','driver','staff') THEN RAISE EXCEPTION 'case_not_authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.passenger_support_tickets WHERE id=_ticket_id AND status IN ('open','in_progress')) THEN RAISE EXCEPTION 'case_closed'; END IF;
 IF length(_path)>260 OR _path !~ ('^'||_ticket_id::text||'/'||(SELECT auth.uid())::text||'/[a-zA-Z0-9_-]{12,64}\.(jpg|png|webp|pdf)$')
 OR _mime NOT IN ('image/jpeg','image/png','image/webp','application/pdf')
 OR length(trim(coalesce(_name,''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='apois-case-evidence'
 AND name=_path AND owner_id=(SELECT auth.uid())::text) THEN RAISE EXCEPTION 'evidence_not_uploaded'; END IF;
 INSERT INTO public.apois_case_evidence(ticket_id,uploader_auth_id,object_path,file_name,content_type)
 VALUES(_ticket_id,(SELECT auth.uid()),_path,trim(_name),_mime)
 RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.apois_case_register_evidence(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_case_register_evidence(uuid,text,text,text) TO authenticated;

-- Audit status changes, including existing admin status RPC; never expose internal notes.
CREATE OR REPLACE FUNCTION private.apois_audit_ticket_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
   INSERT INTO public.apois_case_events(ticket_id,actor_user_id,actor_role,kind,message)
   VALUES(NEW.id,(SELECT auth.uid()),'staff','status',
      'Status atualizado para '||NEW.status);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS apois_audit_ticket_status_change ON public.passenger_support_tickets;
CREATE TRIGGER apois_audit_ticket_status_change
 AFTER UPDATE OF status ON public.passenger_support_tickets
 FOR EACH ROW EXECUTE FUNCTION private.apois_audit_ticket_status();


-- APOIS CORRIDAS — workflow de pendências e notificações, NÃO APLICADO EM PRODUÇÃO.
-- Depends on 20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql.
-- Driver status remains "em_analise"; no preexisting approved driver is modified.
-- Email is QUEUED, never marked as delivered until provider API success.

CREATE TABLE public.apois_driver_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  required_items text[] NOT NULL CHECK (
    cardinality(required_items) BETWEEN 1 AND 20
    AND required_items <@ ARRAY[
      'front','right','left','dashboard','front_seats','rear_seats',
      'tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on',
      'selfie','cnh_front','cnh_back','crlv','manufacture_year'
    ]::text[]
  ),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  state text NOT NULL DEFAULT 'correction_required' CHECK(state IN ('correction_required','resubmitted','closed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resubmitted_at timestamptz,
  closed_at timestamptz
);
CREATE UNIQUE INDEX apois_driver_one_open_correction
 ON public.apois_driver_correction_requests(driver_id)
 WHERE state='correction_required';
CREATE INDEX apois_driver_correction_history
 ON public.apois_driver_correction_requests(driver_id,created_at DESC);
ALTER TABLE public.apois_driver_correction_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_driver_correction_requests FROM PUBLIC,anon,authenticated;

CREATE TABLE public.apois_driver_correction_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.apois_driver_correction_requests(id),
 to_email text NOT NULL CHECK (length(to_email) BETWEEN 5 AND 320),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','accepted_by_provider','failed')),
 attempts integer NOT NULL DEFAULT 0,
 provider_id text,
 last_error_code text,
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apois_driver_correction_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_driver_correction_email_outbox FROM PUBLIC,anon,authenticated;

-- Staff action. Emits an in-app notification and durable email outbox record atomically.
CREATE OR REPLACE FUNCTION public.apois_admin_request_driver_correction(
 _driver_id uuid,_items text[],_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE d public.drivers%rowtype; v_id uuid; v_email text; v_items text[];
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.has_permission('users.manage')
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 v_items:=ARRAY(SELECT DISTINCT x FROM unnest(_items) AS x ORDER BY x);
 IF cardinality(v_items) NOT BETWEEN 1 AND 18 OR
    v_items <@ ARRAY[
      'front','right','left','dashboard','front_seats','rear_seats',
      'tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on',
      'selfie','cnh_front','cnh_back','crlv','manufacture_year'
    ]::text[] IS NOT TRUE
 OR length(trim(coalesce(_reason,''))) NOT BETWEEN 10 AND 1000
 THEN RAISE EXCEPTION 'invalid_pending_items_or_reason'; END IF;
 SELECT * INTO d FROM public.drivers WHERE id=_driver_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'driver_not_found'; END IF;
 IF d.approval_status NOT IN ('em_analise','pendente','reprovado') THEN
   RAISE EXCEPTION 'only_unapproved_drivers_may_be_pended';
 END IF;
 UPDATE public.apois_driver_correction_requests
 SET state='closed',closed_at=now()
 WHERE driver_id=d.id AND state='correction_required';
 UPDATE public.drivers
 SET approval_status='em_analise',documents_status='correction_required',
     motivo_reprovacao=left(trim(_reason),500),is_online=false,updated_at=now()
 WHERE id=d.id;
 INSERT INTO public.apois_driver_correction_requests(driver_id,required_items,reason,created_by)
 VALUES(d.id,v_items,trim(_reason),(SELECT auth.uid())) RETURNING id INTO v_id;
 INSERT INTO public.notifications(user_id,title,body,data)
 VALUES(d.user_id,'Seu cadastro APOIS precisa de correções',
 'Abra Meus documentos para conferir as pendências e reenviar as informações solicitadas.',
 jsonb_build_object('type','driver_correction','request_id',v_id));
 SELECT coalesce(nullif(trim(u.email),''),nullif(trim(d.email),'')) INTO v_email
 FROM public.users u WHERE u.id=d.user_id;
 IF v_email IS NOT NULL AND v_email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' THEN
   INSERT INTO public.apois_driver_correction_email_outbox(request_id,to_email)
   VALUES(v_id,v_email);
 ELSE v_email:=NULL;
 END IF;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 VALUES((SELECT auth.uid()),'admin.driver.correction_requested','driver',d.id::text,
 jsonb_build_object('request_id',v_id,'items',v_items,'reason',trim(_reason)));
 RETURN jsonb_build_object('request_id',v_id,'email_queued',v_email IS NOT NULL);
END; $$;
REVOKE ALL ON FUNCTION public.apois_admin_request_driver_correction(uuid,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_admin_request_driver_correction(uuid,text[],text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apois_driver_my_corrections()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',q.id,'required_items',q.required_items,'reason',q.reason,'state',q.state,
  'created_at',q.created_at,'resubmitted_at',q.resubmitted_at
 ) ORDER BY q.created_at DESC),'[]'::jsonb)
 FROM public.apois_driver_correction_requests q
 JOIN public.drivers d ON d.id=q.driver_id
 WHERE d.user_id=public.mobility_user_id() AND (SELECT auth.uid()) IS NOT NULL
 LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.apois_driver_my_corrections() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_my_corrections() TO authenticated;

-- Upload a new photo into a new immutable object, only for one's own pending correction.
CREATE OR REPLACE FUNCTION public.apois_driver_correct_inspection_photo(
 _slot text,_path text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE d public.drivers%rowtype; q public.apois_driver_correction_requests%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
 SELECT * INTO q FROM public.apois_driver_correction_requests
 WHERE driver_id=d.id AND state='correction_required' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR _slot IS NULL OR NOT (_slot=ANY(q.required_items)) OR
   _slot NOT IN ('right','left','dashboard','front_seats','rear_seats',
    'tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on')
 THEN RAISE EXCEPTION 'photo_not_requested'; END IF;
 IF _path IS NULL OR length(_path)>255 OR
 _path !~ ('^'||(SELECT auth.uid())::text||'/'||_slot||'/[a-zA-Z0-9_-]{12,64}\.(jpg|png|webp)$')
 OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='apois-inspections'
   AND o.name=_path AND o.owner_id=(SELECT auth.uid())::text)
 THEN RAISE EXCEPTION 'invalid_photo'; END IF;
 INSERT INTO public.apois_vehicle_inspection_photos(
  driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
 VALUES(d.id,_slot,'apois-inspections',_path,(SELECT auth.uid()),d.vehicle_plate);
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apois_driver_correct_inspection_photo(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_correct_inspection_photo(text,text) TO authenticated;

-- Declared manufacture year correction is restricted to pending/new applicants.
CREATE OR REPLACE FUNCTION public.apois_driver_correct_manufacture_year(_year integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE d public.drivers%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
 IF NOT FOUND OR d.approval_status='aprovado' OR NOT EXISTS(
  SELECT 1 FROM public.apois_driver_correction_requests q
  WHERE q.driver_id=d.id AND q.state='correction_required' AND 'manufacture_year'=ANY(q.required_items)
 ) THEN RAISE EXCEPTION 'year_correction_not_authorized'; END IF;
 IF _year<extract(year FROM CURRENT_DATE)::int-10 OR _year>extract(year FROM CURRENT_DATE)::int
 THEN RAISE EXCEPTION 'car_manufacture_year_out_of_policy'; END IF;
 UPDATE public.drivers SET vehicle_year=_year,updated_at=now() WHERE id=d.id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apois_driver_correct_manufacture_year(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_correct_manufacture_year(integer) TO authenticated;

-- The driver acknowledges re-submission; the team still reviews all photos and documents.
CREATE OR REPLACE FUNCTION public.apois_driver_resubmit_corrections(_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE q public.apois_driver_correction_requests%rowtype; d public.drivers%rowtype; slot_name text;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
 SELECT * INTO q FROM public.apois_driver_correction_requests
 WHERE id=_request_id AND driver_id=d.id AND state='correction_required' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'correction_request_not_found'; END IF;
 FOREACH slot_name IN ARRAY q.required_items LOOP
  IF slot_name IN ('right','left','dashboard','front_seats','rear_seats',
   'tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on','front')
    AND NOT EXISTS(SELECT 1 FROM public.apois_vehicle_inspection_photos p
       WHERE p.driver_id=d.id AND p.slot=slot_name AND p.submitted_at>=q.created_at)
  THEN RAISE EXCEPTION 'required_photo_not_resubmitted:%',slot_name; END IF;
 END LOOP;
 UPDATE public.apois_driver_correction_requests SET state='resubmitted',resubmitted_at=now()
 WHERE id=q.id;
 UPDATE public.drivers SET documents_status='pending_review',updated_at=now() WHERE id=d.id;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 VALUES((SELECT auth.uid()),'driver.corrections.resubmitted','driver',d.id::text,
 jsonb_build_object('request_id',q.id));
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apois_driver_resubmit_corrections(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_resubmit_corrections(uuid) TO authenticated;

-- Only user-managed staff may trigger queued email; service role is the sole mail writer.
CREATE OR REPLACE FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND private.has_permission('users.manage')
   AND EXISTS(SELECT 1 FROM public.apois_driver_correction_email_outbox o
    WHERE o.request_id=_request_id AND o.status IN ('queued','failed'));
$$;
REVOKE ALL ON FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_admin_can_dispatch_driver_correction_mail(uuid) TO authenticated;


-- When vehicle front photo changes, snapshot its new immutable file for independent
-- staff review. Canonical driverDocuments.mobile updates drivers.vehicle_photo_url.
CREATE OR REPLACE FUNCTION private.apois_snapshot_front_on_document_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE owner_auth uuid;
BEGIN
 IF NEW.category<>'carros' OR NEW.vehicle_photo_url IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.vehicle_photo_url IS NOT DISTINCT FROM NEW.vehicle_photo_url THEN RETURN NEW; END IF;
 END IF;
 SELECT u.auth_user_id INTO owner_auth FROM public.users u WHERE u.id=NEW.user_id;
 IF owner_auth IS NULL OR split_part(NEW.vehicle_photo_url,'/',1)<>owner_auth::text THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='vehicle-documents' AND o.name=NEW.vehicle_photo_url
    AND o.owner_id=owner_auth::text) THEN RETURN NEW; END IF;
 INSERT INTO public.apois_vehicle_inspection_photos(
  driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
 VALUES(NEW.id,'front','vehicle-documents',NEW.vehicle_photo_url,owner_auth,NEW.vehicle_plate)
 ON CONFLICT(object_path) DO NOTHING;
 RETURN NEW;
END; $$;
-- STAGE-1 RELEASE: apois_snapshot_front_on_vehicle_change deliberately NOT activated; no driver status change.

-- Guard even the existing canonical admin_set_driver_approval RPC.
CREATE OR REPLACE FUNCTION private.apois_prevent_approval_during_corrections()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF NEW.approval_status='aprovado' AND OLD.approval_status IS DISTINCT FROM 'aprovado'
 AND EXISTS(SELECT 1 FROM public.apois_driver_correction_requests q
   WHERE q.driver_id=NEW.id AND q.state='correction_required')
 THEN RAISE EXCEPTION 'driver_has_unresolved_corrections'; END IF;
 RETURN NEW;
END; $$;
-- STAGE-1 RELEASE: apois_prevent_approval_during_corrections deliberately NOT activated; no driver status change.
