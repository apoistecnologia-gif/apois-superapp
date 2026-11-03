-- Fifth independent disposable database. Uses the synthetic driver-presence
-- and ride-acceptance fixtures, then prepares finish/queued-ride scenarios.
-- This does not contain real money, real driver identities, or real Supabase Auth.
ALTER TABLE public.rides
 ADD COLUMN final_price numeric,
 ADD COLUMN estimated_price numeric,
 ADD COLUMN completed_at timestamptz,
 ADD COLUMN driver_arrived_at timestamptz,
 ADD COLUMN started_at timestamptz,
 ADD COLUMN security_code_failed_attempts integer DEFAULT 0,
 ADD COLUMN security_code_locked_until timestamptz,
 ADD COLUMN security_code_last_failed_at timestamptz;
CREATE TABLE public.audit_logs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid,action text,entity_type text,entity_id text,metadata jsonb);
-- All fixture IDs are synthetic. Active and queued rides come in pairs,
-- one per driver. The valid queue is assigned to driver 7; invalid queues
-- are assigned to drivers 8 (KYC missing), 3 (suspended), 6 (offline).
INSERT INTO public.rides
 (id,status,driver_id,accepted_driver_id,payment_method,
  service_details,estimated_price,final_price,created_at,
  queued_after_ride_id,queued_at,origin_lat,origin_lng,destination_lat,destination_lng)
SELECT format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
 CASE WHEN n%2=1 THEN 'em_viagem' ELSE 'procurar_motorista' END,
 format('20000000-0000-4000-8000-%s',lpad(
  (CASE WHEN n IN (301,302) THEN 7 WHEN n IN (303,304) THEN 8
        WHEN n IN (305,306) THEN 3 ELSE 6 END)::text,12,'0'))::uuid,
 format('20000000-0000-4000-8000-%s',lpad(
  (CASE WHEN n IN (301,302) THEN 7 WHEN n IN (303,304) THEN 8
        WHEN n IN (305,306) THEN 3 ELSE 6 END)::text,12,'0'))::uuid,
 'cash','{}'::jsonb,20,null,now(),
 CASE WHEN n%2=0 THEN format('30000000-0000-4000-8000-%s',lpad((n-1)::text,12,'0'))::uuid ELSE NULL END,
 CASE WHEN n%2=0 THEN now() ELSE NULL END,
 -9.40,-40.50,-9.39,-40.49
FROM generate_series(301,308) n;

UPDATE public.drivers
SET last_location_at=now(),current_lat=-9.4,current_lng=-40.5,current_heading=90
WHERE id IN ('20000000-0000-4000-8000-000000000007',
'20000000-0000-4000-8000-000000000008');
-- Driver 6 is approved/KYC-ready but is offline and location-stale.
UPDATE public.drivers
SET last_location_at=now()-interval '10 minutes'
WHERE id='20000000-0000-4000-8000-000000000006';
UPDATE public.rides SET candidate_driver_ids=ARRAY['10000000-0000-4000-8000-000000000007'::uuid],
 offered_driver_ids=ARRAY['10000000-0000-4000-8000-000000000007'::uuid],
 security_code='9999'
WHERE id='30000000-0000-4000-8000-000000000302';
UPDATE public.rides SET candidate_driver_ids=ARRAY['10000000-0000-4000-8000-000000000008'::uuid],
 offered_driver_ids=ARRAY['10000000-0000-4000-8000-000000000008'::uuid],
 security_code='9999'
WHERE id='30000000-0000-4000-8000-000000000304';
UPDATE public.rides SET candidate_driver_ids=ARRAY['10000000-0000-4000-8000-000000000003'::uuid],
 offered_driver_ids=ARRAY['10000000-0000-4000-8000-000000000003'::uuid]
WHERE id='30000000-0000-4000-8000-000000000306';
UPDATE public.rides SET candidate_driver_ids=ARRAY['10000000-0000-4000-8000-000000000006'::uuid],
 offered_driver_ids=ARRAY['10000000-0000-4000-8000-000000000006'::uuid]
WHERE id='30000000-0000-4000-8000-000000000308';
