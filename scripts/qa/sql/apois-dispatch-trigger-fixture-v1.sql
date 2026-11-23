-- Isolated PostgreSQL CI fixture. NEVER run against Supabase production.
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.driver_subscription_allows_rides(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(coalesce(_status, '')) IN ('active','ativa','teste') $$;

CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO public.app_settings VALUES ('ride.next_offer_max_distance_km','5'::jsonb);
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  category text, is_online boolean, approval_status text,
  suspended_at timestamptz, subscription_status text,
  current_lat numeric, current_lng numeric, last_location_at timestamptz
);
CREATE TABLE public.rides (
  id uuid PRIMARY KEY, passenger_id uuid NOT NULL,
  category text NOT NULL, status text NOT NULL,
  origin_lat numeric, origin_lng numeric, driver_id uuid,
  accepted_driver_id uuid, queued_after_ride_id uuid,
  candidate_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  offered_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  rejected_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
);
-- Strict source guard will reject drifting prod triggers. This local baseline
-- contains the minimum invariants to exercise the real migration's guard.
CREATE FUNCTION public.append_nearby_busy_driver_candidates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $original$
BEGIN
  PERFORM private.driver_subscription_allows_rides('active');
  new.offered_driver_ids := coalesce(new.offered_driver_ids, '{}'::uuid[]);
  new.candidate_driver_ids := coalesce(new.candidate_driver_ids, '{}'::uuid[]);
  RETURN NEW;
END
$original$;
CREATE TRIGGER rides_append_nearby_busy_candidates
BEFORE UPDATE OF candidate_driver_ids ON public.rides FOR EACH ROW
EXECUTE FUNCTION public.append_nearby_busy_driver_candidates();

INSERT INTO public.drivers(id,user_id,category,is_online,approval_status,subscription_status,current_lat,current_lng,last_location_at)
VALUES
('01111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','carros',true,'aprovado','active',-9.40,-40.50,now()),
('02222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','carros',true,'aprovado','active',-9.40,-40.50,now()),
('03333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','carros',true,'aprovado','active',-9.40,-40.50,now()),
('04444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','carros',true,'aprovado','active',-9.40,-40.50,now()-interval '5 minutes');

-- Busy drivers, including the passenger/driver, are candidates for near ride
-- offers only if safe. Do not populate offerings directly in the trigger.
INSERT INTO public.rides(id,passenger_id,category,status,driver_id)
VALUES
('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','carros','em_viagem','01111111-1111-4111-8111-111111111111'),
('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','carros','em_viagem','02222222-2222-4222-8222-222222222222'),
('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','carros','em_viagem','03333333-3333-4333-8333-333333333333'),
('44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','carros','em_viagem','04444444-4444-4444-8444-444444444444');

INSERT INTO public.rides(id,passenger_id,category,status,origin_lat,origin_lng)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
        'carros','procurar_motorista',-9.40,-40.50);
