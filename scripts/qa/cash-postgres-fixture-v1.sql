-- APOIS cash-only isolated PostgreSQL fixture. Synthetic records ONLY.
-- This schema is intentionally minimal: verifies SQL execution/RLS/guards,
-- NOT parity with the full production schema, triggers, Supabase Auth or Storage.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
-- Authorization helpers transcribed from production Entregas pg_get_functiondef,
-- read-only on 2026-11-03. These test role/ownership logic, but not Supabase
-- JWT signature verification, all production RLS, or external Auth lifecycle.
CREATE TYPE public.app_role AS ENUM ('admin','merchant','courier','customer');
CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.merchants(id uuid PRIMARY KEY,owner_user_id uuid,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.merchant_members(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid NOT NULL,
 user_id uuid NOT NULL,status text NOT NULL DEFAULT 'active',role text NOT NULL DEFAULT 'staff');
CREATE TABLE public.user_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,role public.app_role NOT NULL);

CREATE FUNCTION public.current_user_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.is_active = true
  );
$function$;
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SET search_path TO public,pg_temp
AS $function$
  SELECT _user_id=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$function$;
CREATE FUNCTION public.current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT public.current_user_is_active()
   AND public.has_role((SELECT auth.uid()),'admin'::public.app_role);
$function$;
CREATE FUNCTION public.current_user_is_merchant_member(_merchant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT public.current_user_is_active()
   AND EXISTS(
     SELECT 1 FROM public.merchants m
     WHERE m.id=_merchant_id
       AND (
         m.owner_user_id=(SELECT auth.uid())
         OR EXISTS(
           SELECT 1 FROM public.merchant_members mm
           WHERE mm.merchant_id=_merchant_id
             AND mm.user_id=(SELECT auth.uid())
             AND mm.status='active'
         )
       )
   );
$function$;

INSERT INTO public.profiles(id,is_active) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',true),  -- owner of merchant A
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',true),  -- owner of merchant B
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true),  -- active member of merchant A
 ('ffffffff-ffff-4fff-8fff-ffffffffffff',true),  -- suspended member of A
 ('66666666-6666-4666-8666-666666666666',true),  -- removed member of A
 ('77777777-7777-4777-8777-777777777777',false), -- inactive profile, active member
 ('88888888-8888-4888-8888-888888888888',true),  -- active admin
 ('99999999-9999-4999-8999-999999999999',true);  -- outsider
INSERT INTO public.merchants(id,owner_user_id,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
INSERT INTO public.merchant_members(merchant_id,user_id,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','active'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff','suspended'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','removed'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77777777-7777-4777-8777-777777777777','active');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('88888888-8888-4888-8888-888888888888','admin');


CREATE TABLE public.orders(
 id uuid PRIMARY KEY, merchant_id uuid NOT NULL, customer_user_id uuid NOT NULL,
 status text NOT NULL, payment_method text NOT NULL, payment_status text NOT NULL,
 cancellation_reason text, cancelled_at timestamptz);
CREATE TABLE public.order_items(id uuid PRIMARY KEY, order_id uuid NOT NULL);
CREATE TABLE public.order_status_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL, status text NOT NULL, changed_by_user_id uuid);
CREATE TABLE public.payments(
 id uuid PRIMARY KEY,order_id uuid NOT NULL,created_at timestamptz DEFAULT now(),
 status text NOT NULL,amount numeric NOT NULL,failed_at timestamptz,failure_reason text);
CREATE TABLE public.refunds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid,order_id uuid,
 amount numeric,reason text,status text,requested_by uuid,
 created_at timestamptz DEFAULT now());
CREATE TABLE public.delivery_jobs(
 id uuid PRIMARY KEY,order_id uuid,created_at timestamptz DEFAULT now(),
 status text NOT NULL,cancelled_at timestamptz,cancellation_reason text);
CREATE TABLE public.delivery_offers(
 id uuid PRIMARY KEY,delivery_job_id uuid,status text,responded_at timestamptz);
CREATE TABLE public.delivery_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, delivery_job_id uuid,
 event_type text,from_status text,to_status text,actor_user_id uuid,metadata jsonb);
CREATE TABLE public.admin_audit_logs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,admin_id uuid,action text,
 entity_type text,entity_id text,before_data jsonb,after_data jsonb);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON public.orders,public.order_items,public.order_status_history TO authenticated;

-- Merchant A: 4 orders; Merchant B: 1. A is the signed-in test merchant.
INSERT INTO public.orders(id,merchant_id,customer_user_id,status,payment_method,payment_status) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','pending'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd','confirmed','cash','pending'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','pending'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','paid'),
 ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','pix','paid');
INSERT INTO public.order_items(id,order_id) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111'),
 ('aaaaaaaa-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222');
INSERT INTO public.order_status_history(order_id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','confirmed'),
 ('22222222-2222-4222-8222-222222222222','confirmed');
INSERT INTO public.payments(id,order_id,status,amount) VALUES
 ('99999999-9999-4999-8999-999999999993','33333333-3333-4333-8333-333333333333','paid',25.00),
 ('99999999-9999-4999-8999-999999999995','55555555-5555-4555-8555-555555555555','paid',55.00);
INSERT INTO public.delivery_jobs(id,order_id,status) VALUES
 ('88888888-8888-4888-8888-888888888833','33333333-3333-4333-8333-333333333333','searching');
INSERT INTO public.delivery_offers(id,delivery_job_id,status) VALUES
 ('77777777-7777-4777-8777-777777777733','88888888-8888-4888-8888-888888888833','offered');
