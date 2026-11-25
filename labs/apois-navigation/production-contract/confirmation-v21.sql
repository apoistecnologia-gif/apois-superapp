-- Confirm only server-owned public OSM catalog IDs. No client coordinates.
-- v21 guard is additional to the provenance fixture; no production migration.
create function apois_nav_lab.confirm_selection_v21(p_auth_user uuid,p_request_key uuid,p_pickup uuid,p_pickup_version integer,p_destination uuid,p_destination_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_passenger uuid; v_existing apois_nav_lab.selection; v_result jsonb;
begin
 select id into v_passenger from public.users where auth_user_id=p_auth_user;
 if not found then return null; end if;
 perform public.apois_lock_passenger_ride_financial_gate(v_passenger);
 perform 1 from public.users where id=v_passenger and auth_user_id=p_auth_user and deleted_at is null and blocked_at is null
 and (suspended_until is null or suspended_until<=clock_timestamp())
 and (suspended_at is null or suspended_until<=clock_timestamp()) for no key update;
 if not found then return null; end if;
 if exists(select 1 from public.rides where passenger_id=v_passenger and status in
 ('agendada','aguardando_pagamento','procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem')) then return null; end if;
 select * into v_existing from apois_nav_lab.selection where passenger_id=v_passenger and request_key=p_request_key for update;
 if found and (v_existing.sealed_at is not null or v_existing.ride_id is not null) then return null; end if;
 if exists(select 1 from public.rides where request_key=p_request_key) then return null; end if;
 v_result:=apois_nav_lab.confirm_selection(p_auth_user,p_request_key,p_pickup,p_pickup_version,p_destination,p_destination_version);
 return v_result;
end $$;
revoke all on function apois_nav_lab.confirm_selection_v21(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated;
grant execute on function apois_nav_lab.confirm_selection_v21(uuid,uuid,uuid,integer,uuid,integer) to service_role;
create function public.apois_nav_lab_confirm_v21(p_auth_user uuid,p_request_key uuid,p_pickup uuid,p_pickup_version integer,p_destination uuid,p_destination_version integer)
returns jsonb language sql security invoker set search_path='' as $$ select apois_nav_lab.confirm_selection_v21(p_auth_user,p_request_key,p_pickup,p_pickup_version,p_destination,p_destination_version) $$;
revoke all on function public.apois_nav_lab_confirm_v21(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated;
grant execute on function public.apois_nav_lab_confirm_v21(uuid,uuid,uuid,integer,uuid,integer) to service_role;
