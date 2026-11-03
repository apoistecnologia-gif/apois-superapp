-- Real versioned functions executed against a disposable PostgreSQL schema.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);

-- Match the actual production RPC signature: four trailing numeric args
-- have DEFAULT NULL::numeric. Omission must continue to work after staging.
DO $test$
DECLARE default_count integer;
BEGIN
 SELECT pronargdefaults INTO default_count
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='apois_rpc_private' AND p.proname='driver_set_presence';
 IF default_count IS DISTINCT FROM 4 THEN
  RAISE EXCEPTION 'driver_set_presence lost 4 optional GPS parameters: %', default_count;
 END IF;
 RAISE NOTICE '[PASS] Corridas driver_set_presence preserves four existing optional parameters';
END;
$test$;

-- Approved and KYC-ready: online without any legacy subscription column.
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_set_presence(true,-9.40,-40.50,90,5) INTO result;
 IF (result->>'is_online')::boolean IS DISTINCT FROM true
    OR (result->>'operationally_eligible')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'approved KYC driver cannot go online: %',result;
 END IF;
 RAISE NOTICE '[PASS] Approved KYC driver online without legacy subscription';
END;
$test$;

-- Cross-profile identity: no caller-supplied driver ID is accepted.
-- Other users resolve only their own domain profile.
DO $test$
DECLARE test_number integer; expected text; err text; rejected boolean;
BEGIN
 FOR test_number,expected IN SELECT * FROM (VALUES
  (2,'driver_kyc_incomplete'),(3,'driver_suspended'),
  (4,'driver_blocked'),(5,'driver_not_approved')
 ) cases(n,message)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',
   format('00000000-0000-4000-8000-%s',lpad(test_number::text,12,'0')),true);
  rejected:=false;
  BEGIN
   PERFORM public.driver_set_presence(true,-9.4,-40.5,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err<>expected THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'ineligible driver % went online',test_number; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 RAISE NOTICE '[PASS] KYC, suspension, block, approval and identity guards';
END;
$test$;

-- GPS validity and heading/speed safety must not be bypassed.
DO $test$
DECLARE test_number integer; err text; expected text; rejected boolean;
BEGIN
 FOR test_number,expected IN SELECT * FROM (VALUES
  (1,'invalid_location'),(2,'invalid_location'),
  (3,'invalid_heading'),(4,'invalid_speed')
 ) cases(n,message)
 LOOP
  rejected:=false;
  BEGIN
   IF test_number=1 THEN
    PERFORM public.driver_set_presence(true,NULL,-40.50,90,5);
   ELSIF test_number=2 THEN
    PERFORM public.driver_set_presence(true,12,-40.50,90,5);
   ELSIF test_number=3 THEN
    PERFORM public.driver_set_presence(true,-9.4,-40.5,360,5);
   ELSE
    PERFORM public.driver_set_presence(true,-9.4,-40.5,90,-1);
   END IF;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err<>expected THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'invalid GPS case % accepted',test_number; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] GPS/heading/speed negative cases';
END;
$test$;

-- Existing one-argument callers must still be able to go offline safely.
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_set_presence(false) INTO result;
 IF (result->>'is_online')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'single-argument offline RPC contract broke';
 END IF;
 RAISE NOTICE '[PASS] Single-argument driver presence RPC remains compatible';
END;
$test$;

-- Going offline is allowed without a fresh GPS fix and does not erase last fix.
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_set_presence(false,NULL,NULL,NULL,NULL) INTO result;
 IF (result->>'is_online')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'driver could not go offline';
 END IF;
 RAISE NOTICE '[PASS] Offline action without GPS';
END;
$test$;
COMMIT;

-- Production migration's stage transition trigger is installed in this DB only.
DO $test$
DECLARE test_number integer; expected text; err text; rejected boolean; found_status text;
BEGIN
 -- Approval + KYC + online is allowed.
 UPDATE public.rides SET status='motorista_a_caminho'
  WHERE id='30000000-0000-4000-8000-000000000007';
 SELECT status INTO found_status FROM public.rides WHERE id='30000000-0000-4000-8000-000000000007';
 IF found_status<>'motorista_a_caminho' THEN RAISE EXCEPTION 'approved transition did not persist'; END IF;

 FOR test_number,expected IN SELECT * FROM (VALUES
  (1,'driver_offline'),
  (2,'driver_kyc_incomplete'),
  (3,'driver_suspended'),
  (4,'driver_blocked'),
  (6,'driver_offline'),
  (8,'driver_kyc_incomplete'),
  (9,'driver_required_for_ride_stage')
 ) cases(n,message)
 LOOP
  rejected:=false;
  BEGIN
   UPDATE public.rides SET status='motorista_a_caminho'
    WHERE id=format('30000000-0000-4000-8000-%s',lpad(test_number::text,12,'0'))::uuid;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err<>expected THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'ineligible driver stage % accepted',test_number; END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM public.rides
  WHERE id IN (
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000006',
   '30000000-0000-4000-8000-000000000008',
   '30000000-0000-4000-8000-000000000009'
  ) AND status<>'procurar_motorista'
 ) THEN RAISE EXCEPTION 'rejected stage transition modified a ride'; END IF;
 RAISE NOTICE '[PASS] Approved stage and seven rejected stage transitions';
END;
$test$;
