-- Service-role-only RPC facades for the v21 candidate. Disposable fixture only.
-- No public exposure of the private schema or privileged security definer.
create function public.apois_nav_lab_read_selection_v21(p_auth_user uuid,p_selection uuid,p_request_key uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select apois_nav_lab.read_selection_v21(p_auth_user,p_selection,p_request_key)
$$;
create function public.apois_nav_lab_create_ride_v21(p_auth_user uuid,p_selection uuid,p_request_key uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select apois_nav_lab.create_passenger_ride_v21(p_auth_user,p_selection,p_request_key,p_payload)
$$;
revoke all on function public.apois_nav_lab_read_selection_v21(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.apois_nav_lab_create_ride_v21(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apois_nav_lab_read_selection_v21(uuid,uuid,uuid) to service_role;
grant execute on function public.apois_nav_lab_create_ride_v21(uuid,uuid,uuid,jsonb) to service_role;
do $$
begin
 if has_function_privilege('anon','public.apois_nav_lab_read_selection_v21(uuid,uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.apois_nav_lab_create_ride_v21(uuid,uuid,uuid,jsonb)','execute')
 or not has_function_privilege('service_role','public.apois_nav_lab_create_ride_v21(uuid,uuid,uuid,jsonb)','execute') then
 raise exception 'RPC grants incorrect';
 end if;
end $$;

-- Additional service-only RPC for the driver control/issuer candidate.
create function public.apois_nav_lab_driver_proof_v21(p_auth_user uuid,p_ride uuid,p_phase text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select apois_nav_lab.read_driver_proof_v21(p_auth_user,p_ride,p_phase)
$$;
revoke all on function public.apois_nav_lab_driver_proof_v21(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.apois_nav_lab_driver_proof_v21(uuid,uuid,text) to service_role;
