-- Fixture only, separate actor with no assigned ride.
do $$
begin
 if has_function_privilege('anon','public.apois_nav_lab_driver_target_limited_v21(uuid,uuid,text)','execute')
 or has_function_privilege('authenticated','public.apois_nav_lab_driver_target_limited_v21(uuid,uuid,text)','execute')
 or has_table_privilege('authenticated','apois_nav_lab.driver_target_rate_v21','select')
 then raise exception 'client access to admission'; end if;
end $$;
set role service_role;
do $$
declare actor uuid:='00000000-0000-4000-8000-000000000981'; r uuid:='00000000-0000-4000-8000-000000000982'; v jsonb;
begin
 for i in 1..30 loop
  v:=public.apois_nav_lab_driver_target_limited_v21(actor,r,'PICKUP');
  if v is distinct from '{"limited":false,"proof":null}'::jsonb then raise exception 'unexpected quota response'; end if;
 end loop;
 v:=public.apois_nav_lab_driver_target_limited_v21(actor,r,'TRIP');
 if v is distinct from '{"limited":true,"proof":null}'::jsonb then raise exception 'quota bypass'; end if;
end $$;
reset role;
update apois_nav_lab.driver_target_rate_v21 set window_started_at=clock_timestamp()-interval '61 seconds' where auth_user_id='00000000-0000-4000-8000-000000000981';
set role service_role;
do $$
begin
 if public.apois_nav_lab_driver_target_limited_v21('00000000-0000-4000-8000-000000000981','00000000-0000-4000-8000-000000000982','PICKUP') is distinct from '{"limited":false,"proof":null}'::jsonb then raise exception 'quota did not renew'; end if;
end $$;
reset role;
select 'APOIS_DRIVER_TARGET_DURABLE_RATE_OK';
