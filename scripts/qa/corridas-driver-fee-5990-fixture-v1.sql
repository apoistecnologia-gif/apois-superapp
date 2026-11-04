-- Synthetic PG17 old pricing fixture, zero real users / transactions.
\set ON_ERROR_STOP on
CREATE TABLE public.app_settings(key text PRIMARY KEY,value jsonb NOT NULL);
INSERT INTO public.app_settings VALUES('finance.driver_monthly_fee_cents','4990'::jsonb);
CREATE TABLE public.driver_memberships(
 driver_id uuid PRIMARY KEY,
 monthly_fee_cents bigint NOT NULL DEFAULT 4990,
 CONSTRAINT driver_memberships_monthly_fee_cents_check CHECK (monthly_fee_cents=4990)
);
CREATE TABLE public.driver_membership_charges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 amount_cents bigint NOT NULL,
 CONSTRAINT driver_membership_charges_amount_cents_check CHECK (amount_cents=4990)
);
INSERT INTO public.driver_memberships(driver_id) VALUES
 ('20000000-0000-4000-8000-000000000001');
INSERT INTO public.driver_membership_charges(amount_cents) VALUES (4990);
