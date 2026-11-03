-- Operational Corridas test fixture: PostgreSQL only, synthetic identities.
-- The actual staged functions will be extracted from the versioned migration.
-- This is NOT a full Supabase schema, Auth/JWT validation or real KYC evidence.
-- The authenticated cluster role was created by the first QA database.
-- PostgreSQL roles are cluster-global, unlike tables/schemas.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA apois_rpc_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TABLE public.users(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE NOT NULL);
CREATE FUNCTION public.mobility_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT id FROM public.users WHERE auth_user_id=(SELECT auth.uid()) $$;
CREATE TABLE public.drivers(
 id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE,
 approval_status text NOT NULL,
 suspended_at timestamptz,blocked_at timestamptz,
 is_online boolean NOT NULL DEFAULT false,
 kyc_ready boolean NOT NULL DEFAULT false,
 current_lat numeric,current_lng numeric,current_heading numeric,
 current_speed numeric,last_location_at timestamptz,updated_at timestamptz
);
CREATE TABLE public.rides(
 id uuid PRIMARY KEY,driver_id uuid,status text NOT NULL);
CREATE FUNCTION private.driver_kyc_is_ready(_driver_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT coalesce((SELECT kyc_ready FROM public.drivers WHERE id=_driver_id),false) $$;

GRANT USAGE ON SCHEMA public,auth,apois_rpc_private TO authenticated;
-- Private RPC remains unreachable to anon in a regular Supabase deployment;
-- this fixture only grants authenticated to call the presence function.

INSERT INTO public.users(id,auth_user_id)
SELECT format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('00000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid
FROM generate_series(1,8) n;
INSERT INTO public.drivers(
 id,user_id,approval_status,suspended_at,blocked_at,is_online,kyc_ready,current_lat,current_lng
)
SELECT format('20000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       format('10000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       CASE WHEN n=5 THEN 'em_analise' ELSE 'aprovado' END,
       CASE WHEN n=3 THEN now() END,
       CASE WHEN n=4 THEN now() END,
       n IN (7,8),
       n NOT IN (2,5,8),
       -9.40,-40.50
FROM generate_series(1,8) n;
INSERT INTO public.rides(id,driver_id,status)
SELECT format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
       CASE WHEN n=9 THEN NULL ELSE format('20000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid END,
       'procurar_motorista'
FROM (VALUES(1),(2),(3),(4),(6),(7),(8),(9)) x(n);
