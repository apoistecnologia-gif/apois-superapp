-- APOIS ENTREGAS, production-aware read-only cash QA preflight.
-- NO DDL, no INSERT/UPDATE, no RPC invocation, no PII, no money.
-- Run only in project ptgkwyyolrdgnqketkjj.
-- Every gate required=true must be true before calling the cash flow production-ready.
SELECT gate, required, passed, detail FROM (
 SELECT 'cash_atomic_order_created_as_pending'::text AS gate,true AS required,
   EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='create_order_atomic'
       AND pg_get_functiondef(p.oid) ILIKE '%''cash''%'
       AND pg_get_functiondef(p.oid) ILIKE '%''pending''%') AS passed,
   'Cash must be permitted and payment_status initially pending'::text AS detail
 UNION ALL
 SELECT 'general_cash_order_visibility',true,
   EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders'
     AND policyname='Merchant members can view operational merchant orders'
     AND qual ILIKE '%cash%'), 'Merchant member can view their own cash/pending orders'
 UNION ALL
 SELECT 'general_cash_items_visibility',true,
   EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items'
     AND policyname='Merchant members can view operational order items'
     AND qual ILIKE '%cash%'), 'Merchant member can view order items without paid fabrication'
 UNION ALL
 SELECT 'general_cash_history_visibility',true,
   EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_status_history'
     AND policyname='Merchant members can view operational order history'
     AND qual ILIKE '%cash%'), 'Merchant can view cash order history under ownership checks'
 UNION ALL
 SELECT 'cash_cancellation_without_gateway_refund',true,
   COALESCE(
     pg_get_functiondef(to_regprocedure('public.merchant_reject_order(uuid,text)'))
       ILIKE '%v_order.payment_method = ''cash''%'
     AND pg_get_functiondef(to_regprocedure('public.merchant_reject_order(uuid,text)'))
       ILIKE '%v_order.status = ''cancelled''%'
     AND pg_get_functiondef(to_regprocedure('public.merchant_reject_order(uuid,text)'))
       ILIKE '%coalesce(v_refund.status in (''pending'',''processing''), false)%'
   ,false),
   'Merchant may reject cash/pending and safely retry cancelled cash with refund_pending=false'
 UNION ALL
 SELECT 'courier_manual_payout_mode',true,
   EXISTS(SELECT 1 FROM public.platform_settings
     WHERE key='courier_payout_mode' AND trim(both '"' from value::text)='merchant_manual'),
   'Merchant pays courier directly; no platform wallet/payout API required'
 UNION ALL
 SELECT 'delivery_quote_accepts_manual_mode',true,
   COALESCE(pg_get_functiondef(to_regprocedure('public.get_delivery_checkout_readiness()'))
     ILIKE '%merchant_manual%',false),
   'Checkout readiness supports manual courier model'
 UNION ALL
 SELECT 'safe2pay_is_not_required_for_cash_order',false,
   EXISTS(SELECT 1 FROM public.platform_settings
     WHERE key='order_payment_provider' AND value='"safe2pay_marketplace"'::jsonb),
   'Informational ONLY: configured future provider does not authorize electronic cash-test'
 UNION ALL
 SELECT 'merchant_reject_order_anon_denied',true,
   EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='merchant_reject_order'
       AND pg_get_function_identity_arguments(p.oid)='_order_id uuid, _reason text'
       AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
       AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
   'Cash cancellation SECURITY DEFINER RPC denies anon; staged migration revokes PUBLIC/anon while preserving authenticated'
) gates ORDER BY gate;
