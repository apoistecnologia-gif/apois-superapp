-- REVIEW ONLY; NOT APPLIED. Corridas tbbzkrfupmqdywnzgnms.
-- Based on live public.apois_submit_driver_vehicle_inspection(_slots jsonb) definition.
-- Prevent approved phantom frontal inspection photos: validate actual Storage object ownership.
-- Existing role grants preserved by CREATE OR REPLACE; no table, role, approval or wallet mutation.
-- Requires isolated negative/positive authenticated upload tests before applying.
BEGIN;
CREATE OR REPLACE FUNCTION public.apois_submit_driver_vehicle_inspection(_slots jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 d public.drivers%rowtype;
 slot_name text;
 path_name text;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=public.mobility_user_id() FOR UPDATE;
 IF NOT FOUND OR d.category<>'carros' THEN RAISE EXCEPTION 'driver_car_required'; END IF;
 IF d.vehicle_photo_url IS NULL OR split_part(d.vehicle_photo_url,'/',1)<>(SELECT auth.uid())::text
 THEN RAISE EXCEPTION 'front_photo_required'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='vehicle-documents'
     AND o.name=d.vehicle_photo_url
     AND o.owner_id=(SELECT auth.uid())::text
 ) THEN
   RAISE EXCEPTION 'front_photo_storage_missing_or_not_owned' USING ERRCODE='42501';
 END IF;
 IF _slots IS NULL OR jsonb_typeof(_slots)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(_slots))<>12 THEN
   RAISE EXCEPTION 'twelve_additional_photos_required';
 END IF;
 -- Front Storage ownership verified above; retain immutable review snapshot.
 INSERT INTO public.apois_vehicle_inspection_photos(driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
 VALUES(d.id,'front','vehicle-documents',d.vehicle_photo_url,(SELECT auth.uid()),d.vehicle_plate)
 ON CONFLICT (object_path) DO NOTHING;
 FOREACH slot_name IN ARRAY ARRAY['right','left','dashboard','front_seats','rear_seats','tire_fl','tire_fr','tire_rl','tire_rr','belt_front','belt_rear','headlights_on']
 LOOP
   path_name := _slots->>slot_name;
   IF path_name IS NULL OR length(path_name)>255
      OR path_name !~ ('^'||(SELECT auth.uid())::text||'/'||slot_name||'/[a-zA-Z0-9_-]{12,64}\.(jpg|png|webp)$')
   THEN RAISE EXCEPTION 'invalid_photo_path'; END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='apois-inspections'
       AND o.name=path_name AND o.owner_id=(SELECT auth.uid())::text)
   THEN RAISE EXCEPTION 'photo_not_uploaded'; END IF;
   INSERT INTO public.apois_vehicle_inspection_photos(driver_id,slot,bucket_id,object_path,submitted_by,declared_plate)
   VALUES(d.id,slot_name,'apois-inspections',path_name,(SELECT auth.uid()),d.vehicle_plate)
   ON CONFLICT(object_path) DO NOTHING;
 END LOOP;
 RETURN true;
END; $function$

COMMIT;
