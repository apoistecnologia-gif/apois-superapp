-- Test the actual prepared guard function using controlled fake JWT identities.
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public,auth,apois_rpc_private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA apois_rpc_private TO authenticated;
CREATE OR REPLACE FUNCTION public.qa_submit_driver() RETURNS jsonb
LANGUAGE sql AS $fn$
 SELECT apois_rpc_private.driver_complete_registration_v3(
  'QA New Name', '87999990000','00000000000',DATE '1990-01-01',
  'Cidade QA','PE','Rua QA','1',NULL,'Centro','56300000',1800,
  'carros','Modelo QA','ABC1D23','Preto',2020,
  auth.uid()::text || '/selfie.jpg',
  auth.uid()::text || '/cnh-front.jpg',
  auth.uid()::text || '/cnh-back.jpg',
  auth.uid()::text || '/crlv.jpg',
  auth.uid()::text || '/car-front.jpg',NULL
 );
$fn$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-0000-4000-8000-000000000001',true);
SELECT public.qa_submit_driver();
SELECT set_config('request.jwt.claim.sub','11111111-0000-4000-8000-000000000005',true);
SELECT public.qa_submit_driver();
SELECT set_config('request.jwt.claim.sub','11111111-0000-4000-8000-000000000006',true);
SELECT public.qa_submit_driver();

-- approved/suspended/blocked must all reject before any user/driver update.
DO $test$
DECLARE v_auth uuid; v_state text; rejected boolean; error_text text;
BEGIN
 FOR v_auth,v_state IN
  SELECT * FROM (VALUES
   ('11111111-0000-4000-8000-000000000002'::uuid,'aprovado'),
   ('11111111-0000-4000-8000-000000000003'::uuid,'suspenso'),
   ('11111111-0000-4000-8000-000000000004'::uuid,'bloqueado')
  ) AS cases(auth_id,approval_status)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',v_auth::text,true);
  rejected:=false;
  BEGIN
   PERFORM public.qa_submit_driver();
  EXCEPTION WHEN SQLSTATE '42501' THEN
   GET STACKED DIAGNOSTICS error_text=MESSAGE_TEXT;
   IF error_text <> 'driver_registration_closed' THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'registration bypassed state %',v_state; END IF;
  RAISE NOTICE '[PASS] Registration blocked for %',v_state;
 END LOOP;
END;
$test$;
COMMIT;
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.drivers;
 IF n<>6 THEN RAISE EXCEPTION 'Expected 6 synthetic driver rows; got %',n;END IF;
 SELECT count(*) INTO n FROM public.user_roles WHERE role='driver';
 IF n<>3 THEN RAISE EXCEPTION 'Exactly three permitted submissions should create roles, saw %',n;END IF;
 SELECT count(*) INTO n FROM public.drivers
  WHERE user_id IN (
   'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000005',
   'aaaaaaaa-0000-4000-8000-000000000006'
  ) AND approval_status='em_analise' AND documents_status='pending_review'
    AND name='QA New Name';
 IF n<>3 THEN RAISE EXCEPTION 'Permitted new/rejected/pending flows regressed, saw %',n;END IF;
 SELECT count(*) INTO n FROM public.drivers d JOIN public.users u ON u.id=d.user_id
 WHERE (
  (d.approval_status='aprovado' AND d.name='Approved unchanged'
   AND d.is_online AND d.approved_at='2026-10-01'::timestamptz AND u.name='Original approved')
 OR (d.approval_status='suspenso' AND d.name='Suspended unchanged'
   AND d.approved_at='2026-10-02'::timestamptz AND u.name='Original suspended')
 OR (d.approval_status='bloqueado' AND d.name='Blocked unchanged'
   AND d.approved_at='2026-10-03'::timestamptz AND u.name='Original blocked')
 );
 IF n<>3 THEN RAISE EXCEPTION 'Protected approved/suspended/blocked profiles changed';END IF;
 RAISE NOTICE '[PASS] Real PostgreSQL synthetic driver registration guard: 6 status cases, no downgrade';
END;
$test$;
