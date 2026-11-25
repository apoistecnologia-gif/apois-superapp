-- Additional v21-only guards; load after revocation-fixture.sql.
-- No production migration. Preserve the underlying operational rules.
create function apois_nav_lab.read_driver_proof_v21(p_auth uuid,p_ride uuid,p_phase text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select apois_nav_lab.read_driver_proof(p_auth,p_ride,p_phase)
 from public.rides r
 join public.drivers d on d.id=r.driver_id and d.id=r.accepted_driver_id
 join public.users u on u.id=d.user_id
 join public.users passenger on passenger.id=r.passenger_id
 join apois_nav_lab.selection s on s.ride_id=r.id
 where r.id=p_ride and u.auth_user_id=p_auth
 and d.is_online is true and (u.suspended_at is null or u.suspended_until<=statement_timestamp())
 and passenger.deleted_at is null and passenger.blocked_at is null
 and (passenger.suspended_until is null or passenger.suspended_until<=statement_timestamp())
 and (passenger.suspended_at is null or passenger.suspended_until<=statement_timestamp())
 and r.pickup_source='osm_lab' and r.payment_method='cash'
 and r.queued_after_ride_id is null and r.scheduled_for is null
 and r.origin=jsonb_build_object('lat',r.origin_lat,'lng',r.origin_lng)
 and r.destination=jsonb_build_object('lat',r.destination_lat,'lng',r.destination_lng)
 and not exists(select 1 from apois_nav_lab.revoked_leg l where l.ride_id=p_ride and l.phase=p_phase)
$$;
revoke all on function apois_nav_lab.read_driver_proof_v21(uuid,uuid,text) from public,anon,authenticated;
grant execute on function apois_nav_lab.read_driver_proof_v21(uuid,uuid,text) to service_role;

create function apois_nav_lab.record_v21_extra_revocation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='drivers' then
  if old.is_online is not distinct from new.is_online then return new; end if;
  insert into apois_nav_lab.revoked_leg(ride_id,phase)
  select r.id,case r.status when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
  from public.rides r join apois_nav_lab.selection s on s.ride_id=r.id
  where (r.driver_id=old.id or r.accepted_driver_id=old.id) and r.status in ('motorista_a_caminho','em_viagem') on conflict do nothing;
 elsif tg_table_name='users' then
  if old.suspended_at is not distinct from new.suspended_at then return new; end if;
  insert into apois_nav_lab.revoked_leg(ride_id,phase)
  select r.id,case r.status when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
  from public.rides r join apois_nav_lab.selection s on s.ride_id=r.id
  where r.status in ('motorista_a_caminho','em_viagem') and
    (r.passenger_id=old.id or exists(select 1 from public.drivers d where d.user_id=old.id and (r.driver_id=d.id or r.accepted_driver_id=d.id))) on conflict do nothing;
 elsif tg_table_name='rides' then
  if (old.origin,old.destination,old.pickup_source,old.payment_method,old.queued_after_ride_id,old.scheduled_for)
    is not distinct from (new.origin,new.destination,new.pickup_source,new.payment_method,new.queued_after_ride_id,new.scheduled_for) then return new; end if;
  if old.status in ('motorista_a_caminho','em_viagem') and exists(select 1 from apois_nav_lab.selection s where s.ride_id=old.id) then
   insert into apois_nav_lab.revoked_leg(ride_id,phase) values(old.id,case old.status when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end) on conflict do nothing;
  end if;
 else raise exception 'unexpected v21 authority table';
 end if;
 return new;
end $$;
revoke all on function apois_nav_lab.record_v21_extra_revocation() from public,anon,authenticated;
grant execute on function apois_nav_lab.record_v21_extra_revocation() to service_role;
create trigger apois_nav_v21_driver_revocation after update of is_online on public.drivers for each row execute function apois_nav_lab.record_v21_extra_revocation();
create trigger apois_nav_v21_user_revocation after update of suspended_at on public.users for each row execute function apois_nav_lab.record_v21_extra_revocation();
create trigger apois_nav_v21_ride_revocation before update of origin,destination,pickup_source,payment_method,queued_after_ride_id,scheduled_for on public.rides for each row execute function apois_nav_lab.record_v21_extra_revocation();
