-- Tests for the real migration against an isolated Vault stand-in.
DO $assert$
DECLARE stored text;
BEGIN
  SELECT secret INTO stored FROM vault.secrets
  WHERE name='apois_redispatch_cron_token_v1';
  IF stored IS NULL OR length(stored)<>64 OR stored !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'vault_secret_missing_or_too_weak';
  END IF;
  IF NOT public.apois_redispatch_cron_token_valid(stored) THEN
    RAISE EXCEPTION 'vault_secret_validation_failed';
  END IF;
  IF public.apois_redispatch_cron_token_valid(repeat('a',64)) THEN
    RAISE EXCEPTION 'unexpected_cron_token_accepted';
  END IF;
  IF public.apois_redispatch_cron_token_valid('malformed')
    OR public.apois_redispatch_cron_token_valid(NULL) THEN
    RAISE EXCEPTION 'invalid_cron_token_accepted';
  END IF;
  IF has_function_privilege('anon','public.apois_redispatch_cron_token_valid(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.apois_redispatch_cron_token_valid(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.apois_redispatch_cron_token_valid(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'cron_rpc_permissions_insecure';
  END IF;
END
$assert$;
SELECT 'APOIS cron Vault security assertions passed' AS result;
