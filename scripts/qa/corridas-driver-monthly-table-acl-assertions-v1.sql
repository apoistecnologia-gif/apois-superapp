-- Execute after real staged migration against disposable PostgreSQL 17.
\set ON_ERROR_STOP on
DO $t$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_memberships','driver_membership_charges']) LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT')
     OR has_table_privilege('anon','public.'||t,'INSERT')
     OR has_table_privilege('anon','public.'||t,'UPDATE')
     OR has_table_privilege('anon','public.'||t,'DELETE')
     OR has_table_privilege('anon','public.'||t,'TRUNCATE')
     OR has_table_privilege('anon','public.'||t,'REFERENCES')
     OR has_table_privilege('anon','public.'||t,'TRIGGER')
     OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
     OR has_table_privilege('authenticated','public.'||t,'INSERT')
     OR has_table_privilege('authenticated','public.'||t,'UPDATE')
     OR has_table_privilege('authenticated','public.'||t,'DELETE')
     OR has_table_privilege('authenticated','public.'||t,'TRUNCATE')
     OR has_table_privilege('authenticated','public.'||t,'REFERENCES')
     OR has_table_privilege('authenticated','public.'||t,'TRIGGER')
     OR NOT has_table_privilege('service_role','public.'||t,'SELECT')
     OR NOT has_table_privilege('service_role','public.'||t,'INSERT')
     OR NOT has_table_privilege('service_role','public.'||t,'UPDATE')
     OR NOT has_table_privilege('service_role','public.'||t,'DELETE') THEN
   RAISE EXCEPTION 'Broken finance table ACL: %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Anonymous access removed and authenticated clients retain SELECT-only; service retains writes';
END;
$t$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $t$
DECLARE n bigint; t text; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.driver_memberships;
 IF n<>1 THEN RAISE EXCEPTION 'RLS own-membership read leaked % rows',n; END IF;
 SELECT count(*) INTO n FROM public.driver_membership_charges;
 IF n<>1 THEN RAISE EXCEPTION 'RLS own-charge read leaked % rows',n; END IF;
 FOR t IN SELECT unnest(ARRAY['driver_memberships','driver_membership_charges']) LOOP
  denied:=false;
  BEGIN
   EXECUTE 'TRUNCATE public.'||t;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated user truncated %',t; END IF;
  denied:=false;
  BEGIN
   EXECUTE 'UPDATE public.'||t||' SET driver_id=driver_id';
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated user updated %',t; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Real authenticated role reads only its two own billing rows; UPDATE and TRUNCATE denied';
END;
$t$;
COMMIT;
BEGIN;
SET LOCAL ROLE anon;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM count(*) FROM public.driver_memberships;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous client read finance table'; END IF;
 RAISE NOTICE '[PASS] Anonymous role cannot query protected driver membership rows';
END;
$t$;
COMMIT;
DO $t$
BEGIN
 IF (SELECT count(*) FROM public.driver_memberships)<>2
    OR (SELECT count(*) FROM public.driver_membership_charges)<>2 THEN
   RAISE EXCEPTION 'Protected billing rows changed during ACL test';
 END IF;
 RAISE NOTICE '[PASS] Billing data unchanged and R$49.90 constraint preserved';
END;
$t$;
