-- APOIS CORRIDAS — STAGE ONLY. NAO EXECUTAR EM PRODUCAO SEM APROVACAO.
-- Video motorista 06/11/2026: upload de foto pode gravar, mas a assinatura
-- da URL de bucket privado exige SELECT autorizado em storage.objects.
-- A politica atual permite INSERT no proprio prefixo, mas nenhuma politica
-- SELECT foi localizada para profile-photos no projeto Corridas.
-- Restricao: o motorista autenticado ve somente suas proprias fotos.
-- Nao aumenta permissoes de anon nem torna o bucket publico.
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'apois profile photo owner read authenticated'
  ) THEN
    CREATE POLICY "apois profile photo owner read authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'profile-photos'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      AND (storage.foldername(name))[2] IS NULL
    );
  END IF;
END
$policy$;

-- ATENCAO: esta politica nao e suficiente para mostrar a foto ao PASSAGEIRO
-- em viagem. Requer leitura/assinatura isolada por vinculo de corrida,
-- nao uma politica publica ampla. Validar com contas QA em staging.
