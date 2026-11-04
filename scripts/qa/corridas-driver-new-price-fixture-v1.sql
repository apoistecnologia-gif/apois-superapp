-- Disposable PG17 fixture only. Original 4990 pre-migration contract.
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS private;
DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  CREATE ROLE service_role NOLOGIN;
 END IF;
END;
$qa$;
CREATE TABLE public.app_settings(
 key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings(key,value) VALUES('finance.driver_monthly_fee_cents','4990'::jsonb);
CREATE TABLE public.driver_memberships(
 driver_id uuid PRIMARY KEY,monthly_fee_cents bigint NOT NULL DEFAULT 4990,
 status text NOT NULL DEFAULT 'inactive',created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT driver_memberships_monthly_fee_cents_check CHECK(monthly_fee_cents=4990)
);
ALTER TABLE public.driver_memberships ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.driver_membership_charges(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 driver_id uuid NOT NULL,amount_cents bigint NOT NULL,
 status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT driver_membership_charges_amount_cents_check CHECK(amount_cents=4990)
);
ALTER TABLE public.driver_membership_charges ENABLE ROW LEVEL SECURITY;
INSERT INTO public.driver_memberships(driver_id,monthly_fee_cents)
 VALUES('11111111-1111-4111-8111-111111111111',4990);
INSERT INTO public.driver_membership_charges(driver_id,amount_cents)
 VALUES('11111111-1111-4111-8111-111111111111',4990);
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.driver_memberships WHERE monthly_fee_cents=4990)<>1
 OR (SELECT count(*) FROM public.driver_membership_charges WHERE amount_cents=4990)<>1 THEN
  RAISE EXCEPTION 'Initial legacy contract fixture invalid';
 END IF;
 RAISE NOTICE '[PASS] Original 4990 membership and receipt records exist before price cutover';
END;$qa$;
