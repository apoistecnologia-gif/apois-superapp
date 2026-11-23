-- APOIS CORRIDAS / MENSALIDADE R$ 99,90 - SOMENTE STAGING!
-- NUNCA EXECUTAR AUTOMATICAMENTE EM PRODUCAO OU PELO CI.
-- Preflight baseado no Supabase Corridas tbbzkrfupmqdywnzgnms em 23/11/2026:
-- app_settings = 5990; restricoes de memberships/charges = 4990;
-- zero registros nas duas tabelas; providers legados foram aposentados.
-- Precisa de revisao final, homologacao webhook, escolha de provider e
-- autorizacao EXPRESSA antes da aplicacao. Entregas permanece intocado.
BEGIN;

DO $guard$
BEGIN
  IF (SELECT value#>>'{}' FROM public.app_settings
      WHERE key = 'finance.driver_monthly_fee_cents') IS DISTINCT FROM '5990' THEN
    RAISE EXCEPTION 'APOIS_FEE_CONFIG_CHANGED_REVIEW_REQUIRED' USING ERRCODE='55000';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
         ('driver_memberships','driver_membership_charges')
        AND c.relrowsecurity) <> 2 THEN
    RAISE EXCEPTION 'APOIS_MEMBERSHIP_RLS_NOT_ENFORCED' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.driver_membership_charges) THEN
    -- Existing charge rows have no provider field; never guess provenance.
    RAISE EXCEPTION 'APOIS_EXISTING_CHARGES_REQUIRE_PROVIDER_RECONCILIATION' USING ERRCODE='55000';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private' AND p.proname='apois_guard_new_driver_membership_fee_9990') THEN
    RAISE EXCEPTION 'APOIS_NEW_FEE_GUARD_ALREADY_EXISTS' USING ERRCODE='55000';
  END IF;
END
$guard$;

-- Compatible historical contract values retained; current rows untouched.
ALTER TABLE public.driver_memberships
 DROP CONSTRAINT driver_memberships_monthly_fee_cents_check;
ALTER TABLE public.driver_memberships
 ADD CONSTRAINT driver_memberships_monthly_fee_cents_check
 CHECK (monthly_fee_cents IN (4990,5990,9990));
ALTER TABLE public.driver_memberships
 ALTER COLUMN monthly_fee_cents SET DEFAULT 9990;

ALTER TABLE public.driver_membership_charges
 DROP CONSTRAINT driver_membership_charges_amount_cents_check;
ALTER TABLE public.driver_membership_charges
 ADD CONSTRAINT driver_membership_charges_amount_cents_check
 CHECK (amount_cents IN (4990,5990,9990));

-- 2 payment providers can remain recognized for historical transactions.
-- Strictly require provider attribution on every NEW charge.
ALTER TABLE public.driver_membership_charges ADD COLUMN provider text;
ALTER TABLE public.driver_membership_charges ADD CONSTRAINT driver_membership_charges_provider_check
 CHECK (provider IN ('asaas','mercadopago'));
ALTER TABLE public.driver_membership_charges ALTER COLUMN provider SET NOT NULL;

-- Concurrent checkout requests MUST NOT create two open Pix invoices.
-- Never discard old payments; finalized/reversed charges remain auditable.
CREATE UNIQUE INDEX IF NOT EXISTS driver_membership_charges_one_open_per_driver
ON public.driver_membership_charges(driver_id)
WHERE status IN ('pending','confirmed');

-- Preserve QR image for a safe repeated read of the SAME provider charge.
-- QR content is served only to its authenticated driver through RLS.
ALTER TABLE public.driver_membership_charges
 ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text;

CREATE FUNCTION private.apois_guard_new_driver_membership_fee_9990()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.monthly_fee_cents <> 9990 THEN
    RAISE EXCEPTION 'apois_new_driver_monthly_fee_must_be_9990' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.monthly_fee_cents IS DISTINCT FROM OLD.monthly_fee_cents THEN
    RAISE EXCEPTION 'apois_existing_driver_monthly_fee_immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$body$;
CREATE TRIGGER apois_driver_monthly_fee_guard_9990
 BEFORE INSERT OR UPDATE OF monthly_fee_cents ON public.driver_memberships
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_new_driver_membership_fee_9990();

CREATE FUNCTION private.apois_guard_membership_charge_contract_9990()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
DECLARE contract_fee bigint;
DECLARE contract_provider text;
BEGIN
  SELECT monthly_fee_cents,provider INTO contract_fee,contract_provider
  FROM public.driver_memberships WHERE driver_id=NEW.driver_id;
  IF contract_fee IS NULL OR NEW.amount_cents IS DISTINCT FROM contract_fee THEN
    RAISE EXCEPTION 'apois_membership_charge_fee_mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.provider IS DISTINCT FROM contract_provider THEN
    -- If provider changes for new billing, update the contract only through
    -- an authorized backend transaction; never rewrite older charge provenance.
    RAISE EXCEPTION 'apois_membership_provider_mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$body$;
CREATE TRIGGER apois_driver_charge_contract_guard_9990
 BEFORE INSERT OR UPDATE OF driver_id,amount_cents,provider
 ON public.driver_membership_charges
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_membership_charge_contract_9990();

-- Restrict trigger helpers. They are not part of the public/Data API.
REVOKE ALL ON FUNCTION private.apois_guard_new_driver_membership_fee_9990() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apois_guard_membership_charge_contract_9990() FROM PUBLIC;

-- Central backend price, not frontend request body. Still no actual charges:
-- a separate protected flag must be deliberately activated AFTER homologation.
UPDATE public.app_settings SET value = to_jsonb(9990),
  updated_at=now() WHERE key='finance.driver_monthly_fee_cents';
INSERT INTO public.app_settings(key,value,description)
 VALUES ('finance.driver_membership_pix_enabled','false'::jsonb,
   'Gateway Pix de mensalidade: somente habilitar após homologação, credenciais e autorização')
 ON CONFLICT (key) DO UPDATE SET value='false'::jsonb,updated_at=now();
INSERT INTO public.app_settings(key,value,description)
 VALUES ('finance.driver_membership_provider','"none"'::jsonb,
   'Provedor de novas cobranças: none/asaas/mercadopago, mutável apenas pelo backend autorizado')
 ON CONFLICT (key) DO NOTHING;

DO $check$
BEGIN
  IF (SELECT value#>>'{}' FROM public.app_settings
     WHERE key='finance.driver_monthly_fee_cents') <> '9990' THEN
    RAISE EXCEPTION 'APOIS_FEE_UPDATE_NOT_CONFIRMED' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.driver_memberships WHERE monthly_fee_cents=9990
     AND status='active' AND paid_through <= now()) THEN
    RAISE EXCEPTION 'APOIS_EXPIRED_ACTIVE_MEMBERSHIP_REVIEW_REQUIRED' USING ERRCODE='55000';
  END IF;
END $check$;

-- IMPORTANT: acceptance/presence RPCs currently trust drivers.subscription_status;
-- paid_through enforcement MUST be deployed atomically with backend webhook
-- finalization before this can be released to the public. The initial staging
-- migration deliberately makes no live recurring charges.
COMMIT;
