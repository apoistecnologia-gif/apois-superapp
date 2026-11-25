-- Disposable synthetic PostgreSQL fixture, never a live Supabase database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.users(id uuid primary key,auth_user_id uuid unique not null,blocked_at timestamptz,deleted_at timestamptz,suspended_until timestamptz);
create table public.drivers(id uuid primary key,user_id uuid not null references public.users(id),
  approval_status text,subscription_status text,category text,blocked_at timestamptz,suspended_at timestamptz);
create table public.rides(id uuid primary key,passenger_id uuid not null references public.users(id),request_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),category text not null,status text not null,driver_id uuid,accepted_driver_id uuid,accepted_at timestamptz,
  origin_lat double precision not null,origin_lng double precision not null,destination_lat double precision not null,destination_lng double precision not null,waypoints jsonb);
grant select,update on public.users,public.rides,public.drivers to service_role;
grant insert on public.rides to service_role;
insert into public.users(id,auth_user_id) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012');
insert into public.users(id,auth_user_id) values
('00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000061'),
('00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000062');
insert into public.drivers(id,user_id,approval_status,subscription_status,category) values
('00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000051','aprovado','active','carros'),
('00000000-0000-4000-8000-000000000072','00000000-0000-4000-8000-000000000052','aprovado','active','carros');
