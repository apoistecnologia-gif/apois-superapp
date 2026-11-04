-- Backend RPC ACL tests in the disposable sixth PostgreSQL QA database.
-- Stubs expose the actual production argument identities but never handle data.
\set ON_ERROR_STOP on
CREATE FUNCTION public.create_order_atomic(uuid,uuid,jsonb,text,jsonb,uuid,text)
RETURNS text LANGUAGE sql AS $stub$ SELECT 'synthetic-v1'::text $stub$;
CREATE FUNCTION public.create_order_atomic_v2(uuid,uuid,jsonb,text,jsonb,uuid,text,text,text)
RETURNS text LANGUAGE sql AS $stub$ SELECT 'synthetic-v2'::text $stub$;
CREATE FUNCTION public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)
RETURNS text LANGUAGE sql AS $stub$ SELECT 'synthetic-intent'::text $stub$;
-- Initial default FUNCTION privileges should demonstrate the inherited PUBLIC
-- issue before the staged revokes: both anonymous/authenticated can EXECUTE.
DO $before$
BEGIN
 IF NOT has_function_privilege('anon',
  'public.create_order_for_checkout_intent_v2(uuid,uuid,jsonb,text,jsonb,uuid,uuid,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Expected PUBLIC default EXECUTE missing; fixture is not representative'; END IF;
 RAISE NOTICE '[PASS] Default RPC privilege reproduced: anonymous inherits PUBLIC EXECUTE';
END;
$before$;
