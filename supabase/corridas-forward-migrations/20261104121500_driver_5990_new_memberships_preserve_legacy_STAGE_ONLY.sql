-- APOIS Corridas — STAGED / NOT DEPLOYED. Official 04-Nov-2026 price:
-- NEW driver subscriptions: BRL 59.90 (5990 cents); existing BRL 49.90
-- contract rows stay unchanged with their original payment amount.
-- Merchant BRL 69.90 is in the separate Entregas database.
-- No provider/payment activation, retroactive repricing, grant or RLS changes.
-- Must be reviewed and authorized before touching production. The separate
-- driver operational migration still fails closed with SQLSTATE 55000.
BEGIN;
DO $apois_driver_new_price_preflight$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('driver_memberships','driver_membership_charges')
 AND c.relkind IN ('r','p') AND c.relrowsecurity;
 IF v_count<>2 OR to_regnamespace('private') IS NULL THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_SCHEMA_DRIFT' USING ERRCODE='55000';
 END IF;
 IF (SELECT count(*) FROM public.app_settings WHERE key='finance.driver_monthly_fee_cents'
   AND value#>>'{}'='4990')<>1 THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_SETTING_DRIFT' USING ERRCODE='55000';
 END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conname IN
  ('driver_memberships_monthly_fee_cents_check','driver_membership_charges_amount_cents_check')
  AND pg_get_constraintdef(oid) LIKE '%4990%')<>2 THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_CONSTRAINT_DRIFT' USING ERRCODE='55000';
 END IF;
 IF EXISTS (SELECT 1 FROM public.driver_memberships WHERE monthly_fee_cents<>4990)
 OR EXISTS (SELECT 1 FROM public.driver_membership_charges WHERE amount_cents<>4990)
 OR EXISTS (SELECT 1 FROM public.driver_membership_charges c
  WHERE NOT EXISTS (SELECT 1 FROM public.driver_memberships m WHERE m.driver_id=c.driver_id)) THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_LEGACY_CONTRACT_REVIEW_REQUIRED' USING ERRCODE='55000';
 END IF;
 IF to_regprocedure('private.apois_guard_new_driver_membership_fee_5990()') IS NOT NULL
 OR to_regprocedure('private.apois_guard_driver_charge_matches_contract()') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN
  ('apois_driver_new_membership_fee_guard','apois_driver_charge_contract_amount_guard')
  AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_TRIGGER_ALREADY_PRESENT' USING ERRCODE='55000';
 END IF;
END;
$apois_driver_new_price_preflight$;

-- Preserve every existing contract row; permit its legacy price but enforce
-- 5990 on NEW inserts with an independent BEFORE INSERT trigger below.
ALTER TABLE public.driver_memberships
 DROP CONSTRAINT driver_memberships_monthly_fee_cents_check;
ALTER TABLE public.driver_memberships
 ADD CONSTRAINT driver_memberships_monthly_fee_cents_check
 CHECK (monthly_fee_cents IN (4990,5990));
ALTER TABLE public.driver_memberships ALTER COLUMN monthly_fee_cents SET DEFAULT 5990;

ALTER TABLE public.driver_membership_charges
 DROP CONSTRAINT driver_membership_charges_amount_cents_check;
ALTER TABLE public.driver_membership_charges
 ADD CONSTRAINT driver_membership_charges_amount_cents_check
 CHECK (amount_cents IN (4990,5990));

CREATE FUNCTION private.apois_guard_new_driver_membership_fee_5990()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $apois_driver_fee_guard$
BEGIN
 IF TG_OP='INSERT' AND NEW.monthly_fee_cents<>5990 THEN
  RAISE EXCEPTION 'driver_new_monthly_fee_must_be_5990' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND NEW.monthly_fee_cents IS DISTINCT FROM OLD.monthly_fee_cents THEN
  RAISE EXCEPTION 'driver_existing_monthly_fee_immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$apois_driver_fee_guard$;
CREATE TRIGGER apois_driver_new_membership_fee_guard
 BEFORE INSERT OR UPDATE OF monthly_fee_cents ON public.driver_memberships
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_new_driver_membership_fee_5990();

CREATE FUNCTION private.apois_guard_driver_charge_matches_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $apois_driver_charge_guard$
DECLARE v_contract_fee bigint;
BEGIN
 SELECT m.monthly_fee_cents INTO v_contract_fee
 FROM public.driver_memberships m WHERE m.driver_id=NEW.driver_id;
 IF v_contract_fee IS NULL OR NEW.amount_cents<>v_contract_fee THEN
  RAISE EXCEPTION 'driver_charge_must_match_original_contract' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$apois_driver_charge_guard$;
CREATE TRIGGER apois_driver_charge_contract_amount_guard
 BEFORE INSERT OR UPDATE OF driver_id,amount_cents ON public.driver_membership_charges
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_driver_charge_matches_contract();

-- Trigger-only helpers are not public callable APIs.
REVOKE ALL ON FUNCTION private.apois_guard_new_driver_membership_fee_5990() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apois_guard_driver_charge_matches_contract() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.apois_guard_new_driver_membership_fee_5990() TO service_role;
GRANT EXECUTE ON FUNCTION private.apois_guard_driver_charge_matches_contract() TO service_role;

UPDATE public.app_settings
 SET value=to_jsonb(5990),updated_at=now()
 WHERE key='finance.driver_monthly_fee_cents' AND value#>>'{}'='4990';
DO $apois_driver_new_price_postcheck$
BEGIN
 IF (SELECT value#>>'{}' FROM public.app_settings
 WHERE key='finance.driver_monthly_fee_cents')<>'5990' THEN
  RAISE EXCEPTION 'APOIS_DRIVER_NEW_PRICE_NOT_CONFIGURED' USING ERRCODE='55000';
 END IF;
END;
$apois_driver_new_price_postcheck$;
COMMIT;
