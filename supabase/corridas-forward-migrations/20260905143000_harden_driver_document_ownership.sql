-- Forward-only Corridas migration for driver document ownership and evidence integrity.
-- DO NOT apply automatically from the Superapp build.
-- This migration versions the production contract discovered on 2026-09-05 and
-- closes the remaining slot/MIME confusion where a PDF in vehicle-documents
-- could otherwise be attached as vehicle_photo.

begin;

create schema if not exists apois_rpc_private;
create schema if not exists private;

revoke all on schema apois_rpc_private from public, anon, authenticated;
grant usage on schema apois_rpc_private to postgres, service_role;

create or replace function private.apois_driver_document_reviewer()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    where u.auth_user_id = auth.uid()
      and u.deleted_at is null
      and ur.role::text in ('admin','super_admin','operations','support')
  );
$function$;

revoke all on function private.apois_driver_document_reviewer() from public, anon;
grant execute on function private.apois_driver_document_reviewer() to authenticated, service_role;

create or replace function private.driver_evidence_object_is_referenced(_bucket text, _name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when auth.uid() is null then false
    when split_part(coalesce(_name,''),'/',1) <> auth.uid()::text then false
    else exists (
      select 1
      from public.drivers d
      join public.users u on u.id = d.user_id
      where u.auth_user_id = auth.uid()
        and u.deleted_at is null
        and (
          (_bucket = 'driver-selfies' and d.selfie_url = _name)
          or (_bucket = 'driver-cnh' and (d.cnh_url = _name or d.cnh_back_url = _name))
          or (_bucket = 'vehicle-documents' and (d.vehicle_document_url = _name or d.vehicle_photo_url = _name))
        )
    )
  end;
$function$;

revoke all on function private.driver_evidence_object_is_referenced(text,text) from public, anon;
grant execute on function private.driver_evidence_object_is_referenced(text,text) to authenticated, service_role;

-- Keep evidence private, cap payloads at 10 MiB, and make MIME enforcement a
-- storage invariant rather than a client-only convention.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('driver-selfies','driver-selfies',false,10485760,array['image/jpeg','image/png','image/webp']::text[]),
  ('driver-cnh','driver-cnh',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
  ('vehicle-documents','vehicle-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "apois_driver_storage_insert_own" on storage.objects;
create policy "apois_driver_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
  and split_part(name,'/',1) = auth.uid()::text
);

drop policy if exists "apois_driver_storage_select_own" on storage.objects;
create policy "apois_driver_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id in ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
  and (
    split_part(name,'/',1) = auth.uid()::text
    or private.apois_driver_document_reviewer()
  )
);

drop policy if exists "apois_driver_storage_update_own" on storage.objects;
create policy "apois_driver_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id in ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
  and split_part(name,'/',1) = auth.uid()::text
  and (
    bucket_id = 'profile-photos'
    or not private.driver_evidence_object_is_referenced(bucket_id,name)
  )
)
with check (
  bucket_id in ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
  and split_part(name,'/',1) = auth.uid()::text
  and (
    bucket_id = 'profile-photos'
    or not private.driver_evidence_object_is_referenced(bucket_id,name)
  )
);

drop policy if exists "apois_driver_storage_delete_own" on storage.objects;
create policy "apois_driver_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id in ('driver-selfies','driver-cnh','vehicle-documents','profile-photos')
  and split_part(name,'/',1) = auth.uid()::text
  and (
    bucket_id = 'profile-photos'
    or not private.driver_evidence_object_is_referenced(bucket_id,name)
  )
);

