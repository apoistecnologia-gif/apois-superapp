create or replace function public.mobility_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.id
      from public.users u
      where u.auth_user_id = (select auth.uid())
        and u.deleted_at is null
      limit 1
    ),
    (
      select d.user_id
      from public.drivers d
      where d.user_id = (select auth.uid())
      limit 1
    )
  );
$$;

comment on function public.mobility_user_id() is
  'Resolve a identidade de mobilidade do usuário autenticado sem reentrar nas policies RLS de users/drivers.';
