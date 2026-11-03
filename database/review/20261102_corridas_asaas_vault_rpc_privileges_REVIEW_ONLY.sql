-- REVIEW ONLY — NOT DEPLOYED. APOIS Corridas project tbbzkrfupmqdywnzgnms.
-- P0: These postgres SECURITY DEFINER functions expose vault decrypted secrets
-- and write/update vault secrets without actor validation; anon/authenticated
-- EXECUTE currently enabled. This is unsafe even while provider is retired.
-- Live read-only row count in public.asaas_subaccount_credentials: 0 on 2026-11-02.
-- No secret values were requested, viewed, changed, copied or logged.
-- Audited source search across three pinned/integration repos found no legitimate
-- direct public/driver/merchant client caller. Preserve only service_role.
-- Before deploying: verify active Edge Function call graph and rollback plan.
BEGIN;
DO $preflight$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY[
  'public.get_asaas_subaccount_secret(uuid)',
  'public.store_asaas_subaccount_secret(uuid,text)'
 ] LOOP
  IF to_regprocedure(item) IS NULL THEN
   RAISE EXCEPTION 'APOIS P0 Asaas vault function signature drift: %',item;
  END IF;
 END LOOP;
END;
$preflight$;
REVOKE ALL ON FUNCTION public.get_asaas_subaccount_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_asaas_subaccount_secret(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.store_asaas_subaccount_secret(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_asaas_subaccount_secret(uuid,text) TO service_role;
DO $postflight$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY[
  'public.get_asaas_subaccount_secret(uuid)',
  'public.store_asaas_subaccount_secret(uuid,text)'
 ] LOOP
  IF has_function_privilege('anon',to_regprocedure(item),'EXECUTE')
   OR has_function_privilege('authenticated',to_regprocedure(item),'EXECUTE')
   OR NOT has_function_privilege('service_role',to_regprocedure(item),'EXECUTE')
  THEN
   RAISE EXCEPTION 'APOIS P0 Asaas vault unsafe function ACL %',item;
  END IF;
 END LOOP;
END;
$postflight$;
COMMIT;
