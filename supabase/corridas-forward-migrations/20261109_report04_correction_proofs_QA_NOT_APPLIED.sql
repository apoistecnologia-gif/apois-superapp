-- INV-045/046 | PROPOSTA PARA STAGING, NAO APLICADA.
-- Migration isolada: provas de revisao dos itens pedidos e snapshot da frente.
-- NAO executar em producao nesta fase de relatorios. Nao ativar STAGE2 dos 13 fotos.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.drivers') IS NULL
     OR to_regclass('public.apois_driver_correction_requests') IS NULL
     OR to_regclass('public.apois_vehicle_inspection_photos') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regprocedure('private.apois_snapshot_front_on_document_change()') IS NULL
  THEN RAISE EXCEPTION 'apois_report04_prerequisite_missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.drivers'::regclass AND NOT t.tgisinternal
      AND t.tgname='apois_snapshot_front_on_vehicle_change') THEN
    RAISE EXCEPTION 'report04_front_trigger_already_registered_review_manually';
  END IF;
END $guard$;

-- A trilha e privada; o cliente nunca escolhe request_id ou grava uma "correcao".
CREATE TABLE IF NOT EXISTS private.apois_driver_correction_item_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.apois_driver_correction_requests(id),
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  item text NOT NULL CHECK (item IN ('selfie','cnh_front','cnh_back','crlv','manufacture_year')),
  document_path text,
  year_value integer,
  revised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT correction_revision_value_kind CHECK (
    (item='manufacture_year' AND year_value IS NOT NULL AND document_path IS NULL)
    OR (item<>'manufacture_year' AND document_path IS NOT NULL AND year_value IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS apois_driver_correction_doc_revision_unique
  ON private.apois_driver_correction_item_revisions(request_id,item,document_path)
  WHERE document_path IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS apois_driver_correction_year_revision_unique
  ON private.apois_driver_correction_item_revisions(request_id,item,year_value)
  WHERE year_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS apois_driver_correction_revisions_request
  ON private.apois_driver_correction_item_revisions(request_id,driver_id,item,revised_at DESC);
REVOKE ALL ON private.apois_driver_correction_item_revisions FROM PUBLIC,anon,authenticated;

-- Invocado dentro da mesma transacao do UPDATE de driver_update_document e do RPC de ano.
-- Apenas o titular autenticado pode produzir a prova; uma atualizacao administrativa
-- ou o simples updated_at nao comprovam correcoes feitas pelo motorista.
CREATE OR REPLACE FUNCTION private.apois_track_driver_correction_item_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE q public.apois_driver_correction_requests%rowtype;
        v_auth uuid;
        v_item text;
        v_before text;
        v_after text;
BEGIN
  SELECT u.auth_user_id INTO v_auth FROM public.users u WHERE u.id=NEW.user_id;
  IF v_auth IS NULL OR auth.uid() IS DISTINCT FROM v_auth THEN RETURN NEW; END IF;
  SELECT * INTO q FROM public.apois_driver_correction_requests
    WHERE driver_id=NEW.id AND state='correction_required'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  FOREACH v_item IN ARRAY ARRAY['selfie','cnh_front','cnh_back','crlv']::text[] LOOP
    IF v_item=ANY(q.required_items) THEN
      v_before:=CASE v_item WHEN 'selfie' THEN OLD.selfie_url
        WHEN 'cnh_front' THEN OLD.cnh_url WHEN 'cnh_back' THEN OLD.cnh_back_url
        ELSE OLD.vehicle_document_url END;
      v_after:=CASE v_item WHEN 'selfie' THEN NEW.selfie_url
        WHEN 'cnh_front' THEN NEW.cnh_url WHEN 'cnh_back' THEN NEW.cnh_back_url
        ELSE NEW.vehicle_document_url END;
      IF v_after IS NOT NULL AND v_before IS DISTINCT FROM v_after THEN
        INSERT INTO private.apois_driver_correction_item_revisions
            (request_id,driver_id,item,document_path)
          VALUES(q.id,NEW.id,v_item,v_after)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  IF 'manufacture_year'=ANY(q.required_items)
     AND NEW.vehicle_year IS NOT NULL
     AND OLD.vehicle_year IS DISTINCT FROM NEW.vehicle_year THEN
    INSERT INTO private.apois_driver_correction_item_revisions
      (request_id,driver_id,item,year_value)
    VALUES(q.id,NEW.id,'manufacture_year',NEW.vehicle_year)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS apois_track_driver_correction_revision ON public.drivers;
CREATE TRIGGER apois_track_driver_correction_revision
  AFTER UPDATE OF selfie_url,cnh_url,cnh_back_url,vehicle_document_url,vehicle_year
  ON public.drivers FOR EACH ROW
  EXECUTE FUNCTION private.apois_track_driver_correction_item_revision();

-- So a dependencia da frente: nao instalar os gates globais de aprovacao/idade.
-- O STAGE2 futuro reutiliza este mesmo nome de trigger (DROP + CREATE).
CREATE TRIGGER apois_snapshot_front_on_vehicle_change
  AFTER UPDATE OF vehicle_photo_url ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION private.apois_snapshot_front_on_document_change();

-- Reconhecimento do pedido inteiro: foto nova por slot, documento especifico
-- realmente trocado e ano efetivamente alterado depois da solicitacao.
CREATE OR REPLACE FUNCTION public.apois_driver_resubmit_corrections(_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  q public.apois_driver_correction_requests%rowtype;
  d public.drivers%rowtype;
  slot_name text;
  v_path text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
  SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'driver_profile_not_found'; END IF;
  SELECT * INTO q FROM public.apois_driver_correction_requests
    WHERE id=_request_id AND driver_id=d.id AND state='correction_required'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'correction_request_not_found'; END IF;
  IF q.required_items IS NULL OR cardinality(q.required_items)=0 THEN
    RAISE EXCEPTION 'empty_correction_request'; END IF;

  FOREACH slot_name IN ARRAY q.required_items LOOP
    IF slot_name IN ('front','right','left','dashboard','front_seats','rear_seats',
      'tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.apois_vehicle_inspection_photos p
        WHERE p.driver_id=d.id AND p.slot=slot_name
          AND p.submitted_at>=q.created_at
          AND (slot_name<>'front' OR
               (p.bucket_id='vehicle-documents' AND p.object_path=d.vehicle_photo_url))
      ) THEN
        RAISE EXCEPTION 'required_photo_not_resubmitted:%',slot_name;
      END IF;

    ELSIF slot_name IN ('selfie','cnh_front','cnh_back','crlv') THEN
      v_path:=CASE slot_name
        WHEN 'selfie' THEN d.selfie_url WHEN 'cnh_front' THEN d.cnh_url
        WHEN 'cnh_back' THEN d.cnh_back_url ELSE d.vehicle_document_url END;
      IF v_path IS NULL OR NOT EXISTS (
        SELECT 1 FROM private.apois_driver_correction_item_revisions r
        WHERE r.request_id=q.id AND r.driver_id=d.id AND r.item=slot_name
          AND r.document_path=v_path AND r.revised_at>=q.created_at
      ) THEN
        RAISE EXCEPTION 'required_document_not_updated:%',slot_name;
      END IF;

    ELSIF slot_name='manufacture_year' THEN
      IF d.category<>'carros'
         OR d.vehicle_year IS NULL
         OR d.vehicle_year<extract(year FROM current_date)::int-10
         OR d.vehicle_year>extract(year FROM current_date)::int
         OR NOT EXISTS (
           SELECT 1 FROM private.apois_driver_correction_item_revisions r
           WHERE r.request_id=q.id AND r.driver_id=d.id AND r.item='manufacture_year'
             AND r.year_value=d.vehicle_year AND r.revised_at>=q.created_at
         ) THEN
        RAISE EXCEPTION 'required_year_not_updated';
      END IF;
    ELSE
      RAISE EXCEPTION 'unknown_required_item:%',slot_name;
    END IF;
  END LOOP;

  UPDATE public.apois_driver_correction_requests
    SET state='resubmitted',resubmitted_at=now() WHERE id=q.id;
  UPDATE public.drivers
    SET documents_status='pending_review',updated_at=now() WHERE id=d.id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    VALUES((SELECT auth.uid()),'driver.corrections.resubmitted','driver',d.id::text,
      jsonb_build_object('request_id',q.id));
  RETURN true;
END $fn$;

-- Permissoes atuais do RPC publico devem continuar restritas conforme inventario.
-- Reconciliar GRANT/REVOKE em staging antes de deploy; nao conceder novos papéis.
COMMIT;
