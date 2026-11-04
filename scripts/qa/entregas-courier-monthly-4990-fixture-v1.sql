-- Disposable PG17 only; roles anon/authenticated/service_role were created
-- once for this PostgreSQL cluster by the first shared cash fixture.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE public.couriers(id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE);
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY courier_reads_own ON public.couriers FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
CREATE TABLE public.platform_settings(
 key text PRIMARY KEY,value jsonb NOT NULL,description text
);
INSERT INTO public.platform_settings(key,value,description)
VALUES('merchant_monthly_amount_cents',to_jsonb(6990),'Existing establishment monthly');
INSERT INTO public.couriers VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT ON public.couriers TO authenticated;
