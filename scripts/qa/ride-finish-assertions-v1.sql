-- Tests the actual staged driver_finish_ride SQL, not a JavaScript mock.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);

-- Attempt to finish another driver's ride must NOT mutate it.
DO $t$
DECLARE rejected boolean:=false; msg text;
BEGIN
 BEGIN
  PERFORM public.driver_finish_ride('30000000-0000-4000-8000-000000000301');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'invalid_ride_transition' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'cross-driver finish succeeded'; END IF;
 RAISE NOTICE '[PASS] Cross-driver finish is blocked';
END;
$t$;

-- Approved and online driver 7 can finish and promote the queued next ride
-- with fresh KYC/GPS, no active electronic subscription.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
DO $t$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_finish_ride('30000000-0000-4000-8000-000000000301') INTO result;
 IF (result->>'promoted_queued_ride_id')::uuid IS DISTINCT FROM
  '30000000-0000-4000-8000-000000000302'::uuid
 OR result->>'status'<>'finalizada'
 OR (result->>'final_price')::numeric IS DISTINCT FROM 20::numeric THEN
  RAISE EXCEPTION 'eligible queued ride not promoted: %',result;
 END IF;
 RAISE NOTICE '[PASS] Cash ride finished and eligible next ride promoted';
END;
$t$;

-- Repeating the same completion must reject: no duplicate operation.
DO $t$
DECLARE rejected boolean:=false; msg text;
BEGIN
 BEGIN
  PERFORM public.driver_finish_ride('30000000-0000-4000-8000-000000000301');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg<>'invalid_ride_transition' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'duplicate ride completion accepted'; END IF;
 RAISE NOTICE '[PASS] Duplicate completion blocked';
END;
$t$;

-- Driver 8 has active trip but KYC was not completed: finish the existing
-- trip, release the queued ride back to searching and remove assignment.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
DO $t$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_finish_ride('30000000-0000-4000-8000-000000000303') INTO result;
 IF (result->>'released_queued_ride_id')::uuid IS DISTINCT FROM
  '30000000-0000-4000-8000-000000000304'::uuid OR result->>'promoted_queued_ride_id' IS NOT NULL THEN
  RAISE EXCEPTION 'ineligible KYC queue not released: %',result;
 END IF;
 RAISE NOTICE '[PASS] Ineligible KYC driver finishes current ride but releases queued ride';
END;
$t$;

-- A suspended driver must finish the existing trip, never inherit the next.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $t$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_finish_ride('30000000-0000-4000-8000-000000000305') INTO result;
 IF (result->>'released_queued_ride_id')::uuid IS DISTINCT FROM
  '30000000-0000-4000-8000-000000000306'::uuid THEN
  RAISE EXCEPTION 'suspended driver queue not released: %',result;
 END IF;
 RAISE NOTICE '[PASS] Suspended driver releases next queue';
END;
$t$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
DO $t$
DECLARE result jsonb;
BEGIN
 SELECT public.driver_finish_ride('30000000-0000-4000-8000-000000000307') INTO result;
 IF (result->>'released_queued_ride_id')::uuid IS DISTINCT FROM
  '30000000-0000-4000-8000-000000000308'::uuid THEN
  RAISE EXCEPTION 'offline/stale driver queue not released: %',result;
 END IF;
 RAISE NOTICE '[PASS] Offline/stale-GPS driver releases next queue';
END;
$t$;
COMMIT;

-- Final data checks as fixture owner, not as authenticated client.
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.rides WHERE id IN (
  '30000000-0000-4000-8000-000000000301',
  '30000000-0000-4000-8000-000000000303',
  '30000000-0000-4000-8000-000000000305',
  '30000000-0000-4000-8000-000000000307'
 ) AND status='finalizada' AND final_price=20 AND completed_at IS NOT NULL;
 IF n<>4 THEN RAISE EXCEPTION 'expected four completed cash rides, got %',n; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.rides WHERE id='30000000-0000-4000-8000-000000000302'
  AND status='motorista_a_caminho'
  AND driver_id='20000000-0000-4000-8000-000000000007'
  AND queued_after_ride_id IS NULL AND security_code='9999'
 ) THEN RAISE EXCEPTION 'eligible queued ride was not promoted correctly'; END IF;
 SELECT count(*) INTO n FROM public.rides WHERE id IN (
  '30000000-0000-4000-8000-000000000304',
  '30000000-0000-4000-8000-000000000306',
  '30000000-0000-4000-8000-000000000308'
 ) AND status='procurar_motorista' AND driver_id IS NULL
   AND accepted_driver_id IS NULL AND queued_after_ride_id IS NULL
   AND cardinality(offered_driver_ids)=0
   AND security_code IS NULL;
 IF n<>3 THEN RAISE EXCEPTION 'expected three fully unassigned queued rides, got %',n; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE action='ride.driver_finished';
 IF n<>4 THEN RAISE EXCEPTION 'finish audit count mismatch: %',n; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE action='ride.queued_promoted';
 IF n<>1 THEN RAISE EXCEPTION 'promoted audit count mismatch: %',n; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE action='ride.queued_released_ineligible_driver';
 IF n<>3 THEN RAISE EXCEPTION 'released audit count mismatch: %',n; END IF;
 RAISE NOTICE '[PASS] Queue financial fields, promotion/release, identity and audits stable';
END;
$t$;
