-- Future-only staged driver pricing. NOT deployed to production.
-- Effective policy R$59.90/month; no gateway activated and no receipt faked.
-- We MUST reconcile historical R$49.90 records, never reprice them silently.
BEGIN;
DO $driver_monthly_fee_guard$
DECLARE v_setting text;
BEGIN
 SELECT value #>> '{}' INTO v_setting
 FROM public.app_settings WHERE key='finance.driver_monthly_fee_cents';
 IF v_setting IS NULL OR v_setting NOT IN ('4990','5990') THEN
  RAISE EXCEPTION 'DRIVER_FEE_SETTING_UNEXPECTED' USING ERRCODE='55000';
 END IF;
 IF EXISTS (SELECT 1 FROM public.driver_memberships WHERE monthly_fee_cents<>5990)
    OR EXISTS (SELECT 1 FROM public.driver_membership_charges WHERE amount_cents<>5990) THEN
  RAISE EXCEPTION 'HISTORIC_DRIVER_FEE_REQUIRES_RECONCILIATION'
    USING ERRCODE='55000';
 END IF;
END;
$driver_monthly_fee_guard$;
ALTER TABLE public.driver_memberships DROP CONSTRAINT driver_memberships_monthly_fee_cents_check;
ALTER TABLE public.driver_memberships ADD CONSTRAINT driver_memberships_monthly_fee_cents_check CHECK (monthly_fee_cents=5990);
ALTER TABLE public.driver_memberships ALTER COLUMN monthly_fee_cents SET DEFAULT 5990;
ALTER TABLE public.driver_membership_charges DROP CONSTRAINT driver_membership_charges_amount_cents_check;
ALTER TABLE public.driver_membership_charges ADD CONSTRAINT driver_membership_charges_amount_cents_check CHECK (amount_cents=5990);
UPDATE public.app_settings SET value=to_jsonb(5990)
 WHERE key='finance.driver_monthly_fee_cents';
COMMIT;
