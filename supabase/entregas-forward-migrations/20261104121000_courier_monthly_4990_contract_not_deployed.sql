-- APOIS ENTREGAS - staged courier monthly commercial contract only.
-- R$49.90 monthly per courier. Merchant R$69.90 is unchanged.
-- NOT DEPLOYED: no charge generation, webhook provider, subscription checkout,
-- courier-dispatch eligibility gate, or "paid" state is activated here.
-- Client may SELECT only its own billing rows; all mutation is service-only.
BEGIN;
DO $contract_guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.platform_settings
  WHERE key='courier_monthly_amount_cents'
  AND (value #>> '{}') IS DISTINCT FROM '4990') THEN
  RAISE EXCEPTION 'COURIER_FEE_CONTRACT_CONFLICT' USING ERRCODE='55000';
 END IF;
END;
$contract_guard$;
INSERT INTO public.platform_settings(key,value,description)
VALUES('courier_monthly_amount_cents',to_jsonb(4990),'Mensalidade do entregador APOIS: R$49,90. Cobrança NÃO habilitada.')
ON CONFLICT (key) DO NOTHING;
CREATE TABLE public.courier_monthly_memberships (
 courier_id uuid PRIMARY KEY REFERENCES public.couriers(id) ON DELETE CASCADE,
 monthly_fee_cents bigint NOT NULL DEFAULT 4990
  CONSTRAINT courier_monthly_membership_fee_check CHECK(monthly_fee_cents=4990),
 status text NOT NULL DEFAULT 'pending'
  CONSTRAINT courier_monthly_membership_status_check CHECK(status IN ('pending','active','overdue','cancelled')),
 provider text,
 provider_subscription_id text UNIQUE,
 current_period_start timestamptz,
 current_period_end timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 -- Deliberately deny all fake activation until audited provider webhooks exist.
 CONSTRAINT courier_monthly_activation_not_homologated CHECK(status<>'active'),
 CONSTRAINT courier_monthly_active_period_check CHECK(
   status<>'active' OR (current_period_start IS NOT NULL
    AND current_period_end IS NOT NULL AND current_period_end>current_period_start)
 )
);
CREATE TABLE public.courier_monthly_charges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
 amount_cents bigint NOT NULL DEFAULT 4990
  CONSTRAINT courier_monthly_charge_amount_check CHECK(amount_cents=4990),
 provider text,
 provider_payment_id text UNIQUE,
 status text NOT NULL DEFAULT 'pending'
  CONSTRAINT courier_monthly_charge_status_check CHECK(status IN ('pending','received','failed','refunded','cancelled')),
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 -- Never mark a real monthly payment received before verified gateway E2E.
 CONSTRAINT courier_monthly_receipt_not_homologated CHECK(status<>'received'),
 CONSTRAINT courier_monthly_received_requires_receipt_check CHECK (
   status <> 'received' OR (
     provider IS NOT NULL AND btrim(provider) <> ''
     AND provider_payment_id IS NOT NULL AND btrim(provider_payment_id) <> ''
     AND paid_at IS NOT NULL
   )
 )
);
CREATE INDEX courier_monthly_charges_by_courier_created_at
 ON public.courier_monthly_charges(courier_id,created_at DESC);
ALTER TABLE public.courier_monthly_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_monthly_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courier reads own monthly membership"
 ON public.courier_monthly_memberships FOR SELECT TO authenticated
 USING (EXISTS(
  SELECT 1 FROM public.couriers c
  WHERE c.id=courier_monthly_memberships.courier_id
    AND c.user_id=(SELECT auth.uid())
 ));
CREATE POLICY "Courier reads own monthly charges"
 ON public.courier_monthly_charges FOR SELECT TO authenticated
 USING (EXISTS(
  SELECT 1 FROM public.couriers c
  WHERE c.id=courier_monthly_charges.courier_id
    AND c.user_id=(SELECT auth.uid())
 ));
REVOKE ALL PRIVILEGES ON TABLE
 public.courier_monthly_memberships,public.courier_monthly_charges
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.courier_monthly_memberships,public.courier_monthly_charges
 TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.courier_monthly_memberships,public.courier_monthly_charges
 TO service_role;
COMMIT;
