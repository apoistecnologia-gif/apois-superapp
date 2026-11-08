# APOIS-001 — Storage Entregas: correção preparada, NÃO APLICADA

Base de investigação: projeto Supabase **APOIS ENTREGAS - PRODUÇÃO** (ptgkwyyolrdgnqketkjj), consultado em modo leitura 08/11/2026.

**Confirmado**: seis buckets já existem no ambiente; RLS de storage.objects está ativo; apenas INSERT de avatar de entregador possui policy. Uploads diretos de imagens de produtos, assets de loja, documentos e anexos não possuem permissão INSERT para cliente autenticado.

**Preparado no GitHub**: \`supabase/entregas-forward-migrations/20261108_storage_uploads_scoped_STAGE_ONLY.sql\`. O arquivo preserva \`avatars\`; fornece buckets idempotentes para novos ambientes, políticas restritas a gerente/proprietário, entregador autenticado e dono do chamado; limita leitura de documentos privados e exclusão aos vínculos apropriados. Não foi executado em qualquer banco.

**Validação indispensável antes da produção:**
1. Revisar o SQL em ambiente de homologação, confirmar permissões e parâmetros reais de \`storage.objects\`; verificar o caminho de todos os objetos existentes.
2. Testar upload e remoção de produto, logo, capa, documentos de loja e entregador e anexo de chamado com contas sintéticas distintas.
3. Testar como adversário: gerente da Loja A não grava/leitura/exclui na Loja B; entregador A não acessa B; cliente A não acessa chamado B; usuário sem login não insere nada; admins só leem documentação necessária.
4. Confirmar imagens públicas via \`getPublicUrl\` e URLs assinadas dos buckets privados.
5. Conferir política de retenção/auditoria de documentos, sem perda de anexos anteriores.
6. Aplicar migration somente após aprovação e janela controlada. **Nenhum DDL aplicado na produção por esta mudança.**

Teste de contrato estático: \`node --test scripts/qa/test-entregas-storage-rls-contract-v1.mjs\`; isto **não substitui** testes reais de RLS.
