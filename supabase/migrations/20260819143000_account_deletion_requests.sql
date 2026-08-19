-- APOIS Superapp / Entregas
-- Google Play exige caminho de solicitação de exclusão para apps que criam contas.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','cancelled','rejected')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  resolution_note text
);

create unique index if not exists account_deletion_requests_one_open_per_user
  on public.account_deletion_requests(user_id)
  where status in ('pending','processing');

create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests(status, requested_at);

alter table public.account_deletion_requests enable row level security;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.account_deletion_requests from public, anon;
grant select on table public.account_deletion_requests to authenticated;
grant all on table public.account_deletion_requests to service_role;

create or replace function public.request_own_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if public.current_user_is_admin() then
    raise exception 'administrator account cannot be self-deleted';
  end if;

  select r.id into v_request_id
  from public.account_deletion_requests r
  where r.user_id = v_user_id
    and r.status in ('pending','processing')
  order by r.requested_at desc
  limit 1;

  if v_request_id is null then
    insert into public.account_deletion_requests(user_id)
    values(v_user_id)
    returning id into v_request_id;
  end if;

  delete from public.push_devices where user_id = v_user_id;
  return v_request_id;
end;
$function$;

revoke all on function public.request_own_account_deletion() from public, anon;
grant execute on function public.request_own_account_deletion() to authenticated, service_role;
