-- APOIS ENTREGAS — APLICADA com autorização em produção em 31/10/2026.
-- Migration oficial: supabase/migrations/20261031151515_apois_courier_avatar_own_scoped_insert_20261031.sql
-- NÃO REAPLICAR: o histórico do Supabase já contém esta política.
-- Somente INSERT da foto pública na pasta individual de entregador aprovado.
-- Sem modificar documentos, aprovação, RLS de perfis, pagamentos ou fotos existentes.
-- Motivo: public.couriers tem RLS sem SELECT policy; um EXISTS direto da policy
-- storage.objects devolve falso para authenticated. Esta função verifica
-- exclusivamente a elegibilidade do próprio auth.uid() sem expor linhas da tabela.

DO $qa$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='avatars' AND public IS TRUE
      AND file_size_limit=5242880
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'Public avatars bucket configuration does not match QA';
  END IF;
END $qa$;

CREATE OR REPLACE FUNCTION public.apois_can_upload_own_courier_avatar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $qa$
  SELECT (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.user_id = (SELECT auth.uid())
      AND c.status = 'approved' AND c.is_active IS TRUE
      AND p.is_active IS TRUE
  );
$qa$;

-- No public/anonymous RPC access to the narrowly scoped eligibility checker.
REVOKE ALL ON FUNCTION public.apois_can_upload_own_courier_avatar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apois_can_upload_own_courier_avatar() TO authenticated;

-- Only create (no UPDATE/DELETE), only own UUID/courier-profile folder.
-- Bucket enforces allowed image MIME types and max 5 MiB.
CREATE POLICY "APOIS courier own profile avatar upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'courier-profile'
    AND (storage.foldername(name))[3] IS NULL
    AND storage.extension(name) IN ('jpg','png','webp')
    AND (SELECT public.apois_can_upload_own_courier_avatar())
  );
