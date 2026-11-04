-- Continuation of corridas_membership_acl_qa disposable PG17 fixture.
-- Synthetic users/drivers/auth helper already exist. No production records.
\set ON_ERROR_STOP on
CREATE SCHEMA private;
CREATE FUNCTION private.has_permission(_name text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  = '00000000-0000-4000-8000-000000000099'::uuid AND _name='finance.read' $$;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_permission(text) TO authenticated;
CREATE TABLE public.driver_payout_destinations(
 id uuid PRIMARY KEY, driver_id uuid NOT NULL REFERENCES public.drivers(id),destination_token text NOT NULL
);
CREATE TABLE public.passenger_wallets(passenger_id uuid PRIMARY KEY REFERENCES public.users(id),balance_cents bigint NOT NULL);
CREATE TABLE public.payment_methods(id uuid PRIMARY KEY,is_active boolean NOT NULL,display_name text NOT NULL);
CREATE TABLE public.payment_webhook_receipts(id uuid PRIMARY KEY,reference_digest text NOT NULL);
CREATE TABLE public.ride_pix_payments(
 id uuid PRIMARY KEY,driver_id uuid REFERENCES public.drivers(id),
 passenger_id uuid REFERENCES public.users(id),amount_cents bigint NOT NULL
);
CREATE TABLE public.ride_settlements(
 id uuid PRIMARY KEY,driver_id uuid REFERENCES public.drivers(id),
 passenger_id uuid REFERENCES public.users(id),amount_cents bigint NOT NULL
);
ALTER TABLE public.driver_payout_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_pix_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_payout_destinations_read_own ON public.driver_payout_destinations
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.drivers d
 WHERE d.id=driver_payout_destinations.driver_id AND d.user_id=public.mobility_user_id()));
CREATE POLICY passenger_wallet_read_own ON public.passenger_wallets
 FOR SELECT TO authenticated USING(passenger_id=public.mobility_user_id());
CREATE POLICY payment_methods_authenticated_read ON public.payment_methods
 FOR SELECT TO authenticated USING(is_active);
CREATE POLICY payment_webhook_receipts_no_client_access ON public.payment_webhook_receipts
 FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY ride_pix_payments_driver_read_own ON public.ride_pix_payments
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.drivers d
 WHERE d.id=ride_pix_payments.driver_id AND d.user_id=public.mobility_user_id()));
CREATE POLICY ride_pix_payments_passenger_read_own ON public.ride_pix_payments
 FOR SELECT TO authenticated USING(passenger_id=public.mobility_user_id());
CREATE POLICY ride_settlements_driver_read_own ON public.ride_settlements
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.drivers d
 WHERE d.id=ride_settlements.driver_id AND d.user_id=public.mobility_user_id()));
CREATE POLICY ride_settlements_passenger_read_own ON public.ride_settlements
 FOR SELECT TO authenticated USING(passenger_id=public.mobility_user_id());
CREATE POLICY ride_settlements_admin_read ON public.ride_settlements
 FOR SELECT TO authenticated USING(private.has_permission('finance.read'));
INSERT INTO public.driver_payout_destinations VALUES
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','SYNTHETIC-A'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','SYNTHETIC-B');
INSERT INTO public.passenger_wallets VALUES
 ('10000000-0000-4000-8000-000000000001',1400),
 ('10000000-0000-4000-8000-000000000002',2100);
INSERT INTO public.payment_methods VALUES
 ('60000000-0000-4000-8000-000000000001',true,'test-active'),
 ('60000000-0000-4000-8000-000000000002',false,'test-inactive');
INSERT INTO public.payment_webhook_receipts VALUES
 ('70000000-0000-4000-8000-000000000001','synthetic-webhook');
INSERT INTO public.ride_pix_payments VALUES
 ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1200),
 ('80000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',1500);
INSERT INTO public.ride_settlements VALUES
 ('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1200),
 ('90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',1500);
GRANT ALL PRIVILEGES ON TABLE
 public.driver_payout_destinations,public.passenger_wallets,public.payment_methods,
 public.payment_webhook_receipts,public.ride_pix_payments,public.ride_settlements
TO PUBLIC,anon,authenticated,service_role;
DO $t$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['driver_payout_destinations','passenger_wallets','payment_methods',
 'payment_webhook_receipts','ride_pix_payments','ride_settlements']) LOOP
  IF NOT has_table_privilege('anon','public.'||t,'TRUNCATE')
   OR NOT has_table_privilege('authenticated','public.'||t,'TRUNCATE') THEN
   RAISE EXCEPTION 'Production-like TRUNCATE grant not reproduced: %',t;
  END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Six payment/payout/settlement tables reproduced broad TRUNCATE grants';
END;
$t$;
