-- APOIS-007: Customer Entregas avatar overwrite, STAGE ONLY, NOT DEPLOYED.
-- Pinned client: src/routes/perfil/dados-pessoais.tsx uploads "<auth.uid()>/avatar"
-- to the public avatars bucket with {upsert:true}. Upsert needs INSERT, SELECT,
-- UPDATE scoped by the exact owner path. Existing courier-profile policy untouched.

begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "apois customer avatar upsert insert own v1" on storage.objects;
create policy "apois customer avatar upsert insert own v1"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar'
  and public.current_user_is_active()
);

drop policy if exists "apois customer avatar upsert read own v1" on storage.objects;
create policy "apois customer avatar upsert read own v1"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar'
  and public.current_user_is_active()
);

drop policy if exists "apois customer avatar upsert update own v1" on storage.objects;
create policy "apois customer avatar upsert update own v1"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar'
  and public.current_user_is_active()
)
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar'
  and public.current_user_is_active()
);

commit;
