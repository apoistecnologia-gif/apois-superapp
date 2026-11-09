-- Report 1 / INV-001: private support attachment ownership and finalized-message access.
-- No public/anonymous access, no broad listing, no UPDATE/DELETE privileges.
-- Exact uploaded filename remains unique and access requires an existing ticket.
-- Rollback: DROP the two policies apois_support_attachment_{insert,read}_v1.
DO $pre$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'support-attachments' AND public = false
      AND file_size_limit = 15728640
      AND allowed_mime_types @> ARRAY[
        'image/jpeg','image/png','image/webp','application/pdf'
      ]::text[]
  ) THEN RAISE EXCEPTION 'Private support bucket absent or changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN ('apois_support_attachment_insert_v1','apois_support_attachment_read_v1')
  ) THEN RAISE EXCEPTION 'Support attachment policy already present'; END IF;
END $pre$;

CREATE POLICY apois_support_attachment_insert_v1
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='support-attachments'
  AND coalesce(array_length(storage.foldername(name),1),0)=2
  AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  AND storage.filename(name) ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,120}$'
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','pdf')
  AND (SELECT public.current_user_is_active())
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text=(storage.foldername(name))[2]
      AND t.requester_user_id=(SELECT auth.uid())
      AND t.status IN ('open','in_progress')
  )
);

CREATE POLICY apois_support_attachment_read_v1
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='support-attachments'
  AND coalesce(array_length(storage.foldername(name),1),0)=2
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text=(storage.foldername(name))[2]
      AND (
        t.requester_user_id=(SELECT auth.uid())
        OR public.current_user_is_admin()
      )
      AND EXISTS (
        SELECT 1 FROM public.support_messages sm
        WHERE sm.ticket_id=t.id
          AND sm.attachment_paths ? storage.objects.name
          AND (NOT sm.is_internal OR public.current_user_is_admin())
      )
  )
);
