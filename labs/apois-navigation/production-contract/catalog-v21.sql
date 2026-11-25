-- Disposable v21 catalog delivery contract. No production migration.
-- A single configured immutable extract/version is exposed, not all catalog rows.
create function apois_nav_lab.catalog_v21(p_auth_user uuid,p_version integer,p_extract text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select case when count(*) between 2 and 1000 then jsonb_build_object(
 'source','OSM_PBF','version',p_version,'extract_sha256',p_extract,'rows',
 jsonb_agg(jsonb_build_object('id',c.id,'version',c.version,'extract_sha256',c.extract_sha256,
 'label',c.label,'lat',c.lat,'lng',c.lng,'active',true) order by c.id)) else null end
 from (select id,version,extract_sha256,label,lat,lng from apois_nav_lab.catalog
       where active and version=p_version and extract_sha256=p_extract order by id limit 1001) c
 where p_version>0 and p_extract ~ '^[a-f0-9]{64}$' and exists(
 select 1 from public.users u where u.auth_user_id=p_auth_user and u.deleted_at is null and u.blocked_at is null
 and (u.suspended_until is null or u.suspended_until<=statement_timestamp())
 and (u.suspended_at is null or u.suspended_until<=statement_timestamp()))
$$;
-- Bind selection to the same immutable server-approved catalog. The original
-- function rechecks active rows and owner; no client coordinates are accepted.
create function apois_nav_lab.confirm_catalog_v21(p_auth_user uuid,p_request_key uuid,p_pickup uuid,p_destination uuid,p_version integer,p_extract text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_pickup=p_destination or p_version is null or p_version<=0 or p_extract is null or p_extract !~ '^[a-f0-9]{64}$' then return null; end if;
 if (select count(*) from apois_nav_lab.catalog where id in (p_pickup,p_destination) and version=p_version and extract_sha256=p_extract and active)<>2 then return null; end if;
 return apois_nav_lab.confirm_selection_v21(p_auth_user,p_request_key,p_pickup,p_version,p_destination,p_version);
end $$;
create function public.apois_nav_lab_catalog_v21(p_auth_user uuid,p_version integer,p_extract text)
returns jsonb language sql stable security invoker set search_path='' as $$ select apois_nav_lab.catalog_v21(p_auth_user,p_version,p_extract) $$;
create function public.apois_nav_lab_confirm_catalog_v21(p_auth_user uuid,p_request_key uuid,p_pickup uuid,p_destination uuid,p_version integer,p_extract text)
returns jsonb language sql security invoker set search_path='' as $$ select apois_nav_lab.confirm_catalog_v21(p_auth_user,p_request_key,p_pickup,p_destination,p_version,p_extract) $$;
revoke all on function apois_nav_lab.catalog_v21(uuid,integer,text),apois_nav_lab.confirm_catalog_v21(uuid,uuid,uuid,uuid,integer,text),public.apois_nav_lab_catalog_v21(uuid,integer,text),public.apois_nav_lab_confirm_catalog_v21(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function apois_nav_lab.catalog_v21(uuid,integer,text),apois_nav_lab.confirm_catalog_v21(uuid,uuid,uuid,uuid,integer,text),public.apois_nav_lab_catalog_v21(uuid,integer,text),public.apois_nav_lab_confirm_catalog_v21(uuid,uuid,uuid,uuid,integer,text) to service_role;
