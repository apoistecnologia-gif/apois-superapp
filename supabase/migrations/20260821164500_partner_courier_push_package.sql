-- APOIS Parceiro: registro FCM do Entregador com package explícito.
-- Mantém register_courier_push_device legado intacto para o APK Entregador separado.

create or replace function public.register_courier_push_device_v2(
  _token text,
  _platform text default 'android',
  _app_package text default 'br.com.apois.parceiro'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := nullif(btrim(coalesce(_token,'')), '');
  v_package text := nullif(btrim(coalesce(_app_package,'')), '');
  v_device_id uuid;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not public.current_user_is_active() then raise exception 'active account required'; end if;
  if _platform <> 'android' then raise exception 'unsupported courier push platform'; end if;
  if v_package not in ('br.com.apois.entregador','br.com.apois.parceiro') then
    raise exception 'unsupported courier app package';
  end if;
  if v_token is null or length(v_token) < 20 or length(v_token) > 4096 then
    raise exception 'invalid push token';
  end if;
  if not exists (
    select 1 from public.couriers c
    where c.user_id = v_uid and c.status = 'approved' and c.is_active = true
  ) then
    raise exception 'approved active courier required';
  end if;

  insert into public.push_devices(
    user_id, platform, token, app_product, app_package, is_active, last_seen_at, updated_at
  ) values (
    v_uid, 'android', v_token, 'courier', v_package, true, now(), now()
  )
  on conflict(token) do update
  set user_id = excluded.user_id,
      platform = 'android',
      app_product = 'courier',
      app_package = excluded.app_package,
      is_active = true,
      last_seen_at = now(),
      updated_at = now()
  returning id into v_device_id;

  delete from public.push_devices d
  where d.user_id = v_uid
    and d.platform = 'android'
    and d.app_product = 'courier'
    and d.id <> v_device_id;

  return v_device_id;
end;
$$;

revoke all on function public.register_courier_push_device_v2(text,text,text) from public, anon;
grant execute on function public.register_courier_push_device_v2(text,text,text) to authenticated;
