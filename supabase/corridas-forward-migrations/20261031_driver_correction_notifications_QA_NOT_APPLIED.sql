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
DROP TRIGGER IF EXISTS apois_snapshot_front_on_vehicle_change ON public.drivers;
CREATE TRIGGER apois_snapshot_front_on_vehicle_change
AFTER INSERT OR UPDATE OF vehicle_photo_url ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_snapshot_front_on_document_change();

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
DROP TRIGGER IF EXISTS apois_prevent_approval_during_corrections ON public.drivers;
CREATE TRIGGER apois_prevent_approval_during_corrections
BEFORE UPDATE OF approval_status ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_prevent_approval_during_corrections();
