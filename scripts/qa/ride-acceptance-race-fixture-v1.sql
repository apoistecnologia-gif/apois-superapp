-- Synthetic two-driver race for the real staged Corridas acceptance RPC.
-- Disposable PG17 only; not a full Supabase Auth/RLS integration test.
INSERT INTO public.users (id,auth_user_id)
SELECT format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('00000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid
FROM generate_series(13,14) AS n;
INSERT INTO public.drivers
 (id,user_id,approval_status,is_online,kyc_ready,current_lat,current_lng,
  last_location_at,name,vehicle_model,vehicle_plate)
SELECT format('20000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       'aprovado',true,true,-9.40,-40.50,now(),
       'QA Race Driver', 'QA Race Vehicle', 'QAR1C23'
FROM generate_series(13,14) AS n;
INSERT INTO public.rides
 (id,status,payment_method,service_details,offered_driver_ids,
  request_expires_at,origin_lat,origin_lng,destination_lat,destination_lng)
VALUES (
 '30000000-0000-4000-8000-000000000122','procurar_motorista',
 'cash','{"payment_flow":"direct_to_driver"}'::jsonb,
 ARRAY[
  '10000000-0000-4000-8000-000000000013'::uuid,
  '10000000-0000-4000-8000-000000000014'::uuid
 ], now()+interval '5 minutes',-9.40,-40.50,-9.39,-40.49
);
