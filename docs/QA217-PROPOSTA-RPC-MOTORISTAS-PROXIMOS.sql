-- APOIS_PASSENGER_QA217_NEARBY_RPC_V1
-- PROPOSTA PARA REVISAO/DEPLOY CONTROLADO; NAO EXECUTAR AUTOMATICAMENTE.
-- No privileged driver table SELECT grant and no raw driver identifiers.
-- Approximate dots only, restricted to approved/online/recent and idle drivers.
-- This RPC MUST be security-reviewed before deployment. A missing RPC means
-- the client shows "indisponível" instead of fabricated driver markers.
CREATE OR REPLACE FUNCTION public.apois_nearby_driver_presence(
  _lat double precision,
  _lng double precision,
  _category text DEFAULT NULL
)
RETURNS TABLE(lat numeric, lng numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $body$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
  END IF;
  IF NOT isfinite(_lat) OR NOT isfinite(_lng) OR
     _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RETURN;
  END IF;
  IF _category IS NOT NULL AND _category NOT IN
    ('carros', 'motos', 'fretes', 'guincho', 'envios') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT round(d.current_lat, 3) AS lat,
                  round(d.current_lng, 3) AS lng
    FROM public.drivers d
   WHERE d.is_online IS TRUE
     AND d.approval_status = 'aprovado'
     AND d.blocked_at IS NULL
     AND d.suspended_at IS NULL
     AND d.current_lat BETWEEN -90 AND 90
     AND d.current_lng BETWEEN -180 AND 180
     AND d.last_location_at > now() - interval '2 minutes'
     AND (_category IS NULL OR d.category = _category)
     AND abs(d.current_lat - _lat) < 0.05
     AND abs(d.current_lng - _lng) < 0.06
     AND (
       power((d.current_lat - _lat)::double precision * 111320.0, 2) +
       power((d.current_lng - _lng)::double precision *
             111320.0 * greatest(0.2, abs(cos(radians(_lat)))), 2)
     ) <= power(5000.0, 2)
     AND NOT EXISTS (
       SELECT 1 FROM public.rides r
        WHERE r.driver_id = d.id
          AND r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')
     )
   ORDER BY lat, lng
   LIMIT 12;
END;
$body$;
REVOKE ALL ON FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text)
  TO authenticated;
-- ROLLBACK:
-- DROP FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text);
