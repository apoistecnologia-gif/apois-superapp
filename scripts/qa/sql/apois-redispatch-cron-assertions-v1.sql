-- Executes the actual cron.command against a local no-network net.http_post stub.
DO $assert$
DECLARE v_command text; v_response bigint; v_count integer;
BEGIN
  SELECT count(*), max(command) INTO v_count,v_command FROM cron.job
  WHERE jobname='apois-driver-redispatch-recovery'
    AND active IS TRUE AND schedule='* * * * *';
  IF v_count<>1 OR v_command IS NULL THEN
    RAISE EXCEPTION 'single_active_cron_job_missing';
  END IF;
  IF v_command NOT LIKE '%vault.decrypted_secrets%'
    OR v_command LIKE '%Bearer eyJ%'
    OR v_command LIKE '%sb_secret_%'
  THEN
    RAISE EXCEPTION 'cron_secret_embedded_or_vault_missing';
  END IF;
  EXECUTE v_command INTO v_response;
  IF v_response<>1 THEN
    RAISE EXCEPTION 'cron_call_did_not_invoke_stub';
  END IF;
END
$assert$;
SELECT 'APOIS cron command and Vault token boundary verified in disposable PostgreSQL' AS result;
