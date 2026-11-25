-- Disposable least-privilege trigger ownership experiment.
-- Production role provisioning, actual RLS, grants and deployment review pending.
create role apois_nav_fixture_revoker nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
grant usage on schema public,apois_nav_lab to apois_nav_fixture_revoker;
grant select(id,status,driver_id,accepted_driver_id,passenger_id) on public.rides to apois_nav_fixture_revoker;
grant select(id,user_id) on public.drivers to apois_nav_fixture_revoker;
grant select(ride_id,pickup_id,pickup_version,destination_id,destination_version) on apois_nav_lab.selection to apois_nav_fixture_revoker;
grant insert(ride_id,phase) on apois_nav_lab.revoked_leg to apois_nav_fixture_revoker;
-- Read only the permitted columns, not customer details or coordinates.
alter table public.rides enable row level security;
alter table public.drivers enable row level security;
create policy lab_revoker_rides_read on public.rides for select to apois_nav_fixture_revoker using(true);
create policy lab_revoker_drivers_read on public.drivers for select to apois_nav_fixture_revoker using(true);
create policy lab_revoker_selection_read on apois_nav_lab.selection for select to apois_nav_fixture_revoker using(true);
create policy lab_revoker_tombstone_insert on apois_nav_lab.revoked_leg for insert to apois_nav_fixture_revoker with check(true);
-- Trigger-only functions: no user parameters, fixed empty search_path.
-- The owner is not a table owner and cannot modify public rows.
grant create on schema apois_nav_lab to apois_nav_fixture_revoker;
alter function apois_nav_lab.record_revoked_leg() security definer;
alter function apois_nav_lab.record_authority_revocation() security definer;
alter function apois_nav_lab.record_selection_revocation() security definer;
alter function apois_nav_lab.record_v21_extra_revocation() security definer;
alter function apois_nav_lab.record_revoked_leg() owner to apois_nav_fixture_revoker;
alter function apois_nav_lab.record_authority_revocation() owner to apois_nav_fixture_revoker;
alter function apois_nav_lab.record_selection_revocation() owner to apois_nav_fixture_revoker;
alter function apois_nav_lab.record_v21_extra_revocation() owner to apois_nav_fixture_revoker;
revoke create on schema apois_nav_lab from apois_nav_fixture_revoker;
revoke all on function apois_nav_lab.record_revoked_leg(),apois_nav_lab.record_authority_revocation(),apois_nav_lab.record_selection_revocation(),apois_nav_lab.record_v21_extra_revocation() from public,anon,authenticated,service_role;
-- Synthetic authenticated writers: NOT copies of production RLS.
-- Own profile harmless edit and a narrowly scoped driver-admin operation.
alter table public.users add column name text;
alter table public.users enable row level security;
grant select(id,name) on public.users to authenticated;
grant update(name) on public.users to authenticated;
create policy lab_profile_read on public.users for select to authenticated using(id='00000000-0000-4000-8000-000000000051');
create policy lab_profile_update on public.users for update to authenticated using(id='00000000-0000-4000-8000-000000000051') with check(id='00000000-0000-4000-8000-000000000051');
grant select(id,is_online) on public.drivers to authenticated;
grant update(is_online) on public.drivers to authenticated;
create policy lab_driver_read on public.drivers for select to authenticated using(id='00000000-0000-4000-8000-000000000071');
create policy lab_driver_update on public.drivers for update to authenticated using(id='00000000-0000-4000-8000-000000000071') with check(id='00000000-0000-4000-8000-000000000071');
