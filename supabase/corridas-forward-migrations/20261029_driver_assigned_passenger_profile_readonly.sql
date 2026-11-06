-- APOIS Corridas: leitura minima do passageiro para motorista elegivel.
-- MIGRACAO PREPARADA, NAO APLICADA EM PRODUCAO durante homologacao.
-- public.drivers.user_id guarda public.users.id, NAO auth.users.id.
-- Usar public.mobility_user_id() para resolver a identidade de dominio.
-- Nao amplia SELECT de public.users nem permite pesquisa arbitraria de clientes.
create or replace function public.apois_driver_assigned_passenger(p_ride_id uuid)
returns table (
  name text,
  phone text,
  avatar_url text,
  average_rating numeric,
  total_ratings integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.name,
    case when r.driver_id = d.id then u.phone else null end as phone,
    u.avatar_url,
    u.average_rating,
    u.total_ratings
  from public.rides r
  join public.drivers d on d.user_id = public.mobility_user_id()
  join public.users u on u.id = r.passenger_id
  where p_ride_id is not null
    and auth.uid() is not null
    and r.id = p_ride_id
    and (
      (
        r.driver_id = d.id
        and r.status in ('motorista_a_caminho', 'motorista_chegou', 'em_viagem', 'finalizada')
      )
      or (
        r.status = 'procurar_motorista'
        and r.driver_id is null
        and d.user_id = any(coalesce(r.offered_driver_ids, '{}'::uuid[]))
      )
    )
  limit 1
$$;
revoke all on function public.apois_driver_assigned_passenger(uuid) from public, anon;
grant execute on function public.apois_driver_assigned_passenger(uuid) to authenticated;
comment on function public.apois_driver_assigned_passenger(uuid) is
  'Somente motorista designado ou com oferta valida recebe perfil minimo do passageiro; telefone apenas apos aceite.';
