-- APOIS CORRIDAS: chamadas sem aceite, apenas busca ativa e ainda valida.
-- SQL QA: não ressuscita, não altera expiração e não expõe dados do passageiro.
-- Exposto só ao próprio motorista aprovado ONLINE, com GPS recente e assinatura habilitada.

CREATE OR REPLACE FUNCTION public.apois_list_available_ride_calls()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $apois$
DECLARE
  d public.drivers;
  v_user uuid;
  v_calls jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_user:=public.mobility_user_id();
  SELECT * INTO d FROM public.drivers
    WHERE user_id=v_user
      AND approval_status='aprovado' AND is_online IS TRUE
      AND blocked_at IS NULL AND suspended_at IS NULL
      AND last_location_at > now()-interval '5 minutes'
      AND current_lat BETWEEN -90 AND 90
      AND current_lng BETWEEN -180 AND 180
    LIMIT 1;
  IF NOT FOUND OR NOT private.driver_subscription_allows_rides(d.subscription_status) THEN
    RETURN '[]'::jsonb;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.rides r
    WHERE r.driver_id=d.id AND r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')
  ) THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',x.id,'category',x.category,
      'pickup_distance_km',round(x.distance_km::numeric,1),
      'estimated_amount',x.estimated_price,
      'remaining_seconds',greatest(0,floor(extract(epoch from (x.search_expires_at-now())))::integer),
      'area','Embarque próximo'
    ) ORDER BY x.distance_km ASC), '[]'::jsonb)
    INTO v_calls
  FROM (
    SELECT r.id,r.category,r.estimated_price,r.search_expires_at,
      6371*acos(least(1,greatest(-1,
        cos(radians(r.origin_lat::double precision))*cos(radians(d.current_lat::double precision))
          *cos(radians(r.origin_lng::double precision)-radians(d.current_lng::double precision))
        +sin(radians(r.origin_lat::double precision))*sin(radians(d.current_lat::double precision))
      ))) AS distance_km
    FROM public.rides r
    WHERE r.status='procurar_motorista'
      AND r.driver_id IS NULL AND r.accepted_driver_id IS NULL
      AND r.current_offer_driver_id IS NULL
      AND r.queued_after_ride_id IS NULL
      AND r.search_expires_at>now()
      AND (r.request_expires_at IS NULL OR r.request_expires_at<=now())
      AND r.created_at>=now()-interval '10 minutes'
      AND r.cancelled_at IS NULL
      AND r.category=d.category
      AND r.origin_lat BETWEEN -90 AND 90 AND r.origin_lng BETWEEN -180 AND 180
      AND (r.payment_method IS DISTINCT FROM 'pix' OR r.payment_status='paid')
      AND NOT (v_user=ANY(COALESCE(r.rejected_driver_ids,'{}'::uuid[])))
      AND NOT (v_user=ANY(COALESCE(r.offered_driver_ids,'{}'::uuid[])))
  ) x
  WHERE x.distance_km<=5
  ORDER BY x.distance_km ASC
  LIMIT 10;
  RETURN COALESCE(v_calls,'[]'::jsonb);
END;
$apois$;

CREATE OR REPLACE FUNCTION public.apois_claim_available_ride_call(_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $apois$
DECLARE
  d public.drivers;
  r public.rides;
  v_user uuid;
  v_distance double precision;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  v_user:=public.mobility_user_id();
  SELECT * INTO d FROM public.drivers
    WHERE user_id=v_user FOR UPDATE;
  IF NOT FOUND OR d.approval_status<>'aprovado' OR d.is_online IS DISTINCT FROM true
    OR d.blocked_at IS NOT NULL OR d.suspended_at IS NOT NULL
    OR d.last_location_at<=now()-interval '5 minutes'
    OR d.current_lat IS NULL OR d.current_lng IS NULL
    OR NOT private.driver_subscription_allows_rides(d.subscription_status)
  THEN RAISE EXCEPTION 'driver_not_available'; END IF;
  IF EXISTS (SELECT 1 FROM public.rides active
    WHERE active.driver_id=d.id
      AND active.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')
  ) THEN RAISE EXCEPTION 'driver_busy'; END IF;

  SELECT * INTO r FROM public.rides WHERE id=_ride_id FOR UPDATE;
  IF NOT FOUND
    OR r.status<>'procurar_motorista'
    OR r.driver_id IS NOT NULL OR r.accepted_driver_id IS NOT NULL
    OR r.current_offer_driver_id IS NOT NULL
    OR r.queued_after_ride_id IS NOT NULL
    OR r.search_expires_at IS NULL OR r.search_expires_at<=now()
    OR (r.request_expires_at IS NOT NULL AND r.request_expires_at>now())
    OR r.created_at<now()-interval '10 minutes'
    OR r.cancelled_at IS NOT NULL
    OR r.category IS DISTINCT FROM d.category
    OR r.origin_lat IS NULL OR r.origin_lng IS NULL
    OR (r.payment_method='pix' AND r.payment_status IS DISTINCT FROM 'paid')
    OR v_user=ANY(COALESCE(r.rejected_driver_ids,'{}'::uuid[]))
    OR v_user=ANY(COALESCE(r.offered_driver_ids,'{}'::uuid[]))
  THEN RAISE EXCEPTION 'call_no_longer_available'; END IF;
  v_distance:=6371*acos(least(1,greatest(-1,
    cos(radians(r.origin_lat::double precision))*cos(radians(d.current_lat::double precision))
      *cos(radians(r.origin_lng::double precision)-radians(d.current_lng::double precision))
    +sin(radians(r.origin_lat::double precision))*sin(radians(d.current_lat::double precision))
  )));
  IF v_distance>5 THEN RAISE EXCEPTION 'call_out_of_range'; END IF;

  -- One row lock protects the manual claim against a competing claim/dispatch.
  UPDATE public.rides
  SET current_offer_driver_id=v_user,
      candidate_driver_ids=CASE WHEN v_user=ANY(COALESCE(candidate_driver_ids,'{}'::uuid[]))
           THEN candidate_driver_ids ELSE array_append(COALESCE(candidate_driver_ids,'{}'::uuid[]),v_user) END,
      offered_driver_ids=CASE WHEN v_user=ANY(COALESCE(offered_driver_ids,'{}'::uuid[]))
           THEN offered_driver_ids ELSE array_append(COALESCE(offered_driver_ids,'{}'::uuid[]),v_user) END,
      request_expires_at=now()+interval '30 seconds',
      updated_at=now()
  WHERE id=r.id AND status='procurar_motorista' AND driver_id IS NULL;
  -- Reuse the authoritative acceptance RPC, incl. payment, active ride and PIN guards.
  v_result:=public.driver_accept_ride(_ride_id);
  RETURN jsonb_build_object('accepted',true,'ride_id',v_result->>'id');
END;
$apois$;

REVOKE ALL ON FUNCTION public.apois_list_available_ride_calls() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apois_claim_available_ride_call(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_list_available_ride_calls() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_claim_available_ride_call(uuid) TO authenticated;
