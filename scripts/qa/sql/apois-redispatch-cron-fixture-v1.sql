-- Disposable Postgres-only stubs for Cron and pg_net (NO external HTTP).
-- Vault fixture and real credential migration must already be applied.
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE cron.job(
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jobname text UNIQUE NOT NULL,
  schedule text NOT NULL,
  command text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE FUNCTION cron.schedule(job_name text, schedule_text text, command_text text)
RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE result bigint;
BEGIN
  INSERT INTO cron.job(jobname,schedule,command)
  VALUES(job_name,schedule_text,command_text)
  RETURNING jobid INTO result;
  RETURN result;
END
$fn$;
CREATE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 2000
)
RETURNS bigint LANGUAGE plpgsql AS $fn$
BEGIN
  IF url <> 'https://tbbzkrfupmqdywnzgnms.supabase.co/functions/v1/driver-redispatch-recovery'
    OR body <> '{}'::jsonb
    OR timeout_milliseconds <> 30000
    OR headers->>'x-apois-redispatch-scheduler' IS DISTINCT FROM
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='apois_redispatch_cron_token_v1')
  THEN
    RAISE EXCEPTION 'cron_http_payload_not_secure';
  END IF;
  RETURN 1;
END
$fn$;
