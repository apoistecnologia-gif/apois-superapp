-- APOIS Corridas driver registration guard: synthetic PG 17 fixture only.
-- Separate disposable database; no production data, Auth users, Storage or maps.
CREATE SCHEMA auth;
CREATE SCHEMA apois_rpc_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TABLE public.users(
 id uuid PRIMARY KEY, auth_user_id uuid NOT NULL UNIQUE, email text NOT NULL,
 name text, phone text, cpf text, birth_date date, city text,avatar_url text,
 deleted_at timestamptz, updated_at timestamptz);
CREATE TABLE public.user_roles(user_id uuid NOT NULL, role text NOT NULL,PRIMARY KEY(user_id,role));
CREATE TABLE public.drivers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE, name text, email text,phone text,cpf text,birth_date date,
 city text,state text,address text,address_number text,address_complement text,
 province text,postal_code text,declared_monthly_income numeric,category text,
 vehicle_model text,vehicle_plate text,vehicle_color text,vehicle_year integer,
 selfie_url text,cnh_url text,cnh_back_url text,vehicle_document_url text,
 vehicle_photo_url text,photo_url text,
 approval_status text NOT NULL,documents_status text,subscription_status text,
 is_online boolean DEFAULT false,updated_at timestamptz,approved_at timestamptz,
 motivo_reprovacao text
);
-- 1 new, 2 approved, 3 suspended, 4 blocked, 5 rejected, 6 pending.
INSERT INTO public.users(id,auth_user_id,email,name) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','new@example.invalid','Original new'),
 ('aaaaaaaa-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000002','approved@example.invalid','Original approved'),
 ('aaaaaaaa-0000-4000-8000-000000000003','11111111-0000-4000-8000-000000000003','suspended@example.invalid','Original suspended'),
 ('aaaaaaaa-0000-4000-8000-000000000004','11111111-0000-4000-8000-000000000004','blocked@example.invalid','Original blocked'),
 ('aaaaaaaa-0000-4000-8000-000000000005','11111111-0000-4000-8000-000000000005','rejected@example.invalid','Original rejected'),
 ('aaaaaaaa-0000-4000-8000-000000000006','11111111-0000-4000-8000-000000000006','pending@example.invalid','Original pending');
INSERT INTO public.drivers(user_id,name,approval_status,documents_status,is_online,approved_at) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000002','Approved unchanged','aprovado','approved',true,'2026-10-01'),
 ('aaaaaaaa-0000-4000-8000-000000000003','Suspended unchanged','suspenso','approved',false,'2026-10-02'),
 ('aaaaaaaa-0000-4000-8000-000000000004','Blocked unchanged','bloqueado','approved',false,'2026-10-03'),
 ('aaaaaaaa-0000-4000-8000-000000000005','Rejected reusable','reprovado','rejected',false,null),
 ('aaaaaaaa-0000-4000-8000-000000000006','Pending reusable','em_analise','pending_review',false,null);
