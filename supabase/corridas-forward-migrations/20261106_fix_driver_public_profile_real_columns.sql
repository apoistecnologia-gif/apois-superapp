-- APOIS Corridas — 06/11/2026 — correção canônica do perfil público.
-- Mantem exatamente a autorizacao vigente de perfil publico:
-- dono do perfil, staff autorizado, ou passageiro que tem corrida com motorista.
-- Substitui d.completed_rides inexistente
-- por contagem canonica de corridas finalizadas do motorista.
-- Nao altera dados, tarifas, acesso de anon nem marcadores financeiros.
CREATE OR REPLACE FUNCTION apois_rpc_private.get_driver_public_profile(_target_user_id uuid)
RETURNS TABLE (
  user_id uuid, name text, photo_url text, city text, state text,
  category text, vehicle_model text, vehicle_color text,
  vehicle_plate text, vehicle_year integer, average_rating numeric,
  total_ratings integer, completed_rides integer,
  approval_status text, is_online boolean, member_since timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING errcode='42501';
  END IF;
  SELECT u.id INTO v_actor_profile_id
    FROM public.users u
   WHERE u.auth_user_id=v_actor AND u.deleted_at IS NULL LIMIT 1;
  SELECT u.id INTO v_target_profile_id
    FROM public.users u
   WHERE u.deleted_at IS NULL
     AND (u.id=_target_user_id OR u.auth_user_id=_target_user_id)
   LIMIT 1;
  IF v_target_profile_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.user_id,d.name,d.photo_url,d.city,d.state,d.category,
         d.vehicle_model,d.vehicle_color,d.vehicle_plate,d.vehicle_year,
         d.rating AS average_rating,d.total_ratings,
         (SELECT count(*)::integer
            FROM public.rides completed
           WHERE completed.driver_id=d.id
             AND completed.status='finalizada') AS completed_rides,
         d.approval_status,d.is_online,d.created_at
    FROM public.drivers d
    JOIN public.users u ON u.id=d.user_id
   WHERE d.user_id=v_target_profile_id
     AND (
       u.auth_user_id=v_actor
       OR private.has_permission('users.manage')
       OR (
         d.approval_status='aprovado'
         AND v_actor_profile_id IS NOT NULL
         AND EXISTS(
           SELECT 1 FROM public.rides r
            WHERE r.passenger_id=v_actor_profile_id
              AND r.driver_id=d.id
              AND r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem','finalizada')
         )
       )
     )
   LIMIT 1;
END;
$function$;
-- Mantém autorização do dono, staff e passageiros vinculados; não permite consulta anônima.
