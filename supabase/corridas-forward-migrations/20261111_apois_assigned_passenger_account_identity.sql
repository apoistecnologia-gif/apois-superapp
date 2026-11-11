-- APOIS Corridas — authorized driver-only read of their assigned passenger.
-- 2026-11-11: actual production drivers.user_id references public.users.id,
-- not auth.users.id. public.mobility_user_id() maps the authenticated identity.
-- Safe additive function. No changes to public.users RLS, payments or ride writes.
CREATE OR REPLACE FUNCTION public.apois_driver_assigned_passenger(p_ride_id uuid)
RETURNS TABLE (
  name text,
  phone text,
  avatar_url text,
  average_rating numeric,
  total_ratings integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT u.name, u.phone, u.avatar_url, u.average_rating, u.total_ratings
  FROM public.rides AS r
  INNER JOIN public.drivers AS d
    ON d.id = COALESCE(r.accepted_driver_id, r.driver_id)
  INNER JOIN public.users AS u
    ON u.id = r.passenger_id
  WHERE r.id = p_ride_id
    AND p_ride_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND d.user_id = (SELECT public.mobility_user_id())
    AND r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')
    AND u.deleted_at IS NULL
  LIMIT 1
$fn$;

REVOKE ALL ON FUNCTION public.apois_driver_assigned_passenger(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_assigned_passenger(uuid) TO authenticated;

COMMENT ON FUNCTION public.apois_driver_assigned_passenger(uuid) IS
  'Somente o motorista autenticado atribuido a esta corrida ativa pode ler os dados minimos do passageiro.';
