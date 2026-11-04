-- Separate disposable PG17 database only: signatures reflect live catalogue;
-- all bodies here are NO-OP placeholders, never real payout or tariff logic.
CREATE OR REPLACE FUNCTION public.admin_settle_payout(
 _payout_id uuid,_new_status text,_provider text DEFAULT NULL::text,
 _provider_payout_id text DEFAULT NULL::text,_failure_reason text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$ BEGIN NULL; END; $f$;
CREATE OR REPLACE FUNCTION public.admin_update_platform_setting(_key text,_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$ BEGIN NULL; END; $f$;
CREATE OR REPLACE FUNCTION public.admin_create_fee_rule(
 _name text,_city_id uuid,_merchant_id uuid,_merchant_commission_percent numeric,
 _courier_base_fee numeric,_courier_per_km numeric,_courier_minimum_fee numeric,
 _customer_service_fee numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$ BEGIN RETURN NULL::uuid; END; $f$;
CREATE OR REPLACE FUNCTION public.admin_update_fee_rule(
 _fee_rule_id uuid,_merchant_commission_percent numeric,_courier_base_fee numeric,
 _courier_per_km numeric,_courier_minimum_fee numeric,_customer_service_fee numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$ BEGIN NULL; END; $f$;
CREATE OR REPLACE FUNCTION public.admin_set_fee_rule_active(_fee_rule_id uuid,_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$ BEGIN NULL; END; $f$;

-- The PostgreSQL default makes functions executable through PUBLIC before fix.
DO $qa$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
 'admin_settle_payout','admin_update_platform_setting','admin_create_fee_rule',
 'admin_update_fee_rule','admin_set_fee_rule_active'
 ) AND has_function_privilege('anon',p.oid,'EXECUTE'))<>5 THEN
  RAISE EXCEPTION 'Fixture failed to recreate five anonymous EXECUTE grants';
 END IF;
 RAISE NOTICE '[PASS] Five dangerous anonymous admin RPC EXECUTE grants reproduced in synthetic PG17';
END;
$qa$;

CREATE TABLE public.qa_admin_function_source_before(signature text PRIMARY KEY, source text NOT NULL);
INSERT INTO public.qa_admin_function_source_before(signature,source)
SELECT p.oid::regprocedure::text,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN(
 'admin_settle_payout','admin_update_platform_setting','admin_create_fee_rule',
 'admin_update_fee_rule','admin_set_fee_rule_active'
);
