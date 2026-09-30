-- Corridas: compatibilidade de identidade para motoristas migrados.
-- A identidade canônica continua sendo public.users.id quando existe.
-- Somente quando esse vínculo estiver ausente e houver um driver legado cujo
-- drivers.user_id já é o próprio auth.uid(), usamos auth.uid() como fallback.
-- Isso corrige RPCs como driver_get_profile/driver_set_presence sem ampliar
-- o fallback para passageiros ou usuários sem registro em drivers.

create or replace function public.mobility_user_id()
returns uuid
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.deleted_at is null
      limit 1
    ),
    (
      select d.user_id
      from public.drivers d
      where d.user_id = auth.uid()
      limit 1
    )
  );
$function$;