create or replace function apois_rpc_private.driver_update_document(_slot text, _storage_path text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','storage','apois_rpc_private'
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_domain_user_id uuid;
  v_driver public.drivers%rowtype;
  v_slot text := lower(trim(coalesce(_slot,'')));
  v_path text := trim(coalesce(_storage_path,''));
  v_bucket text;
  v_file text;
  v_mime text;
  v_extension text;
  v_complete boolean;
  v_next_approval_status text;
begin
  if v_auth_user_id is null then
    raise exception 'unauthorized' using errcode='42501';
  end if;

  select u.id into v_domain_user_id
  from public.users u
  where u.auth_user_id = v_auth_user_id
    and u.deleted_at is null
  limit 1;
  if v_domain_user_id is null then
    raise exception 'profile_missing' using errcode='42501';
  end if;

  if v_slot not in ('selfie','cnh_front','cnh_back','crlv','vehicle_photo') then
    raise exception 'invalid_document_slot' using errcode='22023';
  end if;

  v_bucket := case v_slot
    when 'selfie' then 'driver-selfies'
    when 'cnh_front' then 'driver-cnh'
    when 'cnh_back' then 'driver-cnh'
    when 'crlv' then 'vehicle-documents'
    when 'vehicle_photo' then 'vehicle-documents'
  end;

  -- A caller may reference only a newly uploaded object in its own top-level
  -- AUTH folder. Nested paths, traversal-like names and mismatched slot names
  -- are rejected even if the storage API itself accepted the object.
  if v_path = ''
     or split_part(v_path,'/',1) <> v_auth_user_id::text
     or array_length(string_to_array(v_path,'/'),1) <> 2 then
    raise exception 'invalid_document_path' using errcode='22023';
  end if;
  v_file := split_part(v_path,'/',2);
  if v_file !~ ('^' || v_slot || '-[0-9]{10,20}\.(jpg|jpeg|png|webp|pdf)$') then
    raise exception 'invalid_document_filename' using errcode='22023';
  end if;

  select lower(coalesce(o.metadata->>'mimetype',''))
  into v_mime
  from storage.objects o
  where o.bucket_id = v_bucket
    and o.name = v_path
  limit 1;
  if not found then
    raise exception 'document_object_missing' using errcode='22023';
  end if;

  v_extension := lower(regexp_replace(v_file, '^.*\.', ''));
  if v_slot in ('selfie','vehicle_photo') then
    if v_mime not in ('image/jpeg','image/png','image/webp')
       or v_extension not in ('jpg','jpeg','png','webp') then
      raise exception 'invalid_document_mime' using errcode='22023';
    end if;
  else
    if v_mime not in ('image/jpeg','image/png','image/webp','application/pdf')
       or v_extension not in ('jpg','jpeg','png','webp','pdf')
       or (v_mime = 'application/pdf' and v_extension <> 'pdf')
       or (v_mime <> 'application/pdf' and v_extension = 'pdf') then
      raise exception 'invalid_document_mime' using errcode='22023';
    end if;
  end if;

  select * into v_driver
  from public.drivers d
  where d.user_id = v_domain_user_id
  for update;
  if not found then
    raise exception 'driver_profile_missing' using errcode='P0002';
  end if;

  v_next_approval_status := case
    when v_driver.approval_status in ('suspenso','bloqueado') then v_driver.approval_status
    else 'em_analise'
  end;

  update public.drivers
  set selfie_url = case when v_slot='selfie' then v_path else selfie_url end,
      cnh_url = case when v_slot='cnh_front' then v_path else cnh_url end,
      cnh_back_url = case when v_slot='cnh_back' then v_path else cnh_back_url end,
      vehicle_document_url = case when v_slot='crlv' then v_path else vehicle_document_url end,
      vehicle_photo_url = case when v_slot='vehicle_photo' then v_path else vehicle_photo_url end,
      documents_status = 'pending_review',
      approval_status = v_next_approval_status,
      approved_at = case when v_next_approval_status='em_analise' then null else approved_at end,
      motivo_reprovacao = case when v_next_approval_status='em_analise' then null else motivo_reprovacao end,
      is_online = false,
      updated_at = now()
  where id = v_driver.id
  returning * into v_driver;

  v_complete := v_driver.selfie_url is not null
    and v_driver.cnh_url is not null
    and v_driver.cnh_back_url is not null
    and v_driver.vehicle_document_url is not null
    and v_driver.vehicle_photo_url is not null;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_auth_user_id,
    'driver.document.replaced',
    'driver',
    v_driver.id::text,
    jsonb_build_object(
      'driver_domain_user_id',v_domain_user_id,
      'slot',v_slot,
      'bucket',v_bucket,
      'storage_path',v_path,
      'mimetype',v_mime,
      'documents_status',v_driver.documents_status,
      'approval_status',v_driver.approval_status,
      'complete',v_complete
    )
  );

  return jsonb_build_object(
    'ok',true,
    'driver_id',v_driver.id,
    'slot',v_slot,
    'documents_status',v_driver.documents_status,
    'approval_status',v_driver.approval_status,
    'complete',v_complete
  );
end;
$function$;

revoke all on function apois_rpc_private.driver_update_document(text,text) from public, anon, authenticated;
grant execute on function apois_rpc_private.driver_update_document(text,text) to service_role;

create or replace function public.driver_update_document(_slot text, _storage_path text)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select apois_rpc_private.driver_update_document($1,$2);
$function$;

revoke all on function public.driver_update_document(text,text) from public, anon;
grant execute on function public.driver_update_document(text,text) to authenticated, service_role;

commit;
