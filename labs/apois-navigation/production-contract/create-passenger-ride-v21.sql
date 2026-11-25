-- Fixture extension; never execute on production.
alter table apois_nav_lab.selection add column sealed_at timestamptz;
-- Experimental v21 insertion boundary. NOT a migration. Cash-only pilot,
-- never changes original request-ride, payment gates or dispatch functions.
create function apois_nav_lab.create_passenger_ride_v21(
 p_auth_user uuid,p_selection uuid,p_request_key uuid,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_passenger uuid; v_linked uuid; v_points jsonb; v_ride public.rides;
 v_price numeric; v_distance numeric; v_duration numeric;
begin
 if p_auth_user is null or p_selection is null or p_request_key is null then return null; end if;
 select id into v_passenger from public.users where auth_user_id=p_auth_user;
 if not found then return null; end if;
 -- Same financial advisory lock as the observed production INSERT trigger.
 perform public.apois_lock_passenger_ride_financial_gate(v_passenger);
 select u.id,s.ride_id into v_passenger,v_linked
 from public.users u join apois_nav_lab.selection s on s.passenger_id=u.id
 where u.auth_user_id=p_auth_user and s.id=p_selection and s.request_key=p_request_key and s.sealed_at is null
 and u.blocked_at is null and u.deleted_at is null
 and (u.suspended_until is null or u.suspended_until<=clock_timestamp())
 and (u.suspended_at is null or u.suspended_until<=clock_timestamp())
 for no key update of u for update of s;
 if not found then return null; end if;
 if v_linked is not null then
   select * into strict v_ride from public.rides where id=v_linked and passenger_id=v_passenger and request_key=p_request_key;
   return jsonb_build_object('rideId',v_ride.id,'status',v_ride.status,'estimated_price',v_ride.estimated_price,'fare_amount_cents',v_ride.fare_amount_cents,'payment_status',v_ride.payment_status,'reused',true);
 end if;
 -- Trusted server-calculated metrics and fare only, no client RPC access.
 if jsonb_typeof(p_payload) is distinct from 'object'
 or (p_payload - array['origin','destination','estimated_price','distance_km','duration_min','payment_method','category','intermediates','expected_price_cents']) <> '{}'::jsonb
 or p_payload->>'payment_method' is distinct from 'cash'
 or p_payload->>'category' is distinct from 'carros'
 or p_payload->'intermediates' is distinct from '[]'::jsonb
 or jsonb_typeof(p_payload->'estimated_price') is distinct from 'number'
 or jsonb_typeof(p_payload->'distance_km') is distinct from 'number'
 or jsonb_typeof(p_payload->'duration_min') is distinct from 'number'
 or jsonb_typeof(p_payload->'expected_price_cents') is distinct from 'number' then
   raise exception 'unsupported_v21_experimental_payload';
 end if;
 v_price:=(p_payload->>'estimated_price')::numeric;
 v_distance:=(p_payload->>'distance_km')::numeric;
 v_duration:=(p_payload->>'duration_min')::numeric;
 if v_price<=0 or v_price<>round(v_price,2) or v_distance<=0 or v_distance<>round(v_distance,2)
 or v_duration<1 or v_duration<>trunc(v_duration) or (p_payload->>'expected_price_cents')::numeric<>v_price*100 then
   raise exception 'invalid_v21_authoritative_metrics';
 end if;
 if exists(select 1 from public.rides where passenger_id=v_passenger and status in
 ('agendada','aguardando_pagamento','procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem')) then return null; end if;
 v_points:=apois_nav_lab.prepare_selection(p_auth_user,p_selection,p_request_key);
 if v_points is null then return null; end if;
 if p_payload->'origin' is distinct from ((v_points->'origin')-'label')
 or p_payload->'destination' is distinct from ((v_points->'destination')-'label') then
   raise exception 'confirmed_points_differ_from_fare_inputs';
 end if;
 insert into public.rides(passenger_id,category,status,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,origin_name,destination_name,
 estimated_price,fare_amount_cents,distance_km,duration_min,payment_method,payment_status,payment_provider,provider_payment_id,service_details,
 intermediates,request_key,pickup_label,pickup_short_label,pickup_address,pickup_place_id,pickup_source,search_expires_at,created_at)
 values(v_passenger,'carros','procurar_motorista',p_payload->'origin',p_payload->'destination',
 (v_points->'origin'->>'lat')::numeric,(v_points->'origin'->>'lng')::numeric,(v_points->'destination'->>'lat')::numeric,(v_points->'destination'->>'lng')::numeric,
 v_points->'origin'->>'label',v_points->'destination'->>'label',v_price,round(v_price*100)::bigint,v_distance,v_duration,'cash','pending',null,null,'{}',
 '[]',p_request_key,v_points->'origin'->>'label',null,null,null,'osm_lab',clock_timestamp()+interval '180 seconds',clock_timestamp())
 returning * into v_ride;
 if not apois_nav_lab.bind_selection(p_auth_user,p_selection,v_ride.id) then raise exception 'experimental_ride_binding_failed'; end if;
 return jsonb_build_object('rideId',v_ride.id,'status',v_ride.status,'estimated_price',v_ride.estimated_price,'fare_amount_cents',v_ride.fare_amount_cents,'payment_status',v_ride.payment_status,'reused',false);
end $$;
revoke all on function apois_nav_lab.create_passenger_ride_v21(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function apois_nav_lab.create_passenger_ride_v21(uuid,uuid,uuid,jsonb) to service_role;

-- Read-only preflight for the trusted request handler. All authorization is
-- rechecked by the atomic insertion. Existing linked rides can be recovered
-- after the confirmation expires, without re-quoting or dispatching again.
create function apois_nav_lab.read_selection_v21(p_auth_user uuid,p_selection uuid,p_request_key uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_s apois_nav_lab.selection; v_p apois_nav_lab.catalog; v_d apois_nav_lab.catalog; v_r public.rides;
begin
 select s.* into v_s from apois_nav_lab.selection s join public.users u on u.id=s.passenger_id
 where u.auth_user_id=p_auth_user and s.id=p_selection and s.request_key=p_request_key
 and u.deleted_at is null and u.blocked_at is null
 and (u.suspended_until is null or u.suspended_until<=statement_timestamp())
 and (u.suspended_at is null or u.suspended_until<=statement_timestamp());
 if not found then return null; end if;
 if v_s.ride_id is not null then
  select * into v_r from public.rides where id=v_s.ride_id and passenger_id=v_s.passenger_id and request_key=p_request_key;
  if not found then return null; end if;
  return jsonb_build_object('linked',true);
 end if;
 if v_s.sealed_at is not null or v_s.expires_at<=statement_timestamp() then return null; end if;
 select * into v_p from apois_nav_lab.catalog where id=v_s.pickup_id and version=v_s.pickup_version and active;
 if not found then return null; end if;
 select * into v_d from apois_nav_lab.catalog where id=v_s.destination_id and version=v_s.destination_version and active;
 if not found then return null; end if;
 return jsonb_build_object('linked',false,'expiresAt',v_s.expires_at,
 'origin',jsonb_build_object('lat',v_p.lat,'lng',v_p.lng),
 'destination',jsonb_build_object('lat',v_d.lat,'lng',v_d.lng));
end $$;
revoke all on function apois_nav_lab.read_selection_v21(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function apois_nav_lab.read_selection_v21(uuid,uuid,uuid) to service_role;
