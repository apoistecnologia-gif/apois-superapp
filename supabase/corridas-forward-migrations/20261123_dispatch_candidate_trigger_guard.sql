-- APOIS Corridas — production candidate trigger integrity, reviewed 2026-11-23.
-- Replaces only public.append_nearby_busy_driver_candidates(); existing trigger
-- remains installed. Never creates payments, jobs, or ride records.
BEGIN;

DO $preflight$
DECLARE v_existing text;
BEGIN
  IF to_regprocedure('public.append_nearby_busy_driver_candidates()') IS NULL
    OR to_regclass('public.rides') IS NULL
    OR to_regclass('public.drivers') IS NULL
    OR to_regclass('public.app_settings') IS NULL
    OR to_regprocedure('private.driver_subscription_allows_rides(text)') IS NULL
  THEN
    RAISE EXCEPTION 'apois_dispatch_trigger_prerequisites_missing';
  END IF;
  v_existing := pg_get_functiondef('public.append_nearby_busy_driver_candidates()'::regprocedure);
  IF v_existing NOT LIKE '%append_nearby_busy_driver_candidates%'
    OR v_existing NOT LIKE '%private.driver_subscription_allows_rides%'
    OR v_existing NOT LIKE '%new.offered_driver_ids%'
    OR v_existing NOT LIKE '%new.candidate_driver_ids%'
  THEN
    RAISE EXCEPTION 'apois_dispatch_trigger_source_changed_review_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.rides'::regclass
      AND tgname='rides_append_nearby_busy_candidates'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'apois_dispatch_trigger_binding_missing';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.append_nearby_busy_driver_candidates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_radius_km numeric := 5;
  v_extra uuid[] := '{}'::uuid[];
BEGIN
  IF NEW.status <> 'procurar_motorista'
    OR NEW.driver_id IS NOT NULL
    OR NEW.accepted_driver_id IS NOT NULL
    OR NEW.origin_lat IS NULL
    OR NEW.origin_lng IS NULL
    OR NEW.passenger_id IS NULL
    OR NEW.origin_lat NOT BETWEEN -90 AND 90
    OR NEW.origin_lng NOT BETWEEN -180 AND 180
    OR (NEW.origin_lat = 0 AND NEW.origin_lng = 0)
  THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT coalesce((value #>> '{}')::numeric, 5) INTO v_radius_km
      FROM public.app_settings WHERE key='ride.next_offer_max_distance_km';
  EXCEPTION WHEN others THEN
    v_radius_km := 5;
  END;
  v_radius_km := greatest(0.5, least(coalesce(v_radius_km, 5), 20));

  -- Enrichment only: never materialize an offer that the JS dispatcher did
  -- not explicitly select and notify. Offered IDs are authoritative.
  SELECT coalesce(array_agg(x.user_id), '{}'::uuid[]) INTO v_extra
  FROM (
    SELECT d.user_id
    FROM public.drivers d
    WHERE d.is_online IS TRUE
      AND d.approval_status='aprovado'
      AND d.suspended_at IS NULL
      AND private.driver_subscription_allows_rides(d.subscription_status)
      AND d.category=NEW.category
      AND d.user_id IS DISTINCT FROM NEW.passenger_id
      AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
      AND d.current_lat BETWEEN -90 AND 90
      AND d.current_lng BETWEEN -180 AND 180
      AND NOT (d.current_lat=0 AND d.current_lng=0)
      AND d.last_location_at IS NOT NULL
      AND d.last_location_at >= now()-interval '120 seconds'
      AND d.last_location_at <= now()+interval '30 seconds'
      AND NOT (d.user_id=any(coalesce(NEW.rejected_driver_ids, '{}'::uuid[])))
      AND NOT (d.user_id=any(coalesce(NEW.offered_driver_ids, '{}'::uuid[])))
      AND EXISTS (
        SELECT 1 FROM public.rides current_ride
        WHERE current_ride.driver_id=d.id AND current_ride.status='em_viagem'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rides queued_ride
        WHERE queued_ride.driver_id=d.id
          AND queued_ride.status='procurar_motorista'
          AND queued_ride.queued_after_ride_id IS NOT NULL
      )
      AND (
        6371*acos(least(1,greatest(-1,
          cos(radians(NEW.origin_lat::double precision)) *
          cos(radians(d.current_lat::double precision)) *
          cos(radians(d.current_lng::double precision)-radians(NEW.origin_lng::double precision)) +
          sin(radians(NEW.origin_lat::double precision)) *
          sin(radians(d.current_lat::double precision))
        )))
      ) <= v_radius_km
    ORDER BY (
        6371*acos(least(1,greatest(-1,
          cos(radians(NEW.origin_lat::double precision)) *
          cos(radians(d.current_lat::double precision)) *
          cos(radians(d.current_lng::double precision)-radians(NEW.origin_lng::double precision)) +
          sin(radians(NEW.origin_lat::double precision)) *
          sin(radians(d.current_lat::double precision))
        )))
    ) ASC
    LIMIT 5
  ) x;

  IF cardinality(v_extra)>0 THEN
    SELECT coalesce(array_agg(DISTINCT candidate_id), '{}'::uuid[])
      INTO NEW.candidate_driver_ids
    FROM unnest(coalesce(NEW.candidate_driver_ids, '{}'::uuid[])||v_extra) candidate_id;
  END IF;
  -- Intentionally DO NOT append NEW.offered_driver_ids. The dispatcher owns
  -- the offers; trigger-added drivers receive a chance on the next cycle.
  RETURN NEW;
END;
$function$;

DO $postcheck$
DECLARE v_source text;
BEGIN
  v_source := pg_get_functiondef('public.append_nearby_busy_driver_candidates()'::regprocedure);
  IF v_source NOT LIKE '%d.user_id IS DISTINCT FROM NEW.passenger_id%'
    OR v_source NOT LIKE '%d.last_location_at <= now()%'
    OR v_source LIKE '%INTO new.offered_driver_ids%'
  THEN
    RAISE EXCEPTION 'apois_dispatch_trigger_postcheck_failed';
  END IF;
END
$postcheck$;

COMMIT;
