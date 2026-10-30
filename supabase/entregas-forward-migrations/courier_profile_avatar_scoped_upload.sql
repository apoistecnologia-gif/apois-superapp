-- APOIS ENTREGAS / HOMOLOGAÇÃO: deploy only after review.
-- Reuse existing public "avatars" bucket. Uploaded pictures are public by design.
-- Allow authenticated approved couriers to create images in their own path;
-- no UPDATE/DELETE grants, no document or approval state changes.
-- Photo URL itself is saved through existing public.profiles owner-only UPDATE RLS.

DO $qa$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars'
      AND public IS TRUE
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'Expected public avatars bucket with image MIME restrictions is missing';
  END IF;
END
$qa$;

DROP POLICY IF EXISTS "APOIS courier own profile avatar upload" ON storage.objects;

CREATE POLICY "APOIS courier own profile avatar upload"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'courier-profile'
    AND (storage.foldername(name))[3] IS NULL
    AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.user_id = (SELECT auth.uid())
        AND c.status = 'approved'
        AND c.is_active IS TRUE
    )
  );
