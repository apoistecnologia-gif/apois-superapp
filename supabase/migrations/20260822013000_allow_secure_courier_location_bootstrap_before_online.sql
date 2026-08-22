create or replace function public.bootstrap_courier_location(
  _latitude numeric,
  _longitude numeric,
  _accuracy_meters numeric default null,
  _heading numeric default null,
  _speed_mps numeric default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_courier_id uuid;
begin
  if not public.current_user_is_active() then
    raise exception 'active account required';
  end if;

  select c.id
  into v_courier_id
  from public.couriers c
  where c.user_id = (select auth.uid())
    and c.status = 'approved'
    and c.is_active = true;

  if v_courier_id is null then
    raise exception 'eligible courier required';
  end if;

  if _latitude not between -90 and 90 or _longitude not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;

  if _accuracy_meters is null
     or _accuracy_meters < 0
     or _accuracy_meters > private.courier_max_location_accuracy_meters() then
    raise exception 'fresh accurate courier location required';
  end if;

  insert into public.courier_locations(
    courier_id,
    latitude,
    longitude,
    accuracy_meters,
    heading,
    speed_mps,
    recorded_at
  ) values (
    v_courier_id,
    _latitude,
    _longitude,
    _accuracy_meters,
    _heading,
    _speed_mps,
    now()
  )
  on conflict(courier_id) do update
  set latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_meters = excluded.accuracy_meters,
      heading = excluded.heading,
      speed_mps = excluded.speed_mps,
      recorded_at = now();
end;
$function$;

revoke all on function public.bootstrap_courier_location(numeric,numeric,numeric,numeric,numeric) from public;
revoke all on function public.bootstrap_courier_location(numeric,numeric,numeric,numeric,numeric) from anon;
grant execute on function public.bootstrap_courier_location(numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.bootstrap_courier_location(numeric,numeric,numeric,numeric,numeric) to service_role;
