-- Report 1 — private merchant/courier KYC document storage access.
-- Exact ownership (merchant manager/owner or courier auth.uid) is required.
-- Admins may read documents for approval. NO public reads, no DELETE/UPDATE grants.
-- Rollback: DROP the four apois_kyc_*_v1 policies on storage.objects.
DO $pre$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['merchant-documents','courier-documents'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id=b AND public=false
        AND file_size_limit=15728640
        AND allowed_mime_types @> ARRAY[
          'image/jpeg','image/png','image/webp','application/pdf'
        ]::text[]
    ) THEN RAISE EXCEPTION 'Private KYC bucket % is absent or changed',b; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN (
        'apois_kyc_merchant_insert_v1',
        'apois_kyc_merchant_select_v1',
        'apois_kyc_courier_insert_v1',
        'apois_kyc_courier_select_v1'
      )
  ) THEN RAISE EXCEPTION 'A KYC policy already exists; review before reapplying'; END IF;
END $pre$;

CREATE POLICY apois_kyc_merchant_insert_v1
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='merchant-documents'
  AND coalesce(array_length(storage.foldername(name),1),0)=1
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND storage.filename(name) ~* '^(documento_empresa|responsavel|comprovante_endereco)-[0-9]{13}\.(jpg|jpeg|png|webp|pdf)$'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id::text=(storage.foldername(name))[1]
      AND (
        public.current_user_is_merchant_manager(m.id)
        OR public.current_user_is_merchant_owner(m.id)
      )
  )
);

CREATE POLICY apois_kyc_merchant_select_v1
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='merchant-documents'
  AND (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id::text=(storage.foldername(name))[1]
        AND (
          public.current_user_is_merchant_manager(m.id)
          OR public.current_user_is_merchant_owner(m.id)
        )
    )
  )
);

CREATE POLICY apois_kyc_courier_insert_v1
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='courier-documents'
  AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND (storage.foldername(name))[2] IS NULL
  AND storage.filename(name) ~* '^(cnh|documento_veiculo|foto_perfil)-[0-9]{13}\.(jpg|jpeg|png|webp|pdf)$'
  AND (SELECT public.current_user_courier_id()) IS NOT NULL
);

CREATE POLICY apois_kyc_courier_select_v1
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='courier-documents'
  AND (
    public.current_user_is_admin()
    OR (
      (storage.foldername(name))[1]=(SELECT auth.uid())::text
      AND (storage.foldername(name))[2] IS NULL
      AND (SELECT public.current_user_courier_id()) IS NOT NULL
    )
  )
);
