-- APOIS QA218: opt-in de presenca anonima e agregada de passageiros.
-- Nunca inferir consentimento so por sessao logada ou app instalado.
-- Nenhum motorista recebe identificadores, coordenadas exatas ou celulas <5.
CREATE TABLE IF NOT EXISTS public.apois_passenger_demand_presence (
 passenger_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 cell_lat numeric(6,2) NOT NULL CHECK (cell_lat BETWEEN -90 AND 90),
 cell_lng numeric(6,2) NOT NULL CHECK (cell_lng BETWEEN -180 AND 180),
 refreshed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apois_passenger_demand_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apois_passenger_demand_presence
  FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS apois_passenger_demand_presence_refresh_idx
 ON public.apois_passenger_demand_presence(refreshed_at,cell_lat,cell_lng);

CREATE OR REPLACE FUNCTION apois_rpc_private.apois_passenger_presence_ping_internal(
 _lat double precision, _lng double precision
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid := auth.uid(); v_profile uuid;
BEGIN
 SELECT u.id INTO v_profile FROM public.users u
 WHERE u.auth_user_id=v_actor AND u.deleted_at IS NULL
   AND u.blocked_at IS NULL AND u.suspended_at IS NULL LIMIT 1;
 IF v_actor IS NULL OR v_profile IS NULL THEN
   RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
 END IF;
 IF _lat IS NULL OR _lng IS NULL OR
   NOT (_lat BETWEEN -35 AND 6) OR NOT (_lng BETWEEN -74 AND -32) THEN
   RETURN false;
 END IF;
 INSERT INTO public.apois_passenger_demand_presence
   (passenger_id,cell_lat,cell_lng,refreshed_at)
 VALUES (v_profile,round(_lat::numeric,2),round(_lng::numeric,2),now())
 ON CONFLICT (passenger_id)
 DO UPDATE SET cell_lat=EXCLUDED.cell_lat,
               cell_lng=EXCLUDED.cell_lng,
               refreshed_at=EXCLUDED.refreshed_at;
 RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION apois_rpc_private.apois_passenger_presence_stop_internal()
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 DELETE FROM public.apois_passenger_demand_presence p
 WHERE p.passenger_id IN (
   SELECT u.id FROM public.users u WHERE u.auth_user_id=auth.uid()
 );
 RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION apois_rpc_private.apois_driver_passenger_hotspots_internal()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_lat double precision; v_lng double precision; v_zones jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
 SELECT d.current_lat::double precision,d.current_lng::double precision
 INTO v_lat,v_lng
 FROM public.drivers d JOIN public.users u ON u.id=d.user_id
 WHERE u.auth_user_id=auth.uid()
   AND u.deleted_at IS NULL AND u.blocked_at IS NULL AND u.suspended_at IS NULL
   AND d.approval_status='aprovado' AND d.is_online IS TRUE
   AND d.blocked_at IS NULL AND d.suspended_at IS NULL
   AND d.last_location_at>now()-interval '5 minutes'
   AND d.current_lat BETWEEN -35 AND 6 AND d.current_lng BETWEEN -74 AND -32
 LIMIT 1;
 IF v_lat IS NULL OR v_lng IS NULL THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
      'lat',z.lat,'lng',z.lng,'level',z.level
    ) ORDER BY z.total DESC),'[]'::jsonb)
 INTO v_zones
 FROM (
    SELECT p.cell_lat AS lat,p.cell_lng AS lng,
           count(DISTINCT p.passenger_id)::integer AS total,
           CASE WHEN count(DISTINCT p.passenger_id)>=15 THEN 'muito_alta'
                WHEN count(DISTINCT p.passenger_id)>=8 THEN 'alta'
                ELSE 'moderada' END AS level
    FROM public.apois_passenger_demand_presence p
    JOIN public.users u ON u.id=p.passenger_id
    WHERE p.refreshed_at>now()-interval '2 minutes'
      AND u.deleted_at IS NULL AND u.blocked_at IS NULL AND u.suspended_at IS NULL
      AND (
        power((p.cell_lat::double precision-v_lat)*111.0,2)
        +power((p.cell_lng::double precision-v_lng)*111.0 *
               greatest(0.2,abs(cos(radians(v_lat)))),2)
      )<=225.0
      AND NOT EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.passenger_id=p.passenger_id
          AND r.status IN ('procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem')
      )
    GROUP BY p.cell_lat,p.cell_lng
    HAVING count(DISTINCT p.passenger_id)>=5
    ORDER BY total DESC
    LIMIT 8
 ) z;
 RETURN v_zones;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.apois_passenger_presence_ping(
 _lat double precision,_lng double precision
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT apois_rpc_private.apois_passenger_presence_ping_internal($1,$2);
$fn$;

CREATE OR REPLACE FUNCTION public.apois_passenger_presence_stop()
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT apois_rpc_private.apois_passenger_presence_stop_internal();
$fn$;

CREATE OR REPLACE FUNCTION public.apois_driver_passenger_hotspots()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT apois_rpc_private.apois_driver_passenger_hotspots_internal();
$fn$;

REVOKE ALL ON FUNCTION apois_rpc_private.apois_passenger_presence_ping_internal(double precision,double precision) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION apois_rpc_private.apois_passenger_presence_stop_internal() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION apois_rpc_private.apois_driver_passenger_hotspots_internal() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apois_passenger_presence_ping(double precision,double precision) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apois_passenger_presence_stop() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apois_driver_passenger_hotspots() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION apois_rpc_private.apois_passenger_presence_ping_internal(double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION apois_rpc_private.apois_passenger_presence_stop_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION apois_rpc_private.apois_driver_passenger_hotspots_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_passenger_presence_ping(double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_passenger_presence_stop() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apois_driver_passenger_hotspots() TO authenticated;

-- Retencao curta; hotspot visivel por ate 2 min e linha removida automaticamente.
SELECT cron.schedule(
 'apois-qa218-purge-passenger-demand','*/15 * * * *',
 $$DELETE FROM public.apois_passenger_demand_presence
     WHERE refreshed_at<now()-interval '10 minutes'$$
);
