-- APOIS QA218: motoristas próximos, sem acesso direto a public.drivers.
-- Implementação em produção autorizada em 12/11/2026.
-- Backend privado SECURITY DEFINER; API pública SECURITY INVOKER.
CREATE OR REPLACE FUNCTION apois_rpc_private.apois_nearby_driver_presence_internal(
  _lat double precision,
  _lng double precision,
  _category text DEFAULT NULL
) RETURNS TABLE(lat numeric, lng numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_category text;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = v_actor
      AND u.deleted_at IS NULL
      AND u.blocked_at IS NULL
      AND u.suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF _lat IS NULL OR _lng IS NULL OR
     NOT (_lat BETWEEN -90 AND 90) OR
     NOT (_lng BETWEEN -180 AND 180) THEN
    RETURN;
  END IF;

  v_category := CASE lower(trim(_category))
    WHEN 'carro' THEN 'carros'
    WHEN 'moto' THEN 'motos'
    WHEN '' THEN NULL
    ELSE lower(trim(_category))
  END;
  IF v_category IS NOT NULL AND v_category NOT IN
    ('carros', 'motos', 'fretes', 'guincho', 'envios') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    round(d.current_lat, 3) AS lat,
    round(d.current_lng, 3) AS lng
  FROM public.drivers d
  WHERE d.is_online IS TRUE
    AND d.approval_status = 'aprovado'
    AND d.blocked_at IS NULL
    AND d.suspended_at IS NULL
    AND d.current_lat BETWEEN -90 AND 90
    AND d.current_lng BETWEEN -180 AND 180
    AND d.last_location_at >= now() - interval '2 minutes'
    AND (v_category IS NULL OR d.category = v_category)
    AND abs(d.current_lat - _lat) <= 0.05
    AND abs(d.current_lng - _lng) <= 0.06
    AND (
      power((d.current_lat - _lat)::double precision * 111320.0, 2) +
      power((d.current_lng - _lng)::double precision *
        111320.0 * greatest(0.2, abs(cos(radians(_lat)))), 2)
    ) <= power(5000.0, 2)
    AND NOT EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.driver_id = d.id
        AND r.status IN ('motorista_a_caminho', 'motorista_chegou', 'em_viagem')
    )
  ORDER BY 1, 2
  LIMIT 12;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.apois_nearby_driver_presence(
  _lat double precision,
  _lng double precision,
  _category text DEFAULT NULL
) RETURNS TABLE(lat numeric, lng numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $fn$
  SELECT p.lat, p.lng
  FROM apois_rpc_private.apois_nearby_driver_presence_internal($1,$2,$3) p;
$fn$;

REVOKE ALL ON FUNCTION apois_rpc_private.apois_nearby_driver_presence_internal(double precision,double precision,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION apois_rpc_private.apois_nearby_driver_presence_internal(double precision,double precision,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text)
  TO authenticated;

COMMENT ON FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text)
IS 'APOIS QA218: apenas pontos aproximados de motoristas disponíveis, com conta autenticada, sem IDs e sem acesso direto à tabela drivers.';
-- Rollback controlado:
-- DROP FUNCTION public.apois_nearby_driver_presence(double precision,double precision,text);
-- DROP FUNCTION apois_rpc_private.apois_nearby_driver_presence_internal(double precision,double precision,text);
