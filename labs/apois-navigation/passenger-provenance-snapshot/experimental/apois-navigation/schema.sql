-- Experimental SQL, NOT a migration. Run only on disposable fixture DB.
-- Trusted server role only. No client-facing grants, no changes to existing rows.
begin;
create schema apois_nav_lab;
revoke all on schema apois_nav_lab from public, anon, authenticated;
grant usage on schema apois_nav_lab to service_role;

create table apois_nav_lab.catalog (
  id uuid not null,
  version integer not null check (version > 0),
  osm_kind text not null check (osm_kind in ('node','way','relation')),
  osm_id bigint not null check (osm_id > 0),
  extract_sha256 text not null check (extract_sha256 ~ '^[0-9a-f]{64}$'),
  label text not null check (length(label) between 1 and 120),
  lat double precision not null check (lat between -9.65 and -9.10),
  lng double precision not null check (lng between -40.80 and -40.20),
  active boolean not null default false,
  primary key (id, version)
);
create table apois_nav_lab.selection (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.users(id) on delete cascade,
  request_key uuid not null,
  pickup_id uuid not null,
  pickup_version integer not null,
  destination_id uuid not null,
  destination_version integer not null,
  confirmed_at timestamptz not null,
  expires_at timestamptz not null,
  ride_id uuid unique references public.rides(id) on delete cascade,
  prepared_xid xid8,
  unique(passenger_id,request_key),
  foreign key(pickup_id,pickup_version) references apois_nav_lab.catalog(id,version),
  foreign key(destination_id,destination_version) references apois_nav_lab.catalog(id,version),
  check(expires_at > confirmed_at),
  check(pickup_id <> destination_id)
);
alter table apois_nav_lab.catalog enable row level security;
alter table apois_nav_lab.selection enable row level security;
revoke all on all tables in schema apois_nav_lab from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema apois_nav_lab to service_role;

-- Catalog versions are immutable except activation; server importer is responsible
-- for verifying actual independent OSM source before insertion.
create function apois_nav_lab.immutable_catalog() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') then
    raise exception 'catalog_version_immutable';
  end if;
  return new;
end $$;
create trigger immutable_catalog before update on apois_nav_lab.catalog
for each row execute function apois_nav_lab.immutable_catalog();

