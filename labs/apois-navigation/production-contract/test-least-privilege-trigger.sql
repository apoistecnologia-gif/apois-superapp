-- Must follow test-v21.sql and its Node integration.
-- Recover an existing synthetic searching ride and assign the fixture driver.
do $$
declare r uuid;
begin
 if has_schema_privilege('authenticated','apois_nav_lab','usage') or has_table_privilege('authenticated','apois_nav_lab.revoked_leg','insert') or
 has_function_privilege('authenticated','apois_nav_lab.record_v21_extra_revocation()','execute') then raise exception 'client access leaked'; end if;
 if has_schema_privilege('apois_nav_fixture_revoker','apois_nav_lab','create') or has_table_privilege('apois_nav_fixture_revoker','public.rides','update') or
 has_column_privilege('apois_nav_fixture_revoker','public.rides','origin_lat','select') or has_table_privilege('apois_nav_fixture_revoker','apois_nav_lab.revoked_leg','delete') then raise exception 'revoker overprivileged'; end if;
 select id into strict r from public.rides where request_key='00000000-0000-4000-8000-000000000032';
 update public.rides set driver_id='00000000-0000-4000-8000-000000000071',accepted_driver_id='00000000-0000-4000-8000-000000000071',accepted_at=clock_timestamp(),status='motorista_a_caminho' where id=r;
 if apois_nav_lab.read_driver_proof_v21('00000000-0000-4000-8000-000000000061',r,'PICKUP') is null then raise exception 'proof missing'; end if;
end $$;
set role authenticated;
update public.users set name='Synthetic name edit' where id='00000000-0000-4000-8000-000000000051';
reset role;
do $$
begin
 if exists(select 1 from apois_nav_lab.revoked_leg where ride_id=(select id from public.rides where request_key='00000000-0000-4000-8000-000000000032')) then raise exception 'harmless profile edit revoked'; end if;
end $$;
set role authenticated;
update public.drivers set is_online=false where id='00000000-0000-4000-8000-000000000071';
reset role;
do $$
declare r uuid;
begin
 select id into strict r from public.rides where request_key='00000000-0000-4000-8000-000000000032';
 if not exists(select 1 from apois_nav_lab.revoked_leg where ride_id=r and phase='PICKUP') then raise exception 'authenticated writer failed revocation'; end if;
 if apois_nav_lab.read_driver_proof_v21('00000000-0000-4000-8000-000000000061',r,'PICKUP') is not null then raise exception 'offline driver accepted'; end if;
end $$;
select 'APOIS_V21_LEAST_PRIVILEGE_TRIGGER_OK';
