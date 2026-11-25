do $$
declare a uuid:='00000000-0000-4000-8000-000000000271'; u uuid:='00000000-0000-4000-8000-000000000281'; p uuid:='00000000-0000-4000-8000-000000000021'; d uuid:='00000000-0000-4000-8000-000000000022'; x uuid:='00000000-0000-4000-8000-000000000029'; k uuid:='00000000-0000-4000-8000-000000000291'; v jsonb;
begin
 insert into public.users(id,auth_user_id) values(u,a);
 insert into apois_nav_lab.catalog values(x,1,'node',29,repeat('b',64),'Outro extrato',-9.4,-40.5,true);
 v:=public.apois_nav_lab_catalog_v21(a,1,repeat('a',64));
 if jsonb_array_length(v->'rows')<>2 then raise exception 'catalog contains wrong extract'; end if;
 if public.apois_nav_lab_catalog_v21(a,1,repeat('b',64)) is not null then raise exception 'incomplete catalog accepted'; end if;
 if public.apois_nav_lab_confirm_catalog_v21(a,k,p,x,1,repeat('a',64)) is not null then raise exception 'mixed extract accepted'; end if;
 if public.apois_nav_lab_confirm_catalog_v21(a,k,p,d,1,repeat('a',64)) is null then raise exception 'valid confirm denied'; end if;
 update public.users set suspended_at=clock_timestamp() where id=u;
 if public.apois_nav_lab_catalog_v21(a,1,repeat('a',64)) is not null then raise exception 'suspended catalog accepted'; end if;
 update public.users set suspended_at=null where id=u;
 if has_function_privilege('anon','public.apois_nav_lab_catalog_v21(uuid,integer,text)','execute') or has_function_privilege('authenticated','public.apois_nav_lab_confirm_catalog_v21(uuid,uuid,uuid,uuid,integer,text)','execute') then raise exception 'client direct catalog grant'; end if;
 -- Additional inactive entries do not affect the exposed snapshot.
 update apois_nav_lab.catalog set active=false where id=x;
end $$;
select 'APOIS_V21_CATALOG_POLICY_OK';
