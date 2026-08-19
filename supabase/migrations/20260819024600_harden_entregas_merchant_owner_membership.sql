create or replace function public.manage_merchant_member(_merchant_id uuid, _user_id uuid, _role text, _status text default 'active'::text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_before jsonb;
  v_after jsonb;
  v_status text := case when _status = 'inactive' then 'disabled' else _status end;
  v_admin boolean := public.current_user_is_admin();
  v_canonical_owner uuid;
begin
  if not (v_admin or public.current_user_is_merchant_owner(_merchant_id)) then
    raise exception 'merchant owner access required';
  end if;
  if _role not in ('owner','manager','staff') then raise exception 'invalid member role'; end if;
  if v_status not in ('invited','active','disabled') then raise exception 'invalid member status'; end if;
  if not exists (select 1 from public.profiles p where p.id = _user_id) then raise exception 'profile not found'; end if;

  select m.owner_user_id into v_canonical_owner
  from public.merchants m
  where m.id = _merchant_id;
  if v_canonical_owner is null then raise exception 'merchant not found'; end if;

  if not v_admin and _role = 'owner' then
    raise exception 'only admin can assign merchant owner role';
  end if;
  if not v_admin and _user_id = v_canonical_owner then
    raise exception 'canonical owner membership can only be changed by admin';
  end if;
  if _role = 'owner' and _user_id is distinct from v_canonical_owner then
    raise exception 'owner role must match merchant owner_user_id';
  end if;
  if _role = 'owner' and v_status <> 'active' then
    raise exception 'merchant owner membership must remain active';
  end if;

  select to_jsonb(mm) into v_before
  from public.merchant_members mm
  where mm.merchant_id = _merchant_id and mm.user_id = _user_id;

  insert into public.merchant_members(merchant_id,user_id,role,status)
  values(_merchant_id,_user_id,_role,v_status)
  on conflict(merchant_id,user_id) do update
  set role=excluded.role,status=excluded.status,updated_at=now();

  select to_jsonb(mm) into v_after
  from public.merchant_members mm
  where mm.merchant_id = _merchant_id and mm.user_id = _user_id;

  if v_admin then
    insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,before_data,after_data)
    values((select auth.uid()),'manage_merchant_member','merchant_member',_merchant_id::text||':'||_user_id::text,v_before,v_after);
  end if;
end;
$function$;
