-- Forward-only safety fix: block missing, unapproved and inactive merchants
-- from bypassing monthly subscription checks. NOT automatically applied.
-- Does not activate direct cash for ordinary merchants or change billing providers.
BEGIN;
DO $gate$
BEGIN
 IF to_regprocedure('public.merchant_subscription_in_good_standing(uuid)') IS NULL
  OR to_regclass('public.merchants') IS NULL
  OR to_regclass('public.merchant_subscriptions') IS NULL
  OR to_regclass('private.apois_test_cash_access') IS NULL
  OR to_regclass('public.platform_settings') IS NULL THEN
  RAISE EXCEPTION 'merchant subscription hardening missing production dependencies';
 END IF;
END;
$gate$;
CREATE OR REPLACE FUNCTION public.merchant_subscription_in_good_standing(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.merchants m
   WHERE m.id=_merchant_id AND m.approval_status='approved' AND m.is_active=true
 ) AND (
   EXISTS (
    SELECT 1 FROM private.apois_test_cash_access t
    JOIN public.merchants m ON m.id=t.merchant_id
    WHERE t.merchant_id=_merchant_id
      AND t.enabled=true AND t.expires_at>now()
      AND m.name ILIKE 'APOIS TESTE%'
      AND m.is_active=true AND m.approval_status='approved'
   )
   OR EXISTS (
    SELECT 1 FROM public.merchant_subscriptions ms
    JOIN public.platform_settings ps ON ps.key='mercado_pago_environment'
    WHERE ms.merchant_id=_merchant_id
      AND ms.current_period_end IS NOT NULL AND ms.current_period_end>now()
      AND COALESCE(ms.metadata->>'environment','')=COALESCE(ps.value #>> '{}','')
      AND COALESCE(ms.last_payment_status,'')='approved'
   )
 );
$function$;
REVOKE EXECUTE ON FUNCTION public.merchant_subscription_in_good_standing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_subscription_in_good_standing(uuid)
 TO authenticated, service_role;
COMMIT;
