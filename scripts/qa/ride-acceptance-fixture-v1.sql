-- Fourth, separate disposable PostgreSQL database for real SQL acceptance
-- functions. This extends a SYNTHETIC minimal schema; no real rides/users.
-- Test helper roles come from scripts/qa/driver-presence-fixture-v1.sql.
ALTER TABLE public.drivers
 ADD COLUMN name text,
 ADD COLUMN photo_url text,
 ADD COLUMN phone text,
 ADD COLUMN vehicle_model text,
 ADD COLUMN vehicle_color text,
 ADD COLUMN vehicle_plate text,
 ADD COLUMN rating numeric;
UPDATE public.drivers SET name='QA Driver',vehicle_model='Modelo QA',
 vehicle_color='Preto',vehicle_plate='ABC1D23',rating=5;
ALTER TABLE public.rides
 ADD COLUMN accepted_driver_id uuid,
 ADD COLUMN payment_method text,
 ADD COLUMN service_details jsonb DEFAULT '{}'::jsonb,
 ADD COLUMN offered_driver_ids uuid[] DEFAULT '{}'::uuid[],
 ADD COLUMN candidate_driver_ids uuid[] DEFAULT '{}'::uuid[],
 ADD COLUMN rejected_driver_ids uuid[] DEFAULT '{}'::uuid[],
 ADD COLUMN request_expires_at timestamptz,
 ADD COLUMN search_expires_at timestamptz,
 ADD COLUMN current_offer_driver_id uuid,
 ADD COLUMN accepted_at timestamptz,
 ADD COLUMN security_code text,
 ADD COLUMN driver_name text,
 ADD COLUMN driver_photo text,
 ADD COLUMN driver_phone text,
 ADD COLUMN driver_vehicle_model text,
 ADD COLUMN driver_vehicle_color text,
 ADD COLUMN driver_vehicle_plate text,
 ADD COLUMN driver_rating numeric,
 ADD COLUMN driver_latitude numeric,
 ADD COLUMN driver_longitude numeric,
 ADD COLUMN driver_heading numeric,
 ADD COLUMN cancellation_reason text,
 ADD COLUMN cancelled_by uuid,
 ADD COLUMN cancelled_at timestamptz,
 ADD COLUMN updated_at timestamptz,
 ADD COLUMN created_at timestamptz DEFAULT now(),
 ADD COLUMN queued_after_ride_id uuid,
 ADD COLUMN queued_at timestamptz,
 ADD COLUMN origin_lat numeric,
 ADD COLUMN origin_lng numeric,
 ADD COLUMN destination_lat numeric,
 ADD COLUMN destination_lng numeric;
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO public.app_settings(key,value) VALUES ('ride.next_offer_max_distance_km','5'::jsonb);

-- Each ride is initially offered to the approved & KYC-ready driver 7;
-- the cases below override the offer, payment mode or flow as appropriate.
INSERT INTO public.rides
 (id,status,payment_method,service_details,offered_driver_ids,request_expires_at,
 origin_lat,origin_lng,destination_lat,destination_lng)
SELECT format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
 'procurar_motorista','cash','{}'::jsonb,
 ARRAY['10000000-0000-4000-8000-000000000007'::uuid],now()+interval '5 minutes',
 -9.40,-40.50,-9.39,-40.49
FROM generate_series(101,117) AS n;
UPDATE public.rides
SET service_details = CASE
 WHEN id='30000000-0000-4000-8000-000000000102' THEN '{"payment_flow":"safe2pay_marketplace"}'::jsonb
 WHEN id='30000000-0000-4000-8000-000000000103' THEN '{"payment_flow":" SAFE2PAY_MARKETPLACE "}'::jsonb
 WHEN id='30000000-0000-4000-8000-000000000104' THEN '{"payment_flow":"mercadopago_marketplace"}'::jsonb
 WHEN id='30000000-0000-4000-8000-000000000115' THEN '{"payment_flow":"safe2pay_checkout"}'::jsonb
 WHEN id='30000000-0000-4000-8000-000000000116' THEN '{"payment_flow":"SAFE2PAY"}'::jsonb
 WHEN id='30000000-0000-4000-8000-000000000117' THEN '{"payment_flow":"direct_to_driver"}'::jsonb
 ELSE service_details END
