-- Only synthetic UUIDs. No live Supabase connection or actual session data.
insert into auth.sessions values
 ('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000061',null),
 ('00000000-0000-4000-8000-000000000802','00000000-0000-4000-8000-000000000061',statement_timestamp()-interval '1 second'),
 ('00000000-0000-4000-8000-000000000803','00000000-0000-4000-8000-000000000061',statement_timestamp()+interval '1 hour');
do $$
begin
 if has_column_privilege('service_role','auth.sessions','id','select') or
    has_column_privilege('authenticated','auth.sessions','id','select') or
    has_column_privilege('anon','auth.sessions','id','select') or
    has_function_privilege('authenticated','public.apois_nav_lab_session_exists_v21(uuid,uuid)','execute') or
    has_function_privilege('anon','public.apois_nav_lab_session_exists_v21(uuid,uuid)','execute') or
    has_function_privilege('authenticated','apois_nav_lab.session_exists_v21(uuid,uuid)','execute') or
    has_table_privilege('apois_nav_fixture_session_reader','auth.sessions','update') or
    has_table_privilege('apois_nav_fixture_session_reader','auth.sessions','delete') or
    has_schema_privilege('apois_nav_fixture_session_reader','apois_nav_lab','create') or
    (select rolcanlogin or rolbypassrls from pg_roles where rolname='apois_nav_fixture_session_reader')
 then raise exception 'Session reader overprivileged'; end if;
 if not has_function_privilege('service_role','public.apois_nav_lab_session_exists_v21(uuid,uuid)','execute')
 then raise exception 'Service facade inaccessible'; end if;
end $$;
set role service_role;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000061';
begin
 if not public.apois_nav_lab_session_exists_v21(a,'00000000-0000-4000-8000-000000000801') or
    not public.apois_nav_lab_session_exists_v21(a,'00000000-0000-4000-8000-000000000803') or
    public.apois_nav_lab_session_exists_v21(a,'00000000-0000-4000-8000-000000000802') or
    public.apois_nav_lab_session_exists_v21('00000000-0000-4000-8000-000000000062','00000000-0000-4000-8000-000000000801') or
    public.apois_nav_lab_session_exists_v21(a,null)
 then raise exception 'Session existence/expiration check incorrect'; end if;
end $$;
reset role;
delete from auth.sessions where id='00000000-0000-4000-8000-000000000801';
set role service_role;
do $$ begin
 if public.apois_nav_lab_session_exists_v21('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000801')
 then raise exception 'Deleted session accepted'; end if;
end $$;
reset role;
select 'APOIS_V21_PRIVATE_SESSION_PROOF_OK';
