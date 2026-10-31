-- APOIS ENTREGAS — Central de entregas não atendidas; endpoints QA autenticados.
-- Somente pedidos PRONTOS, não cancelados, ainda na janela de busca.
-- Nenhum endereço exato/cliente antes da aceitação; a RPC oficial decide a atribuição.
CREATE OR REPLACE FUNCTION public.apois_list_available_delivery_calls()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $apois$
DECLARE
  v_courier public.couriers;
  v_loc public.courier_locations;
  v_result jsonb;
BEGIN
  IF NOT public.current_user_is_active() THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO v_courier FROM public.couriers c
    WHERE c.user_id=(SELECT auth.uid()) AND c.status='approved' AND c.is_active=true LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courier_availability a
      WHERE a.courier_id=v_courier.id AND a.is_online=true
        AND a.last_seen_at > now()-interval '30 minutes')
  THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO v_loc FROM public.courier_locations
    WHERE courier_id=v_courier.id AND recorded_at > now()-interval '30 minutes'
      AND accuracy_meters BETWEEN 0 AND private.courier_max_location_accuracy_meters();
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM public.delivery_jobs j
    WHERE j.courier_id=v_courier.id
      AND j.status IN ('accepted','arriving_pickup','at_pickup','picked_up','on_the_way','arrived_destination'))
  THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',j.id,'category','entregas','area',coalesce(m.neighborhood,m.city,'Região próxima'),
    'pickup_distance_km',round(public.haversine_km(v_loc.latitude,v_loc.longitude,j.pickup_latitude,j.pickup_longitude)::numeric,1),
    'estimated_amount',j.estimated_earnings,
    'remaining_seconds',greatest(0,extract(epoch from (j.search_started_at+private.courier_search_timeout_interval()-now()))::integer)
  ) ORDER BY public.haversine_km(v_loc.latitude,v_loc.longitude,j.pickup_latitude,j.pickup_longitude)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT job.*
    FROM public.delivery_jobs job
    WHERE job.status IN ('searching','offered') AND job.courier_id IS NULL
      AND job.search_started_at IS NOT NULL
      AND job.search_started_at+private.courier_search_timeout_interval()>now()
      AND job.pickup_latitude BETWEEN -90 AND 90 AND job.pickup_longitude BETWEEN -180 AND 180
      AND NOT EXISTS (SELECT 1 FROM public.delivery_offers off
        WHERE off.delivery_job_id=job.id AND off.status='offered' AND off.expires_at>now())
      AND NOT EXISTS (SELECT 1 FROM public.delivery_offers prior
        WHERE prior.delivery_job_id=job.id AND prior.courier_id=v_courier.id
          AND prior.status IN ('rejected','expired','cancelled')
          AND prior.offered_at>=job.search_started_at)
    ORDER BY job.created_at ASC LIMIT 30
  ) j
  JOIN public.orders o ON o.id=j.order_id AND o.status='ready'
  JOIN public.merchants m ON m.id=j.merchant_id AND m.is_active=true AND m.approval_status='approved'
  JOIN public.cities city ON city.id=m.city_id AND city.is_active=true
  WHERE public.haversine_km(v_loc.latitude,v_loc.longitude,j.pickup_latitude,j.pickup_longitude)
          <=city.courier_dispatch_radius_km;
  RETURN coalesce(v_result,'[]'::jsonb);
END;
$apois$;

CREATE OR REPLACE FUNCTION public.apois_claim_available_delivery_call(_job_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $apois$
DECLARE
 v_courier public.couriers;
 v_loc public.courier_locations;
 v_job public.delivery_jobs;
 v_offer_id uuid;
BEGIN
  IF NOT public.current_user_is_active() THEN RAISE EXCEPTION 'active_account_required'; END IF;
  SELECT * INTO v_courier FROM public.couriers c
    WHERE c.user_id=(SELECT auth.uid()) AND c.status='approved' AND c.is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'eligible_courier_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courier_availability a
    WHERE a.courier_id=v_courier.id AND a.is_online=true
      AND a.last_seen_at > now()-interval '30 minutes')
  THEN RAISE EXCEPTION 'courier_offline'; END IF;
  SELECT * INTO v_loc FROM public.courier_locations l
    WHERE l.courier_id=v_courier.id AND l.recorded_at>now()-interval '30 minutes'
      AND l.accuracy_meters BETWEEN 0 AND private.courier_max_location_accuracy_meters();
  IF NOT FOUND THEN RAISE EXCEPTION 'courier_gps_unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_jobs active
    WHERE active.courier_id=v_courier.id
      AND active.status IN ('accepted','arriving_pickup','at_pickup','picked_up','on_the_way','arrived_destination'))
  THEN RAISE EXCEPTION 'courier_busy'; END IF;

  SELECT * INTO v_job FROM public.delivery_jobs j WHERE j.id=_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status NOT IN ('searching','offered')
    OR v_job.courier_id IS NOT NULL OR v_job.search_started_at IS NULL
    OR v_job.search_started_at+private.courier_search_timeout_interval()<=now()
    OR v_job.pickup_latitude IS NULL OR v_job.pickup_longitude IS NULL
  THEN RAISE EXCEPTION 'delivery_call_unavailable'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.orders o
    JOIN public.merchants m ON m.id=v_job.merchant_id
    JOIN public.cities c ON c.id=m.city_id
    WHERE o.id=v_job.order_id AND o.status='ready'
      AND m.is_active=true AND m.approval_status='approved'
      AND c.is_active=true
      AND public.haversine_km(v_loc.latitude,v_loc.longitude,v_job.pickup_latitude,v_job.pickup_longitude)
         <= c.courier_dispatch_radius_km
  ) THEN RAISE EXCEPTION 'delivery_call_ineligible'; END IF;
  IF EXISTS(SELECT 1 FROM public.delivery_offers off WHERE off.delivery_job_id=v_job.id
      AND off.status='offered' AND off.expires_at>now())
  THEN RAISE EXCEPTION 'call_currently_offered'; END IF;
  IF EXISTS(SELECT 1 FROM public.delivery_offers prior
    WHERE prior.delivery_job_id=v_job.id AND prior.courier_id=v_courier.id
      AND prior.status IN ('rejected','expired','cancelled')
      AND prior.offered_at>=v_job.search_started_at)
  THEN RAISE EXCEPTION 'call_previously_offered'; END IF;

  INSERT INTO public.delivery_offers(delivery_job_id,courier_id,status,offered_at,expires_at)
    VALUES(v_job.id,v_courier.id,'offered',now(),now()+interval '30 seconds')
    ON CONFLICT(delivery_job_id,courier_id) DO UPDATE
      SET status='offered', offered_at=excluded.offered_at,
          expires_at=excluded.expires_at, responded_at=null
    RETURNING id INTO v_offer_id;
  UPDATE public.delivery_jobs SET status='offered' WHERE id=v_job.id AND status='searching';
  -- Existing RPC locks offer and job; only one courier wins, updates order + history.
  RETURN public.accept_delivery_offer(v_offer_id);
END;
$apois$;

REVOKE ALL ON FUNCTION public.apois_list_available_delivery_calls() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apois_claim_available_delivery_call(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_list_available_delivery_calls() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_claim_available_delivery_call(uuid) TO authenticated;
