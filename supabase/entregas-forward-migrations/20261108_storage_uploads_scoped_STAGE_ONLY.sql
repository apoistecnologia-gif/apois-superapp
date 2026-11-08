-- APOIS ENTREGAS — STORAGE UPLOAD ACL, STAGE ONLY / NOT DEPLOYED.
-- Target: ptgkwyyolrdgnqketkjj, checked against read-only schema 2026-11-08.
-- Never execute on production before verifying two synthetic accounts and
-- existing grants, policies, roles, bucket ACLs and attached-files retention.
-- File paths actually emitted by pinned client:
--   product-images       <merchant_uuid>/<product_uuid>-<timestamp>.<ext>
--   merchant-assets      <merchant_uuid>/<logo|cover>-<timestamp>.<ext>
--   merchant-documents   <merchant_uuid>/<document_type>-<timestamp>.<ext>
--   courier-documents    <auth_user_uuid>/<document_type>-<timestamp>.<ext>
--   support-attachments  <auth_user_uuid>/<ticket_uuid>/<random>-<filename>
-- Do not change the existing avatars policy.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images','product-images',true,10485760, array['image/jpeg','image/png','image/webp']),
  ('merchant-assets','merchant-assets',true,10485760, array['image/jpeg','image/png','image/webp']),
  ('merchant-documents','merchant-documents',false,15728640, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('courier-documents','courier-documents',false,15728640, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('support-attachments','support-attachments',false,15728640, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Merchants can only write inside a merchant id for which they are owner/manager.
-- Public delivery of product pictures/logos is controlled by the PUBLIC bucket;
-- object mutation (including removal of stale images) is not public.
drop policy if exists "apois merchant images upload own v1" on storage.objects;
create policy "apois merchant images upload own v1"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('product-images','merchant-assets')
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and public.current_user_is_merchant_manager(m.id)
  )
);

drop policy if exists "apois merchant images manage read own v1" on storage.objects;
create policy "apois merchant images manage read own v1"
on storage.objects for select to authenticated
using (
  bucket_id in ('product-images','merchant-assets')
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and (public.current_user_is_merchant_manager(m.id) or public.current_user_is_admin())
  )
);

drop policy if exists "apois merchant images delete own v1" on storage.objects;
create policy "apois merchant images delete own v1"
on storage.objects for delete to authenticated
using (
  bucket_id in ('product-images','merchant-assets')
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and public.current_user_is_merchant_manager(m.id)
  )
);

-- Merchant legal files always remain in a PRIVATE bucket. Administrators can
-- read for document review but cannot impersonate merchant uploads.
drop policy if exists "apois merchant docs upload own v1" on storage.objects;
create policy "apois merchant docs upload own v1"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merchant-documents'
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and public.current_user_is_merchant_manager(m.id)
  )
);
drop policy if exists "apois merchant docs read authorized v1" on storage.objects;
create policy "apois merchant docs read authorized v1"
on storage.objects for select to authenticated
using (
  bucket_id = 'merchant-documents'
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and (public.current_user_is_merchant_manager(m.id) or public.current_user_is_admin())
  )
);
drop policy if exists "apois merchant docs delete own v1" on storage.objects;
create policy "apois merchant docs delete own v1"
on storage.objects for delete to authenticated
using (
  bucket_id = 'merchant-documents'
  and exists (
    select 1 from public.merchants m
    where m.id::text = (storage.foldername(name))[1]
      and public.current_user_is_merchant_manager(m.id)
  )
);

-- Courier client stores documents under auth.uid(), not courier.id.
-- current_user_courier_id checks that the caller has an active profile.
drop policy if exists "apois courier docs upload own v1" on storage.objects;
create policy "apois courier docs upload own v1"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_courier_id() is not null
);
drop policy if exists "apois courier docs read authorized v1" on storage.objects;
create policy "apois courier docs read authorized v1"
on storage.objects for select to authenticated
using (
  bucket_id = 'courier-documents'
  and (
    ( (storage.foldername(name))[1] = (select auth.uid())::text
      and public.current_user_courier_id() is not null )
    or public.current_user_is_admin()
  )
);
drop policy if exists "apois courier docs delete own v1" on storage.objects;
create policy "apois courier docs delete own v1"
on storage.objects for delete to authenticated
using (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_courier_id() is not null
);

-- Customer support uploads require ownership of both user folder and ticket.
-- Resolved/closed tickets retain existing attachments but accept no new ones.
drop policy if exists "apois support attachments upload own open ticket v1" on storage.objects;
create policy "apois support attachments upload own open ticket v1"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[2]
      and t.requester_user_id = (select auth.uid())
      and t.status in ('open','in_progress')
  )
);
drop policy if exists "apois support attachments read participants v1" on storage.objects;
create policy "apois support attachments read participants v1"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    public.current_user_is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.support_tickets t
        where t.id::text = (storage.foldername(name))[2]
          and t.requester_user_id = (select auth.uid())
      )
    )
  )
);
drop policy if exists "apois support attachments delete own v1" on storage.objects;
create policy "apois support attachments delete own v1"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[2]
      and t.requester_user_id = (select auth.uid())
  )
);

commit;
