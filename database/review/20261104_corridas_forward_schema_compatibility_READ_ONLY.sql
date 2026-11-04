-- APOIS CORRIDAS — production catalog compatibility PRE-FLIGHT.
-- Read-only pg_catalog metadata (NO tables' business rows, PII, DDL or writes).
-- Verifies required dependencies for forward-only staged migrations.
-- This is NOT a full schema clone, a migration dry-run, or proof of billing.
-- Target Supabase project: tbbzkrfupmqdywnzgnms
WITH
expected_columns(schema_name,table_name,column_name,db_type) AS (
 VALUES
  ('public','users','id','uuid'),
  ('public','users','auth_user_id','uuid'),
  ('public','drivers','id','uuid'),
  ('public','drivers','user_id','uuid'),
  ('public','drivers','approval_status','text'),
  ('public','drivers','subscription_status','text'),
  ('public','drivers','is_online','bool'),
  ('public','drivers','suspended_at','timestamptz'),
  ('public','drivers','blocked_at','timestamptz'),
  ('public','drivers','last_location_at','timestamptz'),
  ('public','drivers','current_lat','numeric'),
  ('public','drivers','current_lng','numeric'),
  ('public','drivers','current_heading','numeric'),
  ('public','drivers','category','text'),
  ('public','rides','id','uuid'),
  ('public','rides','status','text'),
  ('public','rides','driver_id','uuid'),
  ('public','rides','accepted_driver_id','uuid'),
  ('public','rides','candidate_driver_ids','_uuid'),
  ('public','rides','offered_driver_ids','_uuid'),
  ('public','rides','rejected_driver_ids','_uuid'),
  ('public','rides','queued_after_ride_id','uuid'),
  ('public','rides','request_expires_at','timestamptz'),
  ('public','rides','origin_lat','numeric'),
  ('public','rides','origin_lng','numeric'),
  ('public','rides','destination_lat','numeric'),
  ('public','rides','destination_lng','numeric'),
  ('public','rides','payment_method','text'),
  ('public','rides','service_details','jsonb'),
  ('public','rides','final_price','numeric'),
  ('public','audit_logs','actor_id','uuid'),
  ('public','audit_logs','metadata','jsonb'),
  ('public','app_settings','key','text'),
  ('public','app_settings','value','jsonb')
),
expected_functions(signature) AS (
 VALUES
  ('auth.uid()'),
  ('public.mobility_user_id()'),
  ('private.driver_kyc_is_ready(uuid)'),
  ('private.driver_subscription_allows_rides(text)'),
  ('apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric)'),
  ('apois_rpc_private.driver_accept_ride(uuid)'),
  ('apois_rpc_private.driver_accept_ride_candidate_legacy(uuid)'),
  ('apois_rpc_private.driver_finish_ride(uuid)'),
  ('public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)'),
  ('public.driver_accept_ride(uuid)'),
  ('public.driver_finish_ride(uuid)'),
  ('private.enforce_driver_operational_stage_transition()'),
  ('public.append_nearby_busy_driver_candidates()')
),
expected_triggers(schema_name,table_name,trigger_name,signature) AS (
 VALUES
  ('public','rides','trg_rides_driver_operational_stage_gate','private.enforce_driver_operational_stage_transition()'),
  ('public','rides','rides_append_nearby_busy_candidates','public.append_nearby_busy_driver_candidates()')
),
expected_rls(schema_name,table_name) AS (
 VALUES
 ('public','__skip__')
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
 
)
SELECT kind,object_name,ready
FROM checks
ORDER BY ready,kind,object_name;
