-- APOIS Corridas: leitura mínima do passageiro somente para motorista da corrida.
-- NÃO executado em produção durante a homologação dos APKs.
-- Não afrouxar as políticas existentes da tabela public.users.
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
  select u.name, u.phone, u.avatar_url, u.average_rating, u.total_ratings
  from public.rides r
  join public.drivers d on d.id = r.driver_id
  join public.users u on u.id = r.passenger_id
  where r.id = p_ride_id
    and d.user_id = auth.uid()
    and r.status in ('motorista_a_caminho', 'motorista_chegou', 'em_viagem')
  limit 1
$$;
revoke all on function public.apois_driver_assigned_passenger(uuid) from public, anon;
grant execute on function public.apois_driver_assigned_passenger(uuid) to authenticated;
comment on function public.apois_driver_assigned_passenger(uuid) is
  'Exibe os dados mínimos do passageiro somente ao motorista autenticado designado à corrida ativa.';
