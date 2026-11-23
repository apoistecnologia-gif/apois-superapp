-- Assertions against isolated PostgreSQL AFTER migration.
-- Any exception fails GitHub Actions; no production DB is ever contacted.
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF r.passenger_id=ANY(r.candidate_driver_ids) THEN
    RAISE EXCEPTION 'self_candidate_leaked';
  END IF;
  IF NOT ('22222222-2222-4222-8222-222222222222'::uuid=ANY(r.candidate_driver_ids))
    OR NOT ('33333333-3333-4333-8333-333333333333'::uuid=ANY(r.candidate_driver_ids))
  THEN
    RAISE EXCEPTION 'legitimate_busy_candidates_missing %',r.candidate_driver_ids;
  END IF;
  IF '44444444-4444-4444-8444-444444444444'::uuid=ANY(r.candidate_driver_ids) THEN
    RAISE EXCEPTION 'stale_gps_candidate_leaked';
  END IF;
  IF cardinality(r.offered_driver_ids)<>0 THEN
    RAISE EXCEPTION 'trigger_generated_unnotified_offer';
  END IF;
END
$assert$;

-- Explicitly offered drivers must not be added by the enrichment trigger.
UPDATE public.rides
SET offered_driver_ids=ARRAY['22222222-2222-4222-8222-222222222222'::uuid],
    candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF '22222222-2222-4222-8222-222222222222'::uuid=ANY(r.candidate_driver_ids)
    OR cardinality(r.offered_driver_ids)<>1
    OR NOT ('33333333-3333-4333-8333-333333333333'::uuid=ANY(r.candidate_driver_ids))
  THEN
    RAISE EXCEPTION 'offered_pool_or_candidate_boundary_broken';
  END IF;
END
$assert$;

-- Rejected busy driver is excluded, even if nearby and eligible.
UPDATE public.rides
SET rejected_driver_ids=ARRAY['33333333-3333-4333-8333-333333333333'::uuid],
    candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF cardinality(r.candidate_driver_ids)<>0 THEN
    RAISE EXCEPTION 'rejected_or_self_candidate_reoffered';
  END IF;
END
$assert$;

-- When no one is already offered or rejected, reserved next-ride driver is
-- excluded and suspended drivers are also excluded.
UPDATE public.drivers SET suspended_at=now()
WHERE id='02222222-2222-4222-8222-222222222222';
UPDATE public.rides
SET offered_driver_ids='{}'::uuid[], rejected_driver_ids='{}'::uuid[],
    candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF cardinality(r.candidate_driver_ids)<>1
    OR r.candidate_driver_ids[1]<>'33333333-3333-4333-8333-333333333333'::uuid
  THEN
    RAISE EXCEPTION 'suspended_driver_guard_failed';
  END IF;
END
$assert$;
INSERT INTO public.rides(id,passenger_id,category,status,driver_id,queued_after_ride_id)
VALUES ('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '66666666-6666-4666-8666-666666666666',
        'carros','procurar_motorista',
        '03333333-3333-4333-8333-333333333333',
        '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF cardinality(r.candidate_driver_ids)<>0 THEN
    RAISE EXCEPTION 'queued_busy_driver_candidate_leaked';
  END IF;
END
$assert$;

-- Terminal/non-search statuses cannot be enriched.
UPDATE public.rides
SET status='motorista_a_caminho', candidate_driver_ids='{}'::uuid[]
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
DECLARE r public.rides%rowtype;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF cardinality(r.candidate_driver_ids)<>0 THEN
    RAISE EXCEPTION 'driver_stage_candidate_leaked';
  END IF;
END
$assert$;
SELECT 'APOIS isolated trigger integration assertions passed' AS result;
