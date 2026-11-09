-- INV-014: customer avatar uploads use immutable, MIME-typed paths.
-- Customer assets cannot overwrite courier avatar paths; no SELECT/DELETE/UPDATE granted.
-- Rollback: DROP POLICY apois_customer_avatar_versioned_insert_v1 ON storage.objects.
DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='avatars' AND public) THEN
    RAISE EXCEPTION 'INV-014: avatars bucket expected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='apois_customer_avatar_versioned_insert_v1'
  ) THEN RAISE EXCEPTION 'INV-014: policy already exists';
  END IF;
END $pre$;

CREATE POLICY apois_customer_avatar_versioned_insert_v1
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (storage.foldername(name))[2] = 'customer-avatar'
  AND (storage.foldername(name))[3] IS NULL
  AND storage.filename(name) ~* '^[0-9]{13}-[0-9a-f]{8}\.(jpg|png|webp)$'
  AND storage.extension(name) IN ('jpg','png','webp')
  AND (SELECT public.current_user_is_active())
);
