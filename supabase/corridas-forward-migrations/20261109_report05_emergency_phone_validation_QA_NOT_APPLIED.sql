-- APOIS Corridas • INV-050 | QA ONLY — NOT APPLIED
-- The currently deployed function only checks length <=40. This stage-only
-- replacement validates 8..15 digits and legal formatting without truncation.
-- No UPDATE of existing contacts, no migration of personal data, no production write.
BEGIN;
DO $guard$
BEGIN
  IF to_regprocedure('public.driver_add_emergency_contact(text,text,text)') IS NULL
     OR to_regclass('public.driver_emergency_contacts') IS NULL
     OR to_regclass('public.drivers') IS NULL
  THEN RAISE EXCEPTION 'report05_phone_prerequisite_missing'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.driver_add_emergency_contact(
 _name text, _phone text, _relation text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid;
  v_driver_id uuid;
  v_name text := nullif(btrim(coalesce(_name, '')), '');
  v_phone text := nullif(btrim(coalesce(_phone, '')), '');
  v_relation text := nullif(btrim(coalesce(_relation, '')), '');
  v_contact public.driver_emergency_contacts%rowtype;
  v_is_primary boolean;
  v_digits text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING errcode='42501';
  END IF;
  IF v_name IS NULL OR length(v_name)>120 THEN
    RAISE EXCEPTION 'invalid_emergency_contact_name' USING errcode='22023';
  END IF;
  IF v_phone IS NULL OR length(v_phone)>40
     OR v_phone !~ '^\+?[0-9 ().-]+$' THEN
    RAISE EXCEPTION 'invalid_emergency_contact_phone' USING errcode='22023';
  END IF;
  v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF length(v_digits)<8 OR length(v_digits)>15 THEN
    -- Never cut to 15 digits: reject entire malformed input.
    RAISE EXCEPTION 'invalid_emergency_contact_phone' USING errcode='22023';
  END IF;
  v_phone := CASE WHEN left(v_phone,1)='+' THEN '+' ELSE '' END || v_digits;
  IF v_relation IS NOT NULL AND length(v_relation)>120 THEN
    RAISE EXCEPTION 'invalid_emergency_contact_relation' USING errcode='22023';
  END IF;

  v_profile_id := public.mobility_user_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_missing' USING errcode='42501';
  END IF;
  SELECT d.id INTO v_driver_id FROM public.drivers d
    WHERE d.user_id=v_profile_id FOR UPDATE;
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver_profile_missing' USING errcode='42501';
  END IF;
  SELECT NOT EXISTS(
    SELECT 1 FROM public.driver_emergency_contacts c WHERE c.driver_id=v_driver_id
  ) INTO v_is_primary;
  INSERT INTO public.driver_emergency_contacts(driver_id,name,phone,relation,is_primary)
    VALUES(v_driver_id,v_name,v_phone,v_relation,v_is_primary)
    RETURNING * INTO v_contact;
  RETURN to_jsonb(v_contact);
END;
$function$;

-- Preserve the existing EXECUTE grants and ownership; no broad grants.
COMMIT;
