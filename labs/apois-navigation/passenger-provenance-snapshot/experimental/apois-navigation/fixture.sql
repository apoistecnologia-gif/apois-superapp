-- Disposable synthetic PostgreSQL fixture, never a live Supabase database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.users(id uuid primary key,auth_user_id uuid unique not null,blocked_at timestamptz,deleted_at timestamptz,suspended_until timestamptz);
create table public.rides(id uuid primary key,passenger_id uuid not null references public.users(id),request_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),category text not null,status text not null,driver_id uuid,
  origin_lat double precision not null,origin_lng double precision not null,destination_lat double precision not null,destination_lng double precision not null,waypoints jsonb);
grant select,update on public.users,public.rides to service_role;
grant insert on public.rides to service_role;
insert into public.users(id,auth_user_id) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012');
