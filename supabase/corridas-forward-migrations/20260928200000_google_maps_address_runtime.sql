-- APOIS Corridas / Google Maps address runtime
-- Authenticated quota for autocomplete/reverse geocoding used by the Superapp customer APK.

create table if not exists public.api_rate_limits (
  user_id uuid not null,
  scope text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, window_started_at)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_google_maps_lookup_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
  v_active boolean;
begin
  if v_user_id is null then return false; end if;

  select coalesce(p.active, false)
    into v_active
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if coalesce(v_active, false) is not true then return false; end if;

  insert into public.api_rate_limits(user_id, scope, window_started_at, request_count, updated_at)
  values(v_user_id, 'google_maps_lookup', v_window, 1, now())
  on conflict(user_id, scope, window_started_at) do update
    set request_count = public.api_rate_limits.request_count + 1,
        updated_at = now()
    where public.api_rate_limits.request_count < 120
  returning request_count into v_count;

  delete from public.api_rate_limits
  where user_id = v_user_id
    and scope = 'google_maps_lookup'
    and window_started_at < now() - interval '1 day';

  return v_count is not null and v_count <= 120;
end;
$function$;

revoke all on function public.consume_google_maps_lookup_quota() from public, anon;
grant execute on function public.consume_google_maps_lookup_quota() to authenticated, service_role;
