-- APOIS ENTREGAS — production catalog compatibility PRE-FLIGHT.
-- Read-only pg_catalog metadata (NO tables' business rows, PII, DDL or writes).
-- Verifies required dependencies for forward-only staged migrations.
-- This is NOT a full schema clone, a migration dry-run, or proof of billing.
-- Target Supabase project: ptgkwyyolrdgnqketkjj
WITH
expected_columns(schema_name,table_name,column_name,db_type) AS (
 VALUES
  ('public','orders','id','uuid'),
  ('public','orders','merchant_id','uuid'),
  ('public','orders','customer_user_id','uuid'),
  ('public','orders','payment_method','text'),
  ('public','orders','payment_status','text'),
  ('public','orders','status','text'),
  ('public','orders','request_key','uuid'),
  ('public','orders','merchant_net','numeric'),
  ('public','orders','platform_fee','numeric'),
  ('public','orders','courier_earnings','numeric'),
  ('public','orders','cancelled_at','timestamptz'),
  ('public','order_items','order_id','uuid'),
  ('public','order_status_history','order_id','uuid'),
  ('public','merchants','id','uuid'),
  ('public','merchants','name','text'),
  ('public','merchants','slug','text'),
  ('public','merchants','approval_status','text'),
  ('public','merchants','is_active','bool'),
  ('public','merchants','owner_user_id','uuid'),
  ('public','merchant_subscriptions','merchant_id','uuid'),
  ('public','merchant_subscriptions','metadata','jsonb'),
  ('public','merchant_subscriptions','last_payment_status','text'),
  ('public','merchant_subscriptions','current_period_end','timestamptz'),
  ('public','platform_settings','key','text'),
  ('public','platform_settings','value','jsonb'),
  ('public','payments','order_id','uuid'),
  ('public','payments','status','text'),
  ('public','payments','amount','numeric'),
  ('public','refunds','order_id','uuid'),
  ('public','refunds','payment_id','uuid'),
  ('public','refunds','status','text'),
  ('public','delivery_jobs','order_id','uuid'),
  ('public','delivery_jobs','status','text'),
  ('public','delivery_jobs','cancelled_at','timestamptz'),
  ('public','delivery_offers','delivery_job_id','uuid'),
  ('public','delivery_offers','status','text'),
  ('public','delivery_events','delivery_job_id','uuid'),
  ('public','admin_audit_logs','action','text'),
  ('private','apois_test_cash_access','merchant_id','uuid'),
  ('private','apois_test_cash_access','enabled','bool'),
  ('private','apois_test_cash_access','expires_at','timestamptz'),
  ('private','apois_test_cash_orders','order_id','uuid')
),
expected_functions(signature) AS (
 VALUES
  ('public.merchant_reject_order(uuid,text)'),
  ('public.merchant_subscription_in_good_standing(uuid)'),
  ('public.current_user_is_merchant_member(uuid)'),
  ('public.current_user_is_admin()'),
  ('public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)'),
  ('public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)'),
  ('public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)'),
  ('private.apois_test_cash_authorized(uuid,uuid)'),
  ('private.apois_qa_no_real_payment()'),
  ('private.apois_test_cash_order_guard()'),
  ('private.apois_mark_cash_test_order()'),
  ('public.enforce_merchant_subscription_on_order()'),
  ('public.enforce_supported_order_payment_method()'),
  ('public.enforce_order_payment_before_fulfillment()')
),
expected_triggers(schema_name,table_name,trigger_name,signature) AS (
 VALUES
  ('public','orders','apois_cash_test_financial_guard','private.apois_test_cash_order_guard()'),
  ('public','orders','apois_qa_never_real_payment','private.apois_qa_no_real_payment()'),
  ('public','orders','apois_cash_test_mark_order','private.apois_mark_cash_test_order()'),
  ('public','orders','trg_enforce_merchant_subscription_on_order','public.enforce_merchant_subscription_on_order()'),
  ('public','orders','orders_supported_payment_method_guard','public.enforce_supported_order_payment_method()'),
  ('public','orders','orders_require_payment_before_fulfillment','public.enforce_order_payment_before_fulfillment()')
),
expected_rls(schema_name,table_name) AS (
 VALUES
  ('public','orders'),
  ('public','order_items'),
  ('public','order_status_history')
),
required_roles(role_name) AS (VALUES ('anon'),('authenticated'),('service_role')),
checks AS (
 SELECT 'column'::text AS kind,
  (c.schema_name||'.'||c.table_name||'.'||c.column_name)::text AS object_name,
  EXISTS(
   SELECT 1 FROM pg_attribute a
   JOIN pg_class t ON t.oid=a.attrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace
   JOIN pg_type typ ON typ.oid=a.atttypid
   WHERE n.nspname=c.schema_name AND t.relname=c.table_name
    AND t.relkind IN ('r','p') AND a.attname=c.column_name
    AND a.attnum>0 AND NOT a.attisdropped AND typ.typname=c.db_type
  ) AS ready
 FROM expected_columns c
 UNION ALL
 SELECT 'function', f.signature, to_regprocedure(f.signature) IS NOT NULL
 FROM expected_functions f
 UNION ALL
 SELECT 'trigger',
  tr.schema_name||'.'||tr.table_name||'.'||tr.trigger_name,
  EXISTS(
   SELECT 1 FROM pg_trigger t
   WHERE t.tgrelid=to_regclass(tr.schema_name||'.'||tr.table_name)
    AND t.tgname=tr.trigger_name
    AND t.tgfoid=to_regprocedure(tr.signature)
    AND NOT t.tgisinternal
    AND t.tgenabled IN ('O','A')
  )
 FROM expected_triggers tr
 UNION ALL
 SELECT 'role', r.role_name,
  EXISTS(SELECT 1 FROM pg_roles pr WHERE pr.rolname=r.role_name)
 FROM required_roles r
  UNION ALL
 SELECT 'rls',e.schema_name||'.'||e.table_name,
  COALESCE((
   SELECT c.relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname=e.schema_name AND c.relname=e.table_name
  ),false)
 FROM expected_rls e
)
SELECT kind,object_name,ready
FROM checks
ORDER BY ready,kind,object_name;
