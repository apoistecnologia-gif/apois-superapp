-- Run after two actual psql sessions contended on one offered ride.
-- This checks the final persisted state without pretending to verify Auth JWT.
DO $race$
DECLARE v_ride public.rides%rowtype; v_winner_user uuid;
BEGIN
 SELECT * INTO v_ride FROM public.rides
 WHERE id='30000000-0000-4000-8000-000000000122';
 IF NOT FOUND OR v_ride.status<>'motorista_a_caminho'
   OR v_ride.driver_id IS NULL
   OR v_ride.driver_id<>v_ride.accepted_driver_id
   OR v_ride.accepted_at IS NULL THEN
  RAISE EXCEPTION 'parallel acceptance did not persist one valid ride';
 END IF;
 IF v_ride.driver_id NOT IN (
  '20000000-0000-4000-8000-000000000013'::uuid,
  '20000000-0000-4000-8000-000000000014'::uuid
 ) THEN
  RAISE EXCEPTION 'ride accepted by an ineligible synthetic driver: %',v_ride.driver_id;
 END IF;
 SELECT user_id INTO v_winner_user FROM public.drivers WHERE id=v_ride.driver_id;
 IF cardinality(v_ride.candidate_driver_ids)<>1
   OR v_ride.candidate_driver_ids[1] IS DISTINCT FROM v_winner_user THEN
  RAISE EXCEPTION 'losing concurrent transaction left a candidate mutation';
 END IF;
 RAISE NOTICE '[PASS] Two independent SQL sessions: one cash ride accepted, losing update rolled back';
END;
$race$;
