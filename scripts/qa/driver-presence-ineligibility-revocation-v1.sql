-- Actual staged public.driver_set_presence RPC on synthetic PG17 driver table.
-- Verify eligibility revocation for cached sessions beyond revoked KYC alone.
-- No Supabase connection, money or real people.
\set ON_ERROR_STOP on
-- Simulate an admin revoking approval / suspension / block while a driver
-- still holds the preceding is_online=true state.
UPDATE public.drivers SET is_online=true
 WHERE id IN(
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
 );
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE case_n integer; expected text; response jsonb; err text; denied boolean;
BEGIN
 FOR case_n,expected IN SELECT * FROM (VALUES
   (3,'driver_suspended'),
   (4,'driver_blocked'),
   (5,'driver_not_approved')
 ) cases(n,error_message) LOOP
  PERFORM set_config('request.jwt.claim.sub',
    format('00000000-0000-4000-8000-%s',lpad(case_n::text,12,'0')),true);
  -- An invalidated online driver may have no GPS: clearing availability must
  -- commit without requiring a fresh location.
  SELECT public.driver_set_presence(true,NULL,NULL,NULL,NULL) INTO response;
  IF response->>'is_online'<>'false'
    OR response->>'operationally_eligible'<>'false'
    OR response->>'tracking_active_ride'<>'false' THEN
   RAISE EXCEPTION 'Driver % remained online despite revoked eligibility: %',
    case_n,response;
  END IF;
  denied:=false;
  BEGIN
   PERFORM public.driver_set_presence(true,-9.40,-40.50,90,5);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Driver % got error %, expected %',case_n,err,expected;
   END IF;
   denied:=true;
  END;
  IF NOT denied THEN
   RAISE EXCEPTION 'Driver % was allowed to re-enable invalid presence',case_n;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Cached online suspended/blocked/unapproved drivers are forced offline; fresh activation remains forbidden';
END;
$test$;
COMMIT;

DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.drivers
 WHERE id IN(
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005')
  AND is_online=false;
 IF n<>3 THEN RAISE EXCEPTION 'Only %/3 revoked sessions persisted offline',n; END IF;
 RAISE NOTICE '[PASS] Ineligible driver offline state persists across transactions';
END;
$test$;

-- A suspended driver in an already-started ride must remain able to transmit
-- the existing trip's location, without remaining available for new offers.
-- Driver 7 was approved and online by the earlier stage-transition assertions.
UPDATE public.rides SET status='em_viagem'
WHERE id='30000000-0000-4000-8000-000000000007';
UPDATE public.drivers SET suspended_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
DO $test$
DECLARE response jsonb;
BEGIN
 SELECT public.driver_set_presence(true,-9.40,-40.50,200,10) INTO response;
 IF response->>'is_online'<>'false'
   OR response->>'operationally_eligible'<>'false'
   OR response->>'tracking_active_ride'<>'true'
   OR response->>'current_heading'<>'200' THEN
  RAISE EXCEPTION 'Active ride tracking failed while driver suspended: %',response;
 END IF;
 RAISE NOTICE '[PASS] Suspended active-trip driver retains GPS tracking but loses new-ride eligibility';
END;
$test$;
COMMIT;
