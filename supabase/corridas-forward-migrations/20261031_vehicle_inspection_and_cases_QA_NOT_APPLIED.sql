-- APOIS CORRIDAS — homologação: vistoria fotográfica e ocorrências com trilha auditável.
-- NÃO APLICADA: validar E2E, revisão jurídica LGPD e preflight sem APK antes da implantação.
-- Não migra nem modifica históricos, corridas, pagamentos ou cadastros aprovados.
-- Fotos e provas SEMPRE privadas, sem acesso público e sem sobrescrita por clientes.

CREATE TABLE IF NOT EXISTS public.apois_vehicle_inspection_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id uuid NOT NULL REFERENCES public.drivers(id),
 slot text NOT NULL CHECK(slot IN ('front','right','left','dashboard','front_seats','rear_seats')),
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

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('apois-inspections','apois-inspections',false,8388608,ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('apois-case-evidence','apois-case-evidence',false,8388608,ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[])
ON CONFLICT(id) DO NOTHING;

-- Own temporary upload path: auth-uuid / slot / random-file (cannot overwrite).
CREATE POLICY "apois vehicle inspection upload own file" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='apois-inspections'
 AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND (storage.foldername(name))[2] IN ('right','left','dashboard','front_seats','rear_seats')
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
 IF _slots IS NULL OR jsonb_typeof(_slots)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(_slots))<>5 THEN
   RAISE EXCEPTION 'five_photos_required';
 END IF;
 -- Front is already verified at registration; keep immutable review snapshot.
 INSERT INTO public.apois_vehicle_inspection_photos(driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
 VALUES(d.id,'front','vehicle-documents',d.vehicle_photo_url,(SELECT auth.uid()),d.vehicle_plate)
 ON CONFLICT (object_path) DO NOTHING;
 FOREACH slot_name IN ARRAY ARRAY['right','left','dashboard','front_seats','rear_seats']
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
AS $
BEGIN
 IF NOT private.has_permission('users.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(coalesce(_note,''))>500 THEN RAISE EXCEPTION 'invalid_note'; END IF;
 UPDATE public.apois_vehicle_inspection_photos
 SET review_status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
     reviewed_at=now(),reviewed_by=(SELECT auth.uid()),review_note=nullif(trim(_note),'')
 WHERE id=_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'photo_not_found'; END IF;
END; $;
REVOKE ALL ON FUNCTION public.apois_review_vehicle_photo(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_review_vehicle_photo(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.apois_require_vehicle_inspection()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   NEW.apois_inspection_required := (NEW.category='carros');
 ELSIF NEW.approval_status='aprovado' AND OLD.approval_status IS DISTINCT FROM 'aprovado'
       AND NEW.apois_inspection_required THEN
   IF (SELECT count(DISTINCT slot) FROM public.apois_vehicle_inspection_photos
       WHERE driver_id=NEW.id AND submitted_at>=NEW.created_at AND review_status='approved')<6 THEN
       RAISE EXCEPTION 'vehicle_inspection_incomplete';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS apois_require_vehicle_inspection_on_driver ON public.drivers;
CREATE TRIGGER apois_require_vehicle_inspection_on_driver
BEFORE INSERT OR UPDATE OF approval_status ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_require_vehicle_inspection();

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
 IF t.ride_id IS NOT NULL AND EXISTS(
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
