-- Disposable fixture. Seal and creation use the same passenger advisory lock
-- then selection row lock. No cancellation of an existing ride. No automatic
-- deletion, expiry-based release or change to the ordinary ride endpoint.
create function apois_nav_lab.reconcile_selection_v21(p_auth_user uuid,p_selection uuid,p_request_key uuid,p_seal boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_passenger uuid; v_s apois_nav_lab.selection; v_r public.rides; v_base jsonb;
begin
 select id into v_passenger from public.users where auth_user_id=p_auth_user and deleted_at is null;
 if not found or p_seal is null then return null; end if;
 perform public.apois_lock_passenger_ride_financial_gate(v_passenger);
 select s.* into v_s from apois_nav_lab.selection s join public.users u on u.id=s.passenger_id
 where s.id=p_selection and s.request_key=p_request_key and u.auth_user_id=p_auth_user and u.deleted_at is null
 for no key update of u for update of s;
 if not found then return null; end if;
 v_base:=jsonb_build_object('selectionId',p_selection,'requestKey',p_request_key);
 if v_s.ride_id is not null then
  select * into v_r from public.rides where id=v_s.ride_id and passenger_id=v_passenger and request_key=p_request_key for share;
  if not found then return null; end if;
  return v_base||jsonb_build_object('state','ride','ride',jsonb_build_object('rideId',v_r.id,'status',v_r.status));
 end if;
 -- Global UUID unique key collision or ordinary ride with this key: do not
 -- attest absence. Only the bound experimental ride is recoverable here.
 if exists(select 1 from public.rides where request_key=p_request_key) then return null; end if;
 if v_s.sealed_at is not null then return v_base||jsonb_build_object('state','sealed'); end if;
 if p_seal then
  update apois_nav_lab.selection set sealed_at=clock_timestamp(),prepared_xid=null where id=v_s.id and sealed_at is null and ride_id is null;
  if not found then return null; end if;
  return v_base||jsonb_build_object('state','sealed');
 end if;
 return v_base||jsonb_build_object('state','open');
end $$;
create function apois_nav_lab.active_ride_v21(p_auth_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select case when count(r.id)>1 then jsonb_build_object('verified',false)
 when count(r.id)=0 then jsonb_build_object('verified',true,'ride',null)
 else jsonb_build_object('verified',true,'ride',(jsonb_agg(jsonb_build_object('rideId',r.id,'status',r.status))->0)) end
 from public.users u left join public.rides r on r.passenger_id=u.id and r.status in
 ('agendada','aguardando_pagamento','procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem')
 where u.auth_user_id=p_auth_user and u.deleted_at is null group by u.id
$$;
revoke all on function apois_nav_lab.reconcile_selection_v21(uuid,uuid,uuid,boolean),apois_nav_lab.active_ride_v21(uuid) from public,anon,authenticated;
grant execute on function apois_nav_lab.reconcile_selection_v21(uuid,uuid,uuid,boolean),apois_nav_lab.active_ride_v21(uuid) to service_role;
create function public.apois_nav_lab_reconcile_v21(p_auth_user uuid,p_selection uuid,p_request_key uuid,p_seal boolean)
returns jsonb language sql security invoker set search_path='' as $$ select apois_nav_lab.reconcile_selection_v21(p_auth_user,p_selection,p_request_key,p_seal) $$;
create function public.apois_nav_lab_active_v21(p_auth_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select apois_nav_lab.active_ride_v21(p_auth_user) $$;
revoke all on function public.apois_nav_lab_reconcile_v21(uuid,uuid,uuid,boolean),public.apois_nav_lab_active_v21(uuid) from public,anon,authenticated;
grant execute on function public.apois_nav_lab_reconcile_v21(uuid,uuid,uuid,boolean),public.apois_nav_lab_active_v21(uuid) to service_role;
