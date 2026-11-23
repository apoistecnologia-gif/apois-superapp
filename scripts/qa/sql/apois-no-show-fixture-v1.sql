-- Dedicated throwaway PostgreSQL schema for APOIS coded no-show migration.
-- DO NOT run this fixture on hosted Supabase.
CREATE SCHEMA auth;
CREATE SCHEMA apois_rpc_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('apois.test_auth_id',true),'')::uuid $$;
CREATE FUNCTION public.mobility_user_id() RETURNS uuid LANGUAGE sql STABLE
AS $$
  SELECT CASE WHEN auth.uid()='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    THEN '11111111-1111-4111-8111-111111111111'::uuid
    ELSE NULL END
$$;
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE
);
CREATE TABLE public.app_settings (
  key text PRIMARY KEY, value jsonb NOT NULL,
  description text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings(key,value) VALUES
('ride.driver_no_show_wait_minutes','2'::jsonb);
CREATE TABLE public.rides (
  id uuid PRIMARY KEY,
  driver_id uuid,
  accepted_driver_id uuid,
  status text NOT NULL,
  accepted_at timestamptz,
  driver_arrived_at timestamptz,
  current_offer_driver_id uuid,
  driver_name text, driver_photo text, driver_phone text,
  driver_vehicle_model text, driver_vehicle_color text,
  driver_vehicle_plate text, driver_rating numeric,
  driver_latitude numeric,driver_longitude numeric,
  driver_heading numeric,security_code text,
  security_code_failed_attempts int DEFAULT 0,
  security_code_locked_until timestamptz,
  security_code_last_failed_at timestamptz,
  candidate_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  offered_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  rejected_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  request_expires_at timestamptz,
  search_expires_at timestamptz,
  cancellation_reason text,
  cancelled_by text,
  cancelled_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  payment_method text DEFAULT 'cash',
  payment_status text DEFAULT 'pending'
);
CREATE TABLE public.audit_logs (
  actor_id uuid, action text NOT NULL, entity_type text NOT NULL,
  entity_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
-- Migration preflight requires exact original body markers; the dummy is
-- intentionally replaced by the REAL migration before any behavior test.
CREATE FUNCTION apois_rpc_private.driver_cancel_ride(_ride_id uuid,_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE v_reason_norm text; v_is_no_show boolean;
BEGIN
  v_is_no_show:=v_reason_norm like '%não apareceu%';
  PERFORM 'driver_no_show_wait_not_elapsed';
  PERFORM 'ride.driver_cancelled_for_redispatch';
  RETURN '{}'::jsonb;
END
$fn$;

INSERT INTO public.drivers(id,user_id) VALUES
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111');

INSERT INTO public.rides
  (id,driver_id,accepted_driver_id,status,driver_arrived_at,
   candidate_driver_ids,offered_driver_ids,payment_method,payment_status)
VALUES
('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','motorista_a_caminho',NULL,
 ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
 ARRAY['11111111-1111-4111-8111-111111111111'::uuid], 'cash','pending'),
('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','motorista_chegou',now()-interval '1 minute',
 '{}'::uuid[],'{}'::uuid[],'cash','pending'),
('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','motorista_chegou',now()-interval '5 minutes',
 '{}'::uuid[],'{}'::uuid[],'cash','pending'),
('44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','motorista_a_caminho',NULL,
 ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
 ARRAY['11111111-1111-4111-8111-111111111111'::uuid], 'cash','pending');
SET apois.test_auth_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
