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
commit;
