-- Forward-only identity/RLS correction for APOIS Corridas.
-- AUTH ID: auth.uid() = auth.users.id = public.users.auth_user_id
-- DOMAIN USER ID: public.users.id
-- Do not rewrite historical migrations and do not collapse the two identifiers.

begin;

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.passenger_wallets enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

-- handle_new_user() terminal code uses ON CONFLICT(auth_user_id). Make the
-- one-to-one relationship explicit without changing public.users.id.
do $sanity$
declare
  duplicate_auth_id uuid;
begin
  select u.auth_user_id
    into duplicate_auth_id
  from public.users u
  where u.auth_user_id is not null
  group by u.auth_user_id
  having count(*) > 1
  limit 1;

  if duplicate_auth_id is not null then
    raise exception 'identity migration blocked: duplicate users.auth_user_id %', duplicate_auth_id;
  end if;
end
$sanity$;

create unique index if not exists users_auth_user_id_unique
  on public.users(auth_user_id);

create or replace function public.current_user_has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where u.auth_user_id = auth.uid()
      and ur.role = _role
  );
$$;

revoke all on function public.current_user_has_role(public.app_role) from public, anon;
grant execute on function public.current_user_has_role(public.app_role) to authenticated, service_role;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

revoke update on public.users from authenticated;
grant update (name, phone, avatar_url, city) on public.users to authenticated;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = user_roles.user_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "passenger_wallets_select_own" on public.passenger_wallets;
create policy "passenger_wallets_select_own"
  on public.passenger_wallets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = passenger_wallets.passenger_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "drivers_select_own" on public.drivers;
create policy "drivers_select_own"
  on public.drivers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = drivers.user_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "drivers_update_own" on public.drivers;
create policy "drivers_update_own"
  on public.drivers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = drivers.user_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = drivers.user_id
        and u.auth_user_id = auth.uid()
    )
  );

revoke update on public.drivers from authenticated;
grant update (is_online, current_lat, current_lng, last_location_at) on public.drivers to authenticated;

drop policy if exists "rides_select_passenger" on public.rides;
create policy "rides_select_passenger"
  on public.rides
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = rides.passenger_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "rides_select_driver" on public.rides;
create policy "rides_select_driver"
  on public.rides
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      join public.users u on u.id = d.user_id
      where d.id = rides.driver_id
        and u.auth_user_id = auth.uid()
    )
    or (
      rides.status = 'procurar_motorista'
      and public.current_user_has_role('driver'::public.app_role)
    )
  );

do $optional_policies$
begin
  if to_regclass('public.subscriptions') is not null then
    execute 'drop policy if exists "subs_select_own" on public.subscriptions';
    execute $policy$
      create policy "subs_select_own"
        on public.subscriptions
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.drivers d
            join public.users u on u.id = d.user_id
            where d.id = subscriptions.driver_id
              and u.auth_user_id = auth.uid()
          )
        )
    $policy$;
  end if;

  if to_regclass('public.driver_withdrawals') is not null then
    execute 'drop policy if exists "withdrawals_select_own" on public.driver_withdrawals';
    execute $policy$
      create policy "withdrawals_select_own"
        on public.driver_withdrawals
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.drivers d
            join public.users u on u.id = d.user_id
            where d.id = driver_withdrawals.driver_id
              and u.auth_user_id = auth.uid()
          )
        )
    $policy$;
  end if;

  if to_regclass('public.account_deletion_requests') is not null then
    execute 'drop policy if exists "deletion_own" on public.account_deletion_requests';
    execute $policy$
      create policy "deletion_own"
        on public.account_deletion_requests
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.users u
            where u.id = account_deletion_requests.user_id
              and u.auth_user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end
$optional_policies$;

do $verify$
declare
  n integer;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'users_select_own',
      'users_update_own',
      'user_roles_select_own',
      'passenger_wallets_select_own',
      'drivers_select_own',
      'drivers_update_own',
      'rides_select_passenger',
      'rides_select_driver'
    );
  if n <> 8 then
    raise exception 'identity migration incomplete: expected 8 core policies, found %', n;
  end if;

  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_roles', 'DELETE') then
    raise exception 'identity migration unsafe: authenticated can mutate user_roles';
  end if;

  if has_column_privilege('authenticated', 'public.users', 'id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.users', 'auth_user_id', 'UPDATE') then
    raise exception 'identity migration unsafe: authenticated can mutate user identity columns';
  end if;

  if has_column_privilege('authenticated', 'public.drivers', 'user_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.drivers', 'approval_status', 'UPDATE') then
    raise exception 'identity migration unsafe: authenticated can mutate driver ownership/admin columns';
  end if;
end
$verify$;

commit;
