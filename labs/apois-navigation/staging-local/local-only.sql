-- Disposable local Supabase only. No migration/deployment.
-- Apply AFTER the existing v21 contract fixture and before creating test users.
create table public.passenger_wallets(passenger_id uuid primary key references public.users(id),is_blocked boolean not null default false);
create table public.ride_categories(id uuid primary key,code text unique not null,is_active boolean not null default true);
insert into public.ride_categories values('00000000-0000-4000-8000-000000000090','carros',true);
grant select on public.passenger_wallets,public.ride_categories to service_role;
insert into apois_nav_lab.catalog values
 ('00000000-0000-4000-8000-000000000021',1,'node',1,repeat('a',64),'Embarque CI',-9.4,-40.5,true),
 ('00000000-0000-4000-8000-000000000022',1,'node',2,repeat('a',64),'Destino CI',-9.42,-40.51,true);
-- Local Supabase may give newly created public relations broad default grants.
-- These fixture tables are server-only, and not a reproduction of prod RLS.
alter table public.users enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;
alter table public.app_settings enable row level security;
alter table public.cancellation_fees enable row level security;
alter table public.passenger_wallets enable row level security;
alter table public.ride_categories enable row level security;
revoke all on public.users,public.drivers,public.rides,public.app_settings,public.cancellation_fees,public.passenger_wallets,public.ride_categories from public,anon,authenticated;
notify pgrst,'reload schema';
