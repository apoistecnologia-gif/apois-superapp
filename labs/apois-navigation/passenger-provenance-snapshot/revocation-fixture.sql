-- Disposable PostgreSQL experiment only. Install AFTER the source snapshot
-- tests. This is not a Supabase migration and must not be run in production.
begin;
create table apois_nav_lab.revoked_leg(
  ride_id uuid not null,
  phase text not null check(phase in ('PICKUP','TRIP')),
  revoked_at timestamptz not null default clock_timestamp(),
  primary key(ride_id,phase)
);
alter table apois_nav_lab.revoked_leg enable row level security;
revoke all on apois_nav_lab.revoked_leg from public,anon,authenticated;
grant select,insert on apois_nav_lab.revoked_leg to service_role;
-- Durable tombstone in the same transaction as the ride mutation.
-- Do not store coordinates, driver ID, session or bearer token in the log.
create function apois_nav_lab.record_revoked_leg() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_phase text;
begin
  v_phase:=case old.status::text when 'motorista_a_caminho' then 'PICKUP' when 'em_viagem' then 'TRIP' else null end;
  if v_phase is not null and exists(select 1 from apois_nav_lab.selection where ride_id=old.id) then
    if tg_op='DELETE' then
      insert into apois_nav_lab.revoked_leg(ride_id,phase) values(old.id,v_phase) on conflict do nothing;
    elsif new.status is distinct from old.status or
      (new.driver_id,new.accepted_driver_id,new.accepted_at,new.category,new.passenger_id,new.request_key,
       new.origin_lat,new.origin_lng,new.destination_lat,new.destination_lng)
       is distinct from
      (old.driver_id,old.accepted_driver_id,old.accepted_at,old.category,old.passenger_id,old.request_key,
       old.origin_lat,old.origin_lng,old.destination_lat,old.destination_lng) or
       (to_jsonb(new)->'waypoints',to_jsonb(new)->'intermediates') is distinct from
       (to_jsonb(old)->'waypoints',to_jsonb(old)->'intermediates') then
      insert into apois_nav_lab.revoked_leg(ride_id,phase) values(old.id,v_phase) on conflict do nothing;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function apois_nav_lab.record_revoked_leg() from public,anon,authenticated;
grant execute on function apois_nav_lab.record_revoked_leg() to service_role;
create trigger apois_nav_lab_revoked_leg before update or delete on public.rides
for each row execute function apois_nav_lab.record_revoked_leg();
-- Conservative invalidation on changes to security-sensitive authority.
-- Fixture only: production roles/RLS and lock ordering require review.
create function apois_nav_lab.record_authority_revocation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='drivers' then
    if tg_op='UPDATE' then
      if (new.user_id,new.approval_status,new.subscription_status,new.category,new.blocked_at,new.suspended_at)
      is not distinct from (old.user_id,old.approval_status,old.subscription_status,old.category,old.blocked_at,old.suspended_at) then return new; end if;
    end if;
    insert into apois_nav_lab.revoked_leg(ride_id,phase)
    select r.id,case r.status::text when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
    from public.rides r join apois_nav_lab.selection s on s.ride_id=r.id
    where (r.driver_id=old.id or r.accepted_driver_id=old.id) and r.status::text in ('motorista_a_caminho','em_viagem')
    on conflict do nothing;
  elsif tg_table_name='users' then
    if tg_op='UPDATE' then
      if (new.auth_user_id,new.blocked_at,new.deleted_at,new.suspended_until)
      is not distinct from (old.auth_user_id,old.blocked_at,old.deleted_at,old.suspended_until) then return new; end if;
    end if;
    insert into apois_nav_lab.revoked_leg(ride_id,phase)
    select r.id,case r.status::text when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
    from public.rides r join apois_nav_lab.selection s on s.ride_id=r.id
    where r.status::text in ('motorista_a_caminho','em_viagem') and
      (r.passenger_id=old.id or exists(select 1 from public.drivers d where d.user_id=old.id and (r.driver_id=d.id or r.accepted_driver_id=d.id)))
    on conflict do nothing;
  elsif tg_table_name='catalog' then
    if tg_op='UPDATE' then
      if new.active is not distinct from old.active then return new; end if;
    end if;
    insert into apois_nav_lab.revoked_leg(ride_id,phase)
    select r.id,case r.status::text when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
    from public.rides r join apois_nav_lab.selection s on s.ride_id=r.id
    where r.status::text in ('motorista_a_caminho','em_viagem') and
      ((s.pickup_id,s.pickup_version)=(old.id,old.version) or (s.destination_id,s.destination_version)=(old.id,old.version))
    on conflict do nothing;
  else raise exception 'unexpected authority table';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function apois_nav_lab.record_authority_revocation() from public,anon,authenticated;
grant execute on function apois_nav_lab.record_authority_revocation() to service_role;
create trigger apois_nav_lab_driver_revoked after update or delete on public.drivers
for each row execute function apois_nav_lab.record_authority_revocation();
create trigger apois_nav_lab_user_revoked after update or delete on public.users
for each row execute function apois_nav_lab.record_authority_revocation();
create trigger apois_nav_lab_catalog_revoked after update or delete on apois_nav_lab.catalog
for each row execute function apois_nav_lab.record_authority_revocation();
-- A bound selection is itself part of the authority. Removing it or
-- changing its provenance must invalidate already issued permits.
create function apois_nav_lab.record_selection_revocation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.ride_id is not null then
    if tg_op='UPDATE' then
      if (new.ride_id,new.passenger_id,new.request_key,new.pickup_id,new.pickup_version,new.destination_id,new.destination_version)
        is not distinct from
        (old.ride_id,old.passenger_id,old.request_key,old.pickup_id,old.pickup_version,old.destination_id,old.destination_version)
      then return new; end if;
    end if;
    insert into apois_nav_lab.revoked_leg(ride_id,phase)
    select r.id,case r.status::text when 'motorista_a_caminho' then 'PICKUP' else 'TRIP' end
    from public.rides r
    where r.id=old.ride_id and r.status::text in ('motorista_a_caminho','em_viagem')
    on conflict do nothing;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function apois_nav_lab.record_selection_revocation() from public,anon,authenticated;
grant execute on function apois_nav_lab.record_selection_revocation() to service_role;
create trigger apois_nav_lab_selection_revoked before update or delete on apois_nav_lab.selection
for each row execute function apois_nav_lab.record_selection_revocation();
commit;
