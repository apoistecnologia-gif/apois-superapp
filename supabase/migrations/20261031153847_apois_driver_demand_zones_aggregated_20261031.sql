-- APOIS CORRIDAS: proposta de RPC para indicadores de demanda do motorista.
-- Migração autorizada em 31/10/2026 exclusivamente para demanda agregada.
-- Nunca revelar identidade, coordenada exata, ID de corrida ou posição de um passageiro.
-- As únicas posições retornadas são CENTROS FIXOS de células ~2,7 km com >= 3 pedidos.
-- Não usar como lista de corridas para aceitar; dispatch atual e expiracao permanecem intactos.

CREATE OR REPLACE FUNCTION public.apois_get_driver_demand_zones()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $apois$
DECLARE
  driver_lat double precision;
  driver_lng double precision;
  zones jsonb := '[]'::jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN '[]'::jsonb; END IF;

  -- Só o próprio motorista, aprovado, ativo, ONLINE e GPS recente.
  SELECT d.current_lat::double precision, d.current_lng::double precision
    INTO driver_lat,driver_lng
  FROM public.drivers d
  JOIN public.users u ON u.id=d.user_id
  WHERE u.auth_user_id=(SELECT auth.uid())
    AND u.deleted_at IS NULL AND u.blocked_at IS NULL AND u.suspended_at IS NULL
    AND d.approval_status='aprovado'
    AND d.is_online IS TRUE
    AND d.blocked_at IS NULL AND d.suspended_at IS NULL
    AND d.last_location_at > now()-interval '5 minutes'
    AND d.current_lat BETWEEN -90 AND 90
    AND d.current_lng BETWEEN -180 AND 180
  LIMIT 1;

  IF driver_lat IS NULL OR driver_lng IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'lat',c.cell_lat,'lng',c.cell_lng,
      'level',CASE WHEN c.total >= 10 THEN 'muito_alta'
                   WHEN c.total >= 6 THEN 'alta'
                   ELSE 'moderada' END
    ) ORDER BY c.total DESC), '[]'::jsonb)
  INTO zones
  FROM (
    SELECT
      (floor((r.origin_lat::double precision)/0.025)*0.025+0.0125)::numeric(9,5) AS cell_lat,
      (floor((r.origin_lng::double precision)/0.025)*0.025+0.0125)::numeric(9,5) AS cell_lng,
      count(DISTINCT r.id)::integer AS total
    FROM public.rides r
    WHERE r.created_at > now()-interval '30 minutes'
      AND r.status IN ('procurar_motorista','motorista_a_caminho','em_viagem','finalizada')
      AND r.cancelled_at IS NULL
      AND r.queued_after_ride_id IS NULL
      AND r.origin_lat BETWEEN -90 AND 90
      AND r.origin_lng BETWEEN -180 AND 180
      AND (
        power((r.origin_lat::double precision-driver_lat)*111.0,2)
        +power((r.origin_lng::double precision-driver_lng)*111.0
          *cos(radians(driver_lat)),2)
      ) <= 225.0
    GROUP BY 1,2
    HAVING count(DISTINCT r.id)>=3
    ORDER BY total DESC
    LIMIT 8
  ) c;

  RETURN zones;
END;
$apois$;

-- Única informação pública para o profissional autorizado: zonas agregadas.
-- Nenhuma interface concede SELECT direto à tabela rides.
REVOKE ALL ON FUNCTION public.apois_get_driver_demand_zones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apois_get_driver_demand_zones() TO authenticated;
