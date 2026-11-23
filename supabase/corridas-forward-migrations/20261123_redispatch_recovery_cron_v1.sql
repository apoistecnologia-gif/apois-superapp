-- APOIS Corridas: cron after both Vault credential RPC and Edge deployment.
-- No service_role or other key material is ever stored in cron.job.command.
-- Prerequisites: pg_cron (already installed), pg_net, Vault, authenticated
-- /functions/v1/driver-redispatch-recovery (verify_jwt=false) with cron RPC.
BEGIN;
DO $preflight$
BEGIN
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL
    OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
    OR to_regprocedure('public.apois_redispatch_cron_token_valid(text)') IS NULL
    OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='apois_redispatch_cron_token_v1')
  THEN
    RAISE EXCEPTION 'apois_redispatch_cron_prerequisites_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='apois-driver-redispatch-recovery') THEN
    RAISE EXCEPTION 'apois_redispatch_cron_exists_review_required';
  END IF;
END
$preflight$;

SELECT cron.schedule(
  'apois-driver-redispatch-recovery',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://tbbzkrfupmqdywnzgnms.supabase.co/functions/v1/driver-redispatch-recovery',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-apois-redispatch-scheduler',
      (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name='apois_redispatch_cron_token_v1')
    ),
    timeout_milliseconds := 30000
  ) AS request_id;
  $job$
);
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname='apois-driver-redispatch-recovery'
      AND active IS TRUE AND schedule='* * * * *'
      AND command LIKE '%vault.decrypted_secrets%'
      AND command LIKE '%driver-redispatch-recovery%'
      AND command NOT LIKE '%Bearer eyJ%'
      AND command NOT LIKE '%sb_secret_%'
  ) THEN
    RAISE EXCEPTION 'apois_redispatch_cron_activation_postcheck_failed';
  END IF;
END
$postcheck$;
COMMIT;

-- Safe rollback without touching the Edge Function or existing ride data:
-- SELECT cron.unschedule('apois-driver-redispatch-recovery');
