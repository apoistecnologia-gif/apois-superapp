-- APOIS report 1 / storage merchant-assets: no global upload/delete grants.
-- Permit only an authenticated active owner/manager of the merchant whose
-- UUID is the first folder and only logo/cover images inside that folder.
-- Current (timestamp + nonce) and legacy (timestamp only) filenames are
-- supported for a safe transition. No SELECT/UPDATE/DELETE policy added.
-- Rollback: DROP POLICY apois_merchant_assets_manager_insert_v1 ON storage.objects.
DO $pre$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'merchant-assets' AND public
      AND file_size_limit = 10485760
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
  ) THEN RAISE EXCEPTION 'APOIS merchant-assets bucket settings changed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.current_user_is_merchant_manager(uuid)'::regprocedure
      AND p.prosecdef
  ) THEN RAISE EXCEPTION 'Merchant manager authority helper absent'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage'
      AND tablename='objects' AND policyname='apois_merchant_assets_manager_insert_v1'
  ) THEN RAISE EXCEPTION 'Policy already exists; do not reapply'; END IF;
END $pre$;

CREATE POLICY apois_merchant_assets_manager_insert_v1
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant-assets'
  AND coalesce(array_length(storage.foldername(name), 1), 0) = 1
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND storage.filename(name) ~* '^(logo|cover)-[0-9]{13}(-[0-9a-f]{8})?\.(jpg|jpeg|png|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id::text = (storage.foldername(name))[1]
      AND public.current_user_is_merchant_manager(m.id)
  )
);
