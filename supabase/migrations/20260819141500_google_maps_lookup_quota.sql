-- APOIS Superapp / Entregas
-- Rate limit autenticado para consultas de endereço executadas pela Edge Function.
-- Mantém o contrato já aplicado em produção: 120 consultas por minuto por usuário ativo.

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
begin
  if v_user_id is null or not public.current_user_is_active() then
    return false;
  end if;

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

revoke all on function public.consume_google_maps_lookup_quota() from public;
revoke all on function public.consume_google_maps_lookup_quota() from anon;
grant execute on function public.consume_google_maps_lookup_quota() to authenticated;
grant execute on function public.consume_google_maps_lookup_quota() to service_role;
