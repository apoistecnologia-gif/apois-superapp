-- APOIS Corridas: vaulted, limited-purpose cron token for redispatch recovery.
-- The token is generated inside Postgres and is NEVER committed to GitHub,
-- output to an SQL result, or reused as a service-role credential.
-- Keep this separate from pg_net enablement and cron activation.
BEGIN;
DO $preflight$
BEGIN
  IF to_regclass('vault.secrets') IS NULL
    OR to_regclass('vault.decrypted_secrets') IS NULL
    OR to_regprocedure('vault.create_secret(text,text,text,uuid)') IS NULL
    OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL
    OR to_regprocedure('extensions.digest(text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'apois_redispatch_cron_vault_prerequisites_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name='apois_redispatch_cron_token_v1') THEN
    RAISE EXCEPTION 'apois_redispatch_cron_token_already_exists_review_required';
  END IF;
  IF to_regprocedure('public.apois_redispatch_cron_token_valid(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'apois_redispatch_cron_auth_rpc_already_exists';
  END IF;
END
$preflight$;

-- Secure random credential: stored only in Vault, never in cron.job.command.
DO $create_token$
BEGIN
  PERFORM vault.create_secret(
    encode(extensions.gen_random_bytes(32), 'hex'),
    'apois_redispatch_cron_token_v1',
    'APOIS dedicated redispatch scheduler capability; no financial privileges',
    NULL::uuid
  );
END
$create_token$;

-- The Edge function uses service-role DB access to call this wrapper.
-- Unlike exposing service_role key to cron, this credential authorizes only
-- a bounded redispatch scan, never arbitrary DB queries or payments.
CREATE FUNCTION public.apois_redispatch_cron_token_valid(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF _token IS NULL OR length(_token)<>64 OR _token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM vault.decrypted_secrets s
    WHERE s.name='apois_redispatch_cron_token_v1'
      AND extensions.digest(s.decrypted_secret, 'sha256')
          = extensions.digest(_token, 'sha256')
  );
END
$function$;

REVOKE ALL ON FUNCTION public.apois_redispatch_cron_token_valid(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apois_redispatch_cron_token_valid(text)
TO service_role;

DO $postcheck$
BEGIN
  IF has_function_privilege('anon', 'public.apois_redispatch_cron_token_valid(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.apois_redispatch_cron_token_valid(text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.apois_redispatch_cron_token_valid(text)', 'EXECUTE')
    OR (SELECT count(*) FROM vault.secrets WHERE name='apois_redispatch_cron_token_v1')<>1
  THEN
    RAISE EXCEPTION 'apois_redispatch_cron_auth_postcheck_failed';
  END IF;
END
$postcheck$;
COMMIT;
