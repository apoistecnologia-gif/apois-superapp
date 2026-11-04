-- Minimal synthetic PG17 analogue of the actual Corridas membership tables.
-- Reproduces production's broad GRANT+own-SELECT RLS policies before hardening.
-- No actual customer, charges, payment providers, passwords or outside network.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE NOT NULL);
CREATE FUNCTION public.mobility_user_id() RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT u.id FROM public.users u WHERE u.auth_user_id=(SELECT auth.uid()) $$;
CREATE TABLE public.drivers(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.users(id));
CREATE TABLE public.driver_memberships(
 driver_id uuid PRIMARY KEY REFERENCES public.drivers(id),
 provider text NOT NULL DEFAULT 'asaas',
 monthly_fee_cents bigint NOT NULL DEFAULT 4990 CHECK(monthly_fee_cents=4990),
 status text NOT NULL DEFAULT 'inactive',
 paid_through timestamptz
);
CREATE TABLE public.driver_membership_charges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id uuid NOT NULL REFERENCES public.drivers(id),
 provider_payment_id text NOT NULL UNIQUE,
 amount_cents bigint NOT NULL CHECK(amount_cents=4990),
 status text NOT NULL DEFAULT 'pending',
 paid_at timestamptz
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_membership_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_drivers_read_own ON public.drivers FOR SELECT TO authenticated
 USING (user_id=(SELECT public.mobility_user_id()));
CREATE POLICY driver_memberships_read_own ON public.driver_memberships FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.drivers d
              WHERE d.id=driver_memberships.driver_id
                AND d.user_id=(SELECT public.mobility_user_id())));
CREATE POLICY driver_membership_charges_read_own ON public.driver_membership_charges FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.drivers d
              WHERE d.id=driver_membership_charges.driver_id
                AND d.user_id=(SELECT public.mobility_user_id())));
INSERT INTO public.users VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
INSERT INTO public.drivers VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
INSERT INTO public.driver_memberships(driver_id,status) VALUES
 ('20000000-0000-4000-8000-000000000001','pending'),
 ('20000000-0000-4000-8000-000000000002','inactive');
INSERT INTO public.driver_membership_charges(driver_id,provider_payment_id,amount_cents) VALUES
 ('20000000-0000-4000-8000-000000000001','synthetic-charge-1',4990),
 ('20000000-0000-4000-8000-000000000002','synthetic-charge-2',4990);
GRANT USAGE ON SCHEMA public, auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid(),public.mobility_user_id() TO authenticated;
GRANT SELECT ON public.drivers TO authenticated;
-- Existing Supabase default table privileges are intentionally reproduced.
GRANT ALL PRIVILEGES ON TABLE public.driver_memberships,public.driver_membership_charges
 TO PUBLIC,anon,authenticated,service_role;
DO $t$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_memberships','driver_membership_charges']) LOOP
  IF NOT has_table_privilege('anon','public.'||t,'TRUNCATE')
     OR NOT has_table_privilege('authenticated','public.'||t,'TRUNCATE') THEN
   RAISE EXCEPTION 'Failed to reproduce production TRUNCATE exposure: %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Reproduced broad finance-table GRANT including RLS-unprotected TRUNCATE';
END;
$t$;
