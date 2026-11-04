-- PostgreSQL 17 isolated regression: revoked KYC must not keep a cached
-- online driver eligible. Already-started trips must still receive GPS fixes.
\set ON_ERROR_STOP on
-- User 1 was left offline by the normal presence assertions.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $qa$
DECLARE reply jsonb;
BEGIN
 SELECT public.driver_set_presence(true,-9.4,-40.5,90,6) INTO reply;
 IF reply->>'is_online'<>'true' OR reply->>'operationally_eligible'<>'true'
 THEN RAISE EXCEPTION 'Ready driver cannot return online: %',reply; END IF;
 RAISE NOTICE '[PASS] Eligible driver can resume online presence after ordinary offline action';
END;
$qa$;
COMMIT;
-- Admin revokes eligibility after the driver was already online.
UPDATE public.drivers SET kyc_ready=false
WHERE id='20000000-0000-4000-8000-000000000001';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $qa$
DECLARE reply jsonb; denied boolean:=false; err text;
BEGIN
 -- Revocation must be fail-safe even if permissions/GPS fix vanished.
 -- No heartbeat coordinates are needed to clear an already online state.
 SELECT public.driver_set_presence(true,NULL,NULL,NULL,NULL) INTO reply;
 IF reply->>'is_online'<>'false'
  OR reply->>'operationally_eligible'<>'false'
  OR reply->>'tracking_active_ride'<>'false' THEN
  RAISE EXCEPTION 'KYC-revoked cached online driver remained eligible: %',reply;
 END IF;
 BEGIN
  PERFORM public.driver_set_presence(true,-9.4,-40.5,90,6);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
  IF err<>'driver_kyc_incomplete' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'KYC-revoked driver reactivated without approved documents'; END IF;
 RAISE NOTICE '[PASS] Revoked KYC forces cached online session offline and blocks fresh online attempt';
END;
$qa$;
COMMIT;
DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.drivers
  WHERE id='20000000-0000-4000-8000-000000000001' AND is_online=false) THEN
  RAISE EXCEPTION 'KYC revocation did not persist driver offline state';
 END IF;
END;
$qa$;
-- Existing ride tracking must not be interrupted. Restore KYC, enter a trip,
-- revoke it again, then test a location refresh during active trip.
UPDATE public.drivers SET kyc_ready=true
WHERE id='20000000-0000-4000-8000-000000000001';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $qa$
DECLARE reply jsonb;
BEGIN
 SELECT public.driver_set_presence(true,-9.4,-40.5,120,8) INTO reply;
 IF reply->>'is_online'<>'true' THEN RAISE EXCEPTION 'Restored KYC cannot go online'; END IF;
END;
$qa$;
COMMIT;
UPDATE public.rides SET status='em_viagem'
WHERE id='30000000-0000-4000-8000-000000000001';
UPDATE public.drivers SET kyc_ready=false
WHERE id='20000000-0000-4000-8000-000000000001';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $qa$
DECLARE reply jsonb;
BEGIN
 SELECT public.driver_set_presence(true,-9.4,-40.5,180,9) INTO reply;
 IF reply->>'is_online'<>'false'
  OR reply->>'operationally_eligible'<>'false'
  OR reply->>'tracking_active_ride'<>'true'
  OR reply->>'current_heading'<>'180' THEN
  RAISE EXCEPTION 'KYC-revoked active ride tracking failed or remained online: %',reply;
 END IF;
 RAISE NOTICE '[PASS] Active trip keeps GPS tracking while revoked KYC disables new online eligibility';
END;
$qa$;
COMMIT;
