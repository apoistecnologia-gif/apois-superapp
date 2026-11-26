-- Disposable PostgreSQL-only experiment. Not a production migration.
-- Read-only production metadata 2026-11-26: auth.sessions.id/user_id UUID,
-- not_after timestamptz nullable, RLS enabled; service_role, authenticated
-- and anon cannot SELECT session IDs. Never grant broad session table access.
create schema auth;
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
alter table auth.sessions enable row level security;
grant usage on schema auth to service_role,authenticated;
create role apois_nav_fixture_session_reader nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
grant usage on schema auth,apois_nav_lab to apois_nav_fixture_session_reader;
grant select(id,user_id,not_after) on auth.sessions to apois_nav_fixture_session_reader;
create policy lab_session_reader_select on auth.sessions for select to apois_nav_fixture_session_reader using(true);
-- Private narrowly scoped boolean only. The service caller must independently
-- verify exact JWT via Auth and bind sub/session_id. No client execute grants.
-- Does not claim to reproduce inactivity/time-box/single-session Auth settings.
grant create on schema apois_nav_lab to apois_nav_fixture_session_reader;
create function apois_nav_lab.session_exists_v21(p_auth_user uuid,p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_auth_user
 and (s.not_after is null or s.not_after>statement_timestamp()))
$$;
alter function apois_nav_lab.session_exists_v21(uuid,uuid) owner to apois_nav_fixture_session_reader;
revoke create on schema apois_nav_lab from apois_nav_fixture_session_reader;
revoke all on function apois_nav_lab.session_exists_v21(uuid,uuid) from public,anon,authenticated;
grant execute on function apois_nav_lab.session_exists_v21(uuid,uuid) to service_role;
-- Public schema facade uses INVOKER, not definer, and service-only execute.
create function public.apois_nav_lab_session_exists_v21(p_auth_user uuid,p_session uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select apois_nav_lab.session_exists_v21(p_auth_user,p_session)
$$;
revoke all on function public.apois_nav_lab_session_exists_v21(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apois_nav_lab_session_exists_v21(uuid,uuid) to service_role;
