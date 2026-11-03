-- REVIEW ONLY; NOT APPLIED. Corridas tbbzkrfupmqdywnzgnms.
-- Extra server-side protection for photo review: prevent approval of missing/unowned Storage files.
-- Based on live public.apois_review_vehicle_photo definition and preserving existing users.manage RBAC.
-- Requires staging tests with valid signed images, deleted objects, cross-account files, rejection flow.
BEGIN;
CREATE OR REPLACE FUNCTION public.apois_review_vehicle_photo(_id uuid, _approved boolean, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT private.has_permission('users.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(coalesce(_note,''))>500 THEN RAISE EXCEPTION 'invalid_note'; END IF;
 -- Only approve a real image stored in the driver's own private Storage folder.
 -- Rejection remains allowed when the image is missing/corrupted.
 IF _approved AND NOT EXISTS (
    SELECT 1 FROM public.apois_vehicle_inspection_photos p
    JOIN public.drivers d ON d.id=p.driver_id
    JOIN public.users u ON u.id=d.user_id
    JOIN storage.objects o ON o.bucket_id=p.bucket_id AND o.name=p.object_path
      AND o.owner_id=u.auth_user_id::text
    WHERE p.id=_id AND u.auth_user_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'inspection_photo_missing_or_unowned' USING ERRCODE='42501'; END IF;
 UPDATE public.apois_vehicle_inspection_photos
 SET review_status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
     reviewed_at=now(),reviewed_by=(SELECT auth.uid()),review_note=nullif(trim(_note),'')
 WHERE id=_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'photo_not_found'; END IF;
END; $function$

COMMIT;
