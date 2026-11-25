-- Experimental Passenger contract. Load only into the disposable navigation database.
-- The trusted caller computes pricing with the existing request-ride flow.
create function apois_nav_lab.create_passenger_ride(
  p_auth_user uuid, p_selection uuid, p_request_key uuid, p_payload jsonb
) returns public.rides
language plpgsql security invoker set search_path = '' as $route$
declare
  v_passenger uuid;
  v_linked uuid;
  v_points jsonb;
  v_input public.rides;
  v_ride public.rides;
begin
  select u.id, s.ride_id into v_passenger, v_linked
    from public.users u
    join apois_nav_lab.selection s on s.passenger_id=u.id
    where u.auth_user_id=p_auth_user and s.id=p_selection and s.request_key=p_request_key
      and u.deleted_at is null and u.blocked_at is null
      and (u.suspended_until is null or u.suspended_until<=clock_timestamp())
    for share of u for update of s;
  if not found then return null; end if;
  if v_linked is not null then
    select * into strict v_ride from public.rides
      where id=v_linked and passenger_id=v_passenger and request_key=p_request_key;
    return v_ride;
  end if;

  v_input := jsonb_populate_record(null::public.rides, p_payload);
  if v_input.passenger_id is distinct from v_passenger or
     v_input.request_key is distinct from p_request_key or
     v_input.category is distinct from 'carros' or
     v_input.status::text is distinct from 'procurar_motorista' or
     v_input.scheduled_for is not null or
     v_input.intermediates is distinct from '[]'::jsonb then
    raise exception 'unsupported experimental ride payload';
  end if;

  v_points := apois_nav_lab.prepare_selection(p_auth_user,p_selection,p_request_key);
  if v_points is null then return null; end if;
  -- The existing fare was calculated for these coordinates. Refuse mismatches.
  if (v_input.origin_lat::double precision,v_input.origin_lng::double precision,
      v_input.destination_lat::double precision,v_input.destination_lng::double precision)
    is distinct from ((v_points->'origin'->>'lat')::double precision,
                      (v_points->'origin'->>'lng')::double precision,
                      (v_points->'destination'->>'lat')::double precision,
                      (v_points->'destination'->>'lng')::double precision) then
    raise exception 'confirmed points differ from fare inputs';
  end if;

  insert into public.rides (
    passenger_id,request_key,category,status,scheduled_for,
    origin_lat,origin_lng,origin_name,destination_lat,destination_lng,destination_name,
    distance_km,duration_min,estimated_price,payment_method,service_details,
    pickup_label,pickup_short_label,pickup_address,pickup_place_id,pickup_source,
    search_expires_at,intermediates
  ) values (
    v_passenger,p_request_key,v_input.category,v_input.status,v_input.scheduled_for,
    v_input.origin_lat,v_input.origin_lng,v_input.origin_name,
    v_input.destination_lat,v_input.destination_lng,v_input.destination_name,
    v_input.distance_km,v_input.duration_min,v_input.estimated_price,
    v_input.payment_method,v_input.service_details,v_input.pickup_label,
    v_input.pickup_short_label,v_input.pickup_address,v_input.pickup_place_id,
    v_input.pickup_source,v_input.search_expires_at,v_input.intermediates
  ) returning * into v_ride;
  if not apois_nav_lab.bind_selection(p_auth_user,p_selection,v_ride.id) then
    raise exception 'experimental ride could not be bound';
  end if;
  return v_ride;
end $route$;

revoke all on function apois_nav_lab.create_passenger_ride(uuid,uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function apois_nav_lab.create_passenger_ride(uuid,uuid,uuid,jsonb)
  to service_role;
