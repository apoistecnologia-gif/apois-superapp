-- INV-015: allow authenticated merchant managers to upload NEW product images
-- solely to their own merchant/product path; no overwrites, listing or deletion.
-- Reversible: DROP POLICY apois_product_images_merchant_insert_v1 ON storage.objects.
-- Applied only after BEGIN/ROLLBACK DDL validation; no files or orders touched.
DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='product-images' AND public) THEN
    RAISE EXCEPTION 'INV-015: expected public product-images bucket missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='current_user_is_merchant_manager'
      AND p.oid='public.current_user_is_merchant_manager(uuid)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'INV-015: merchant authorization function missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='apois_product_images_merchant_insert_v1'
  ) THEN RAISE EXCEPTION 'INV-015: upload policy already present; do not reapply';
  END IF;
END $pre$;

CREATE POLICY apois_product_images_merchant_insert_v1
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='product-images'
  AND coalesce(array_length(storage.foldername(name),1),0)=1
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND storage.filename(name) ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9]{13}(-[0-9a-f]{8})?\.(jpg|png|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.merchant_id::text=(storage.foldername(name))[1]
      AND p.id::text=substring(storage.filename(name) FROM '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9]{13}')
      AND public.current_user_is_merchant_manager(p.merchant_id)
  )
);
