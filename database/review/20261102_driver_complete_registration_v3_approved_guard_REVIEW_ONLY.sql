-- REVIEW ONLY, NOT APPLIED TO PRODUCTION.
-- Supabase Corridas: tbbzkrfupmqdywnzgnms
-- Based on pg_get_functiondef live-read on 2026-11-02; preserves function signature, required checks, inserts and return type.
-- Blocking existing approved, suspended or blocked accounts BEFORE updating users/roles/drivers prevents client bypass and approval reset.
-- Deployment requires explicit authorization, isolated PG tests of re-registration and rollback, then an official migration.
-- Rollback: reinstate previous pg_get_functiondef after controlled review; never auto-revert user states.
CREATE OR REPLACE FUNCTION apois_rpc_private.driver_complete_registration_v3(_name text, _phone text, _cpf text, _birth_date date, _city text, _state text, _address text, _address_number text, _address_complement text, _province text, _postal_code text, _declared_monthly_income numeric, _category text, _vehicle_model text, _vehicle_plate text, _vehicle_color text, _vehicle_year integer, _selfie_path text, _cnh_path text, _cnh_back_path text, _vehicle_document_path text, _vehicle_photo_path text, _photo_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user public.users%rowtype;
  v_driver public.drivers%rowtype;
  v_category text := lower(trim(coalesce(_category, '')));
  v_prefix text := auth.uid()::text || '/';
  v_postal_code text := regexp_replace(coalesce(_postal_code,''),'[^0-9]','','g');
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if v_category not in ('carros','motos','fretes','guincho','envios') then raise exception 'invalid_category' using errcode='22023'; end if;
  if nullif(trim(coalesce(_name,'')), '') is null then raise exception 'name_required' using errcode='22023'; end if;
  if nullif(regexp_replace(coalesce(_cpf,''),'[^0-9]','','g'), '') is null then raise exception 'cpf_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(_address,'')), '') is null then raise exception 'address_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(_address_number,'')), '') is null then raise exception 'address_number_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(_province,'')), '') is null then raise exception 'province_required' using errcode='22023'; end if;
  if length(v_postal_code) <> 8 then raise exception 'invalid_postal_code' using errcode='22023'; end if;
  if _declared_monthly_income is null or _declared_monthly_income <= 0 then raise exception 'invalid_declared_monthly_income' using errcode='22023'; end if;
  if _vehicle_year is null or _vehicle_year < 1971 or _vehicle_year > extract(year from now())::int + 1 then raise exception 'invalid_vehicle_year' using errcode='22023'; end if;
  if _selfie_path is null or left(_selfie_path, length(v_prefix)) <> v_prefix
     or _cnh_path is null or left(_cnh_path, length(v_prefix)) <> v_prefix
     or _cnh_back_path is null or left(_cnh_back_path, length(v_prefix)) <> v_prefix
     or _vehicle_document_path is null or left(_vehicle_document_path, length(v_prefix)) <> v_prefix
     or _vehicle_photo_path is null or left(_vehicle_photo_path, length(v_prefix)) <> v_prefix
     or (_photo_path is not null and left(_photo_path, length(v_prefix)) <> v_prefix) then raise exception 'invalid_document_path' using errcode='22023'; end if;
  select * into v_user from public.users where auth_user_id=auth.uid() and deleted_at is null limit 1;
  if not found then raise exception 'profile_missing'; end if;
  -- APOIS_DRIVER_APPROVED_ACCOUNT_GUARD_V1: existing driver row is locked before any profile/document mutation.
  select * into v_driver from public.drivers d where d.user_id=v_user.id for update;
  if found and v_driver.approval_status in ('aprovado','suspenso','bloqueado') then
    raise exception 'driver_registration_closed' using errcode='42501';
  end if;
  update public.users
  set name=left(trim(_name),160),phone=nullif(left(regexp_replace(coalesce(_phone,''),'[^0-9]','','g'),15),''),cpf=nullif(left(regexp_replace(coalesce(_cpf,''),'[^0-9]','','g'),14),''),birth_date=_birth_date,city=nullif(left(trim(coalesce(_city,'')),120),''),avatar_url=coalesce(_photo_path,_selfie_path),updated_at=now()
  where id=v_user.id returning * into v_user;
  insert into public.user_roles(user_id,role) values(v_user.id,'driver') on conflict(user_id,role) do nothing;
  insert into public.drivers(user_id,name,email,phone,cpf,birth_date,city,state,address,address_number,address_complement,province,postal_code,declared_monthly_income,category,vehicle_model,vehicle_plate,vehicle_color,vehicle_year,selfie_url,cnh_url,cnh_back_url,vehicle_document_url,vehicle_photo_url,photo_url,approval_status,documents_status,subscription_status,is_online,updated_at)
  values(v_user.id,left(trim(_name),160),v_user.email,v_user.phone,v_user.cpf,_birth_date,nullif(left(trim(coalesce(_city,'')),120),''),upper(left(trim(coalesce(_state,'')),2)),left(trim(_address),200),left(trim(_address_number),30),nullif(left(trim(coalesce(_address_complement,'')),120),''),left(trim(_province),120),left(v_postal_code,8),_declared_monthly_income,v_category,nullif(left(trim(coalesce(_vehicle_model,'')),120),''),upper(nullif(left(trim(coalesce(_vehicle_plate,'')),10),'')),nullif(left(trim(coalesce(_vehicle_color,'')),60),''),_vehicle_year,_selfie_path,_cnh_path,_cnh_back_path,_vehicle_document_path,_vehicle_photo_path,coalesce(_photo_path,_selfie_path),'em_analise','pending_review','teste',false,now())
  on conflict(user_id) do update set
    name=excluded.name,email=excluded.email,phone=excluded.phone,cpf=excluded.cpf,birth_date=excluded.birth_date,city=excluded.city,state=excluded.state,address=excluded.address,address_number=excluded.address_number,address_complement=excluded.address_complement,province=excluded.province,postal_code=excluded.postal_code,declared_monthly_income=excluded.declared_monthly_income,category=excluded.category,vehicle_model=excluded.vehicle_model,vehicle_plate=excluded.vehicle_plate,vehicle_color=excluded.vehicle_color,vehicle_year=excluded.vehicle_year,selfie_url=excluded.selfie_url,cnh_url=excluded.cnh_url,cnh_back_url=excluded.cnh_back_url,vehicle_document_url=excluded.vehicle_document_url,vehicle_photo_url=excluded.vehicle_photo_url,photo_url=excluded.photo_url,
    approval_status=case when public.drivers.approval_status in ('suspenso','bloqueado') then public.drivers.approval_status else 'em_analise' end,
    documents_status='pending_review',
    approved_at=case when public.drivers.approval_status in ('suspenso','bloqueado') then public.drivers.approved_at else null end,
    motivo_reprovacao=case when public.drivers.approval_status in ('suspenso','bloqueado') then public.drivers.motivo_reprovacao else null end,
    is_online=false,updated_at=now()
  -- Defense in depth for concurrent registration/admin approval: a newly approved
  -- row must not be overwritten even if it changed after the precheck.
  where public.drivers.approval_status not in ('aprovado','suspenso','bloqueado')
  returning * into v_driver;
  if not found then
    raise exception 'driver_registration_closed' using errcode='42501';
  end if;
  return to_jsonb(v_driver);
end;
$function$