WHERE id IN (
 '30000000-0000-4000-8000-000000000102',
 '30000000-0000-4000-8000-000000000103',
 '30000000-0000-4000-8000-000000000104',
 '30000000-0000-4000-8000-000000000115',
 '30000000-0000-4000-8000-000000000116',
 '30000000-0000-4000-8000-000000000117'
);
UPDATE public.rides SET payment_method='pix'
WHERE id='30000000-0000-4000-8000-000000000105';
UPDATE public.rides SET offered_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000106';
UPDATE public.rides SET request_expires_at=now()-interval '1 minute'
WHERE id='30000000-0000-4000-8000-000000000107';
UPDATE public.rides SET rejected_driver_ids=ARRAY['10000000-0000-4000-8000-000000000007'::uuid]
WHERE id='30000000-0000-4000-8000-000000000108';
UPDATE public.rides SET offered_driver_ids=ARRAY[
  CASE
   WHEN id='30000000-0000-4000-8000-000000000109' THEN '10000000-0000-4000-8000-000000000008'::uuid
   WHEN id='30000000-0000-4000-8000-000000000110' THEN '10000000-0000-4000-8000-000000000002'::uuid
   WHEN id='30000000-0000-4000-8000-000000000111' THEN '10000000-0000-4000-8000-000000000003'::uuid
   WHEN id='30000000-0000-4000-8000-000000000112' THEN '10000000-0000-4000-8000-000000000004'::uuid
   WHEN id='30000000-0000-4000-8000-000000000113' THEN '10000000-0000-4000-8000-000000000005'::uuid
  END]
WHERE id IN (
 '30000000-0000-4000-8000-000000000109',
 '30000000-0000-4000-8000-000000000110',
 '30000000-0000-4000-8000-000000000111',
 '30000000-0000-4000-8000-000000000112',
 '30000000-0000-4000-8000-000000000113'
);
-- Candidate legacy calls are also tested directly; they must reject provider flows
-- WITHOUT relying on the outer driver_accept_ride function.
UPDATE public.rides SET candidate_driver_ids=ARRAY[
 '10000000-0000-4000-8000-000000000007'::uuid]
WHERE id IN (
 '30000000-0000-4000-8000-000000000102',
 '30000000-0000-4000-8000-000000000103',
 '30000000-0000-4000-8000-000000000115'
);
-- Fresh GPS is required for otherwise eligible offered drivers.
UPDATE public.drivers SET last_location_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';

-- Four otherwise eligible but location-invalid identities, all SYNTHETIC.
INSERT INTO public.users(id,auth_user_id)
SELECT format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('00000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid
FROM generate_series(9,12) n;
INSERT INTO public.drivers(id,user_id,approval_status,is_online,kyc_ready,
 current_lat,current_lng,last_location_at,name)
SELECT format('20000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       'aprovado',true,true,
       CASE WHEN n=11 THEN 12 ELSE -9.40 END,-40.50,
       CASE WHEN n=9 THEN NULL
            WHEN n=10 THEN now()-interval '10 minutes'
            WHEN n=12 THEN now()+interval '60 minutes'
            ELSE now() END,'QA GPS Safety Driver'
FROM generate_series(9,12) n;

INSERT INTO public.rides(id,status,payment_method,service_details,
 offered_driver_ids,request_expires_at,origin_lat,origin_lng,destination_lat,destination_lng)
SELECT format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
 'procurar_motorista','cash','{}'::jsonb,
 ARRAY[format('10000000-0000-4000-8000-%s',
    lpad((n-109)::text,12,'0'))::uuid],
 now()+interval '5 minutes',-9.40,-40.50,-9.39,-40.49
FROM generate_series(118,121) n;
