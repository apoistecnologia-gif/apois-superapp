-- INV-044: trilha de reconciliacao de upload privado, PREPARADA, NAO APLICAR AGORA.
-- Nao faz DELETE em storage.objects nem remove bytes de Storage.
-- Um servico administrativo pode reconciliar pendencias em data posterior,
-- sempre respeitando referenciados e dados de auditoria.
BEGIN;
DO $guard$
BEGIN
  IF to_regclass('public.drivers') IS NULL OR to_regclass('storage.objects') IS NULL
     OR to_regclass('public.apois_vehicle_inspection_photos') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
  THEN RAISE EXCEPTION 'apois_inv044_prerequisite_missing'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS public.apois_driver_document_cleanup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  slot text NOT NULL CHECK(slot IN ('selfie','cnh_front','cnh_back','crlv','vehicle_photo')),
  bucket_id text NOT NULL CHECK(bucket_id IN ('driver-selfies','driver-cnh','vehicle-documents')),
  object_path text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','linked','retained_evidence')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT apois_driver_cleanup_object_unique UNIQUE (bucket_id,object_path)
);
ALTER TABLE public.apois_driver_document_cleanup_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apois_driver_document_cleanup_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.apois_driver_document_cleanup_requests TO service_role;
-- Nenhuma policy de SELECT/DELETE cliente. Nao liberar anon/auth.

-- Apenas a Edge Function autenticada chama esta RPC com a service_role.
-- O token de usuario e validado na Edge ANTES; cliente nao chama RPC diretamente.
CREATE OR REPLACE FUNCTION public.apois_driver_document_reconcile_candidate(
  _auth_id uuid, _slot text, _bucket text, _path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  d public.drivers%rowtype;
  v_bucket text;
  v_path text;
  v_linked boolean;
  v_evidence boolean;
  v_state text;
  v_queue_id uuid;
  v_complete boolean;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING errcode='42501';
  END IF;
  IF _auth_id IS NULL OR _slot NOT IN
     ('selfie','cnh_front','cnh_back','crlv','vehicle_photo') THEN
    RAISE EXCEPTION 'invalid_reconcile_request' USING errcode='22023'; END IF;
  v_bucket:=CASE _slot WHEN 'selfie' THEN 'driver-selfies'
    WHEN 'cnh_front' THEN 'driver-cnh' WHEN 'cnh_back' THEN 'driver-cnh'
    WHEN 'crlv' THEN 'vehicle-documents' ELSE 'vehicle-documents' END;
  IF _bucket IS DISTINCT FROM v_bucket OR _path IS NULL
     OR length(_path)>255 OR _path !~ (
        '^'||_auth_id::text||'/'||_slot||'-[0-9]{13}\.(jpg|png|webp|pdf)$')
     OR (_slot IN ('selfie','vehicle_photo') AND right(_path,4)='.pdf')
  THEN RAISE EXCEPTION 'invalid_reconcile_path' USING errcode='22023'; END IF;

  SELECT * INTO d FROM public.drivers
    WHERE user_id=(SELECT u.id FROM public.users u WHERE u.auth_user_id=_auth_id)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'driver_profile_missing' USING errcode='P0002'; END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id=v_bucket
       AND o.name=_path AND o.owner_id=_auth_id::text)
  THEN RETURN jsonb_build_object('status','not_found'); END IF;

  v_path:=CASE _slot
    WHEN 'selfie' THEN d.selfie_url
    WHEN 'cnh_front' THEN d.cnh_url
    WHEN 'cnh_back' THEN d.cnh_back_url
    WHEN 'crlv' THEN d.vehicle_document_url
    ELSE d.vehicle_photo_url END;
  v_linked:=v_path IS NOT DISTINCT FROM _path;
  v_evidence:=EXISTS(
    SELECT 1 FROM public.apois_vehicle_inspection_photos p
    WHERE p.driver_id=d.id AND p.bucket_id=_bucket AND p.object_path=_path
  ) OR EXISTS(
    SELECT 1 FROM public.audit_logs a
    WHERE a.action='driver.document.replaced'
      AND a.entity_type='driver' AND a.entity_id=d.id::text
      AND a.metadata->>'storage_path'=_path
  );
  v_state:=CASE WHEN v_linked THEN 'linked'
       WHEN v_evidence THEN 'retained_evidence' ELSE 'pending' END;
  INSERT INTO public.apois_driver_document_cleanup_requests
    (owner_auth,driver_id,slot,bucket_id,object_path,status)
  VALUES(_auth_id,d.id,_slot,_bucket,_path,v_state)
  ON CONFLICT(bucket_id,object_path) DO UPDATE
     SET last_checked_at=clock_timestamp(),status=excluded.status
     WHERE public.apois_driver_document_cleanup_requests.owner_auth=excluded.owner_auth
       AND public.apois_driver_document_cleanup_requests.driver_id=excluded.driver_id
  RETURNING id INTO v_queue_id;
  IF v_queue_id IS NULL THEN RAISE EXCEPTION 'reconcile_owner_mismatch'; END IF;

  v_complete:=d.selfie_url IS NOT NULL AND d.cnh_url IS NOT NULL
    AND d.cnh_back_url IS NOT NULL AND d.vehicle_document_url IS NOT NULL
    AND d.vehicle_photo_url IS NOT NULL;
  RETURN jsonb_build_object(
    'status',v_state,'recorded',true,
    'result',CASE WHEN v_linked THEN jsonb_build_object(
      'ok',true,'driver_id',d.id,'slot',_slot,'documents_status',d.documents_status,
      'approval_status',d.approval_status,'complete',v_complete)
      ELSE NULL END
  );
END $fn$;
REVOKE ALL ON FUNCTION public.apois_driver_document_reconcile_candidate(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apois_driver_document_reconcile_candidate(uuid,text,text,text)
  TO service_role;
COMMIT;
