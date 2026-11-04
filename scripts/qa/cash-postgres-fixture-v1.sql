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


-- Contract subset aligned to production column metadata; other triggers/FKs omitted.
CREATE TABLE public.orders(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number bigint NOT NULL,
merchant_id uuid NOT NULL,customer_user_id uuid NOT NULL,status text NOT NULL
 CHECK(status IN ('confirmed','accepted','preparing','ready','ready_for_pickup','searching_driver','driver_assigned','driver_arriving_store','cancelled','paid','refunded','created','pending_payment','picked_up','out_for_delivery','on_the_way','delivered')),
payment_method text NOT NULL CHECK(payment_method IN ('cash','pix','credit','debit','wallet')),
payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','cancelled','refunded')),
subtotal numeric NOT NULL CHECK(subtotal>=0),delivery_fee numeric NOT NULL DEFAULT 0 CHECK(delivery_fee>=0),
discount numeric NOT NULL DEFAULT 0 CHECK(discount>=0),total numeric NOT NULL CHECK(total>=0),
delivery_address jsonb NOT NULL,request_key uuid NOT NULL,
platform_fee numeric NOT NULL DEFAULT 0 CHECK(platform_fee>=0),
merchant_net numeric,courier_earnings numeric,
cancellation_reason text,cancelled_at timestamptz,
created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
-- Contract subset aligned to production column metadata; other triggers/FKs omitted.
CREATE TABLE public.order_items(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL,
product_name text NOT NULL,base_price numeric NOT NULL CHECK(base_price>=0),
unit_price numeric NOT NULL CHECK(unit_price>=0),quantity integer NOT NULL CHECK(quantity>0),
line_total numeric NOT NULL CHECK(line_total>=0),
selected_options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(selected_options)='array'),
created_at timestamptz NOT NULL DEFAULT now());
-- Contract subset aligned to production column metadata; other triggers/FKs omitted.
CREATE TABLE public.order_status_history(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL,
status text NOT NULL CHECK(status IN ('created','pending_payment','paid','confirmed','accepted','preparing','ready','ready_for_pickup','searching_driver','driver_assigned','driver_arriving_store','picked_up','out_for_delivery','on_the_way','delivered','cancelled','refunded')),
changed_by_user_id uuid,created_at timestamptz NOT NULL DEFAULT now());
-- Contract subset aligned to production column metadata; other triggers/FKs omitted.
-- Financial and delivery table contracts from production metadata, no actual data.
CREATE TABLE public.payments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL,
 provider text NOT NULL CHECK(btrim(provider)<>''),method text NOT NULL
  CHECK(method IN ('pix','credit','debit','cash','wallet')),
 status text NOT NULL CHECK(status IN ('pending','processing','paid','failed','cancelled','refunded')),
 amount numeric NOT NULL CHECK(amount>=0),currency text NOT NULL DEFAULT 'BRL',
 idempotency_key text NOT NULL CHECK(btrim(idempotency_key)<>''),
 failed_at timestamptz,failure_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments
 ADD CONSTRAINT qa_payments_currency_check CHECK(currency ~ '^[A-Z]{3}$');
CREATE TABLE public.refunds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL,
 order_id uuid NOT NULL,amount numeric NOT NULL CHECK(amount>0),
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 requested_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds
 ADD CONSTRAINT qa_refunds_reason_check CHECK(btrim(reason)<>''),
 ADD CONSTRAINT qa_refunds_status_check CHECK(status IN ('pending','processing','completed','failed','cancelled'));
CREATE TABLE public.delivery_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL,
 merchant_id uuid NOT NULL,pickup_address jsonb NOT NULL
  CHECK(jsonb_typeof(pickup_address)='object'),
 delivery_address jsonb NOT NULL CHECK(jsonb_typeof(delivery_address)='object'),
 estimated_earnings numeric NOT NULL DEFAULT 0 CHECK(estimated_earnings>=0),
 status text NOT NULL CHECK(status IN ('searching','offered','accepted','arriving_pickup',
 'at_pickup','picked_up','on_the_way','arrived_destination','delivered','cancelled')),
 cancelled_at timestamptz,cancellation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 search_started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.delivery_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_job_id uuid NOT NULL,
 courier_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('offered','accepted','rejected','expired','cancelled')),
 offered_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 responded_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.delivery_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_job_id uuid NOT NULL,
 event_type text NOT NULL,from_status text,to_status text,
 actor_user_id uuid,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
 CHECK(jsonb_typeof(metadata)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_audit_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_id uuid,
 action text NOT NULL,entity_type text NOT NULL,entity_id text,
 before_data jsonb,after_data jsonb,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON public.orders,public.order_items,public.order_status_history TO authenticated;

-- Merchant A: 4 orders; Merchant B: 1. A is the signed-in test merchant.
WITH qa_rows(id,merchant_id,customer_user_id,status,payment_method,payment_status) AS (VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','pending'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd','confirmed','cash','pending'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','pending'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','cash','paid'),
 ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','confirmed','pix','paid'))
INSERT INTO public.orders(id,order_number,merchant_id,customer_user_id,status,payment_method,payment_status,subtotal,total,delivery_address,request_key)
SELECT id::uuid,1000+row_number() OVER (ORDER BY id),merchant_id::uuid,customer_user_id::uuid,status,payment_method,payment_status,25,25,'{}'::jsonb,gen_random_uuid()
FROM qa_rows;
WITH qa_rows(id,order_id) AS (VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111'),
 ('aaaaaaaa-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222'))
INSERT INTO public.order_items(id,order_id,product_name,base_price,unit_price,quantity,line_total)
SELECT id::uuid,order_id::uuid,'Produto QA',10,10,1,10
FROM qa_rows;
INSERT INTO public.order_status_history(order_id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','confirmed'),
 ('22222222-2222-4222-8222-222222222222','confirmed');
WITH qa_rows(id,order_id,status,amount) AS (VALUES
 ('99999999-9999-4999-8999-999999999993','33333333-3333-4333-8333-333333333333','paid',25.00),
 ('99999999-9999-4999-8999-999999999995','55555555-5555-4555-8555-555555555555','paid',55.00))
INSERT INTO public.payments(id,order_id,provider,method,status,amount,idempotency_key)
SELECT id::uuid,order_id::uuid,'qa-legacy-provider','pix',status,amount,'qa-'||id
FROM qa_rows;
WITH qa_rows(id,order_id,status) AS (VALUES
 ('88888888-8888-4888-8888-888888888833','33333333-3333-4333-8333-333333333333','searching'))
INSERT INTO public.delivery_jobs(id,order_id,merchant_id,pickup_address,delivery_address,status)
SELECT id::uuid,order_id::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'{}'::jsonb,'{}'::jsonb,status
FROM qa_rows;
WITH qa_rows(id,delivery_job_id,status) AS (VALUES
 ('77777777-7777-4777-8777-777777777733','88888888-8888-4888-8888-888888888833','offered'))
INSERT INTO public.delivery_offers(id,delivery_job_id,courier_id,status,expires_at)
SELECT id::uuid,delivery_job_id::uuid,'abababab-abab-4aba-8aba-abababababab'::uuid,status,now()+interval '5 minutes'
FROM qa_rows;
