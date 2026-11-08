# APOIS — Auditoria e correções Fase 2 (08/11/2026)

**Base:** `8a8b061569b01056ede9a1d00088773cfcd8097d`. **Escopo:** branch audit/continuacao-20261107. Código-fonte pinado dos submódulos permanece inalterado; correções da montagem são feitas por scripts idempotentes. Nenhum merge, migration aplicada em produção ou deploy manual.

## Correções de código implementadas

- APOIS-002: `build-motorista-module.mjs` e `build-partner-modules.sh` agora usam validação central da URL canônica Corridas (`tbbzkrfupmqdywnzgnms`) e rejeitam chave antiga/secretas; chaves opacas exigem teste real de autenticação. Testes em `scripts/qa/test-corridas-build-env-v1.mjs`.
- APOIS-003: `harden-entregas-support-legacy-route.mjs` transforma a rota antiga de conversa em redirect à rota com anexos e status coerentes, preservando ticketId. Conectado a Cliente e Parceiro; teste de idempotência presente.
- APOIS-004: `qa-visual/motorista-smoke-v2.mjs` e `scripts/qa/audit-visual-evidence-v1.mjs` impedem chamar screenshots iguais de telas distintas, e sinalizam rotas autenticadas sem teste.
- APOIS-006: `harden-entregas-merchant-image-mime.mjs` restringe upload e seletor de logo/capa a JPG, PNG e WEBP para corresponder aos buckets. Testes em `scripts/qa/test-entregas-merchant-image-mime-v1.mjs`.

## Políticas preparadas, **não aplicadas ao banco**

- APOIS-001: `supabase/entregas-forward-migrations/20261108_storage_uploads_scoped_STAGE_ONLY.sql`; políticas privadas de upload/leitura/exclusão por titular para fotos, assets, documentos e anexos. Teste de contrato em `scripts/qa/test-entregas-storage-rls-contract-v1.mjs`.
- APOIS-007: `supabase/entregas-forward-migrations/20261108_customer_avatar_upsert_scoped_STAGE_ONLY.sql`; permite `INSERT/SELECT/UPDATE` estritamente para `auth.uid()/avatar` do cliente, sem alterar política do entregador. Teste em `scripts/qa/test-entregas-customer-avatar-upsert-v1.mjs`.

**Verificação de backend:** Supabase Entregas produção (`ptgkwyyolrdgnqketkjj`) continua com uma única policy `INSERT` de avatar Entregador; assim, uploads e substituição de avatar permanecem impedidos em produção até teste em homologação e aplicação aprovada. `customer-support` e `add_support_message` validam vinculação do chamado e dos anexos segundo suas implementações atuais.

## Pendências NÃO homologadas

- D-004/D-005 (Motorista: cadastro em branco, histórico instável): não declarar corrigidos sem teste em navegador/APK com sessão adequada.
- Auditoria visual: 15 rotas com `h-screen` e rolagem interna, requerem teste real de teclado/viewport antes de alterar CSS. Screenshots antigos com blobs repetidos são evidência insuficiente.
- API de login Supabase Corridas, mapas, push, assinaturas, financeiro Safe2Pay, rotas autenticadas e painéis Vercel: exigir fluxos integrados e testes adversariais com contas sintéticas.
- Deploy Vercel `READY` significa build publicado em preview, não homologação funcional.
- Nenhum `node --test`, teste Android físico, execução de migrations ou teste Playwright autenticado ocorreu nesta sessão. Inspeções estáticas foram realizadas; não substituir pela execução real.

**Próxima prioridade técnica:** validar SQL de Storage em projeto isolado com duas contas e negar acessos cruzados; resolver D-004/D-005 com logs de render e sessão; medir visual final e confrontar painel de produção com commits oficiais. Sem alterações destrutivas e sem enviar pagamentos reais.