-- p_auth_user is from verified server authentication, never request JSON.
-- The only geography-bearing input is a pair of independent catalog IDs.
create function apois_nav_lab.confirm_selection(
  p_auth_user uuid, p_request_key uuid, p_pickup_id uuid, p_pickup_version integer,
  p_destination_id uuid, p_destination_version integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid; v_pick apois_nav_lab.catalog%rowtype; v_dest apois_nav_lab.catalog%rowtype;
  v_selection apois_nav_lab.selection%rowtype; v_now timestamptz := clock_timestamp();
begin
  if p_auth_user is null or p_request_key is null or p_pickup_id is null or
     p_destination_id is null or p_pickup_id=p_destination_id then return null; end if;
  select id into strict v_user from public.users
    where auth_user_id=p_auth_user and blocked_at is null and deleted_at is null
      and (suspended_until is null or suspended_until<=v_now);
  select * into v_pick from apois_nav_lab.catalog where id=p_pickup_id and version=p_pickup_version and active;
  if not found then return null; end if;
  select * into v_dest from apois_nav_lab.catalog where id=p_destination_id and version=p_destination_version and active;
  if not found or (v_pick.lat=v_dest.lat and v_pick.lng=v_dest.lng) then return null; end if;
  insert into apois_nav_lab.selection(passenger_id,request_key,pickup_id,pickup_version,destination_id,destination_version,confirmed_at,expires_at)
    values(v_user,p_request_key,v_pick.id,v_pick.version,v_dest.id,v_dest.version,v_now,v_now+interval '5 minutes')
    on conflict(passenger_id,request_key) do nothing;
  select * into strict v_selection from apois_nav_lab.selection
    where passenger_id=v_user and request_key=p_request_key for update;
  if v_selection.ride_id is not null or v_selection.expires_at<=clock_timestamp() or
     (v_selection.pickup_id,v_selection.pickup_version,v_selection.destination_id,v_selection.destination_version)
       is distinct from (v_pick.id,v_pick.version,v_dest.id,v_dest.version) then return null; end if;
  return jsonb_build_object('selectionId',v_selection.id,'requestKey',v_selection.request_key,
    'expiresAt',v_selection.expires_at,'origin',jsonb_build_object('lat',v_pick.lat,'lng',v_pick.lng,'label',v_pick.label),
    'destination',jsonb_build_object('lat',v_dest.lat,'lng',v_dest.lng,'label',v_dest.label));
exception when no_data_found or too_many_rows then return null;
end $$;

-- Trusted creator must acquire the confirmed selection before INSERT, inside
-- the same transaction that creates the ride. Never expose as a client RPC.
create function apois_nav_lab.prepare_selection(p_auth_user uuid,p_selection uuid,p_request_key uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $
declare
  v_user uuid; v_s apois_nav_lab.selection%rowtype;
  v_pick apois_nav_lab.catalog%rowtype; v_dest apois_nav_lab.catalog%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select id into strict v_user from public.users where auth_user_id=p_auth_user
    and blocked_at is null and deleted_at is null and (suspended_until is null or suspended_until<=v_now) for share;
  select * into strict v_s from apois_nav_lab.selection where id=p_selection and passenger_id=v_user for update;
  if v_s.request_key is distinct from p_request_key or v_s.ride_id is not null
     or v_s.expires_at<=clock_timestamp() then return null; end if;
  if exists(select 1 from public.rides where passenger_id=v_user and request_key::text=p_request_key::text)
    then return null; end if;
  select * into strict v_pick from apois_nav_lab.catalog where id=v_s.pickup_id and version=v_s.pickup_version and active for share;
  select * into strict v_dest from apois_nav_lab.catalog where id=v_s.destination_id and version=v_s.destination_version and active for share;
  update apois_nav_lab.selection set prepared_xid=pg_current_xact_id() where id=v_s.id;
  return jsonb_build_object('selectionId',v_s.id,'requestKey',v_s.request_key,
    'origin',jsonb_build_object('lat',v_pick.lat,'lng',v_pick.lng,'label',v_pick.label),
    'destination',jsonb_build_object('lat',v_dest.lat,'lng',v_dest.lng,'label',v_dest.label));
exception when no_data_found or too_many_rows then return null;
end $;

-- Only the trusted creation adapter may call this after inserting the ride.
-- No retroactive conversion of historic rides. No coordinate rewriting.
create function apois_nav_lab.bind_selection(p_auth_user uuid,p_selection uuid,p_ride uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid; v_s apois_nav_lab.selection%rowtype; v_r public.rides%rowtype;
  v_pick apois_nav_lab.catalog%rowtype; v_dest apois_nav_lab.catalog%rowtype;
  v_stops jsonb; v_now timestamptz := clock_timestamp();
begin
  select id into strict v_user from public.users where auth_user_id=p_auth_user
    and blocked_at is null and deleted_at is null and (suspended_until is null or suspended_until<=v_now);
  select * into strict v_s from apois_nav_lab.selection where id=p_selection and passenger_id=v_user for update;
  if v_s.ride_id is not null or v_s.prepared_xid is distinct from pg_current_xact_id() then return false; end if;
  if v_s.expires_at<=v_now then return false; end if;
  -- xmin is an additional conservative transaction guard, not proof of provenance.
  select * into strict v_r from public.rides where id=p_ride and passenger_id=v_user
    and xmin=pg_current_xact_id()::xid for update;
  if v_r.request_key::text is distinct from v_s.request_key::text or v_r.created_at<v_s.confirmed_at or
     v_r.created_at>v_s.expires_at or v_r.category::text<>'carros' or v_r.status::text<>'procurar_motorista'
     or v_r.driver_id is not null then return false; end if;
  -- Generated types differ between the two backend copies. Missing/ambiguous
  -- stop state is not proof of zero stops. Explicit empty array only.
  v_stops := coalesce(to_jsonb(v_r)->'waypoints',to_jsonb(v_r)->'intermediates');
  if v_stops is distinct from '[]'::jsonb then return false; end if;
  if (to_jsonb(v_r) ? 'waypoints' and to_jsonb(v_r) ? 'intermediates')
      and to_jsonb(v_r)->'intermediates' is distinct from '[]'::jsonb then return false; end if;
  select * into strict v_pick from apois_nav_lab.catalog where id=v_s.pickup_id and version=v_s.pickup_version and active for share;
  select * into strict v_dest from apois_nav_lab.catalog where id=v_s.destination_id and version=v_s.destination_version and active for share;
  if (v_r.origin_lat,v_r.origin_lng,v_r.destination_lat,v_r.destination_lng)
    is distinct from (v_pick.lat,v_pick.lng,v_dest.lat,v_dest.lng) then return false; end if;
  update apois_nav_lab.selection set ride_id=p_ride,prepared_xid=null where id=v_s.id;
  return true;
exception when no_data_found or too_many_rows or unique_violation then return false;
end $$;
revoke all on all functions in schema apois_nav_lab from public, anon, authenticated;
grant execute on function apois_nav_lab.confirm_selection(uuid,uuid,uuid,integer,uuid,integer) to service_role;
grant execute on function apois_nav_lab.prepare_selection(uuid,uuid,uuid) to service_role;
grant execute on function apois_nav_lab.bind_selection(uuid,uuid,uuid) to service_role;
commit;
