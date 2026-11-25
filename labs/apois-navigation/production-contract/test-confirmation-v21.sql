do $$
declare a uuid:='00000000-0000-4000-8000-000000000221'; u uuid:='00000000-0000-4000-8000-000000000231'; k uuid:='00000000-0000-4000-8000-000000000111'; p uuid:='00000000-0000-4000-8000-000000000021'; d uuid:='00000000-0000-4000-8000-000000000022'; s jsonb;
begin
 insert into public.users(id,auth_user_id) values(u,a);
 if has_function_privilege('authenticated','public.apois_nav_lab_confirm_v21(uuid,uuid,uuid,integer,uuid,integer)','execute') then raise exception 'client confirm grant'; end if;
 update public.users set suspended_at=clock_timestamp() where id=u;
 if public.apois_nav_lab_confirm_v21(a,k,p,1,d,1) is not null then raise exception 'suspended accepted'; end if;
 update public.users set suspended_at=null where id=u;
 s:=public.apois_nav_lab_confirm_v21(a,k,p,1,d,1);
 if s is null then raise exception 'confirm failed'; end if;
 if public.apois_nav_lab_confirm_v21(a,k,p,1,d,1) is distinct from s then raise exception 'confirm not idempotent'; end if;
 if (public.apois_nav_lab_reconcile_v21(a,(s->>'selectionId')::uuid,k,true)->>'state')<>'sealed' then raise exception 'seal failed'; end if;
 if public.apois_nav_lab_confirm_v21(a,k,p,1,d,1) is not null then raise exception 'sealed selection revived'; end if;
end $$;
select 'APOIS_V21_CONFIRMATION_CONTROL_OK';
