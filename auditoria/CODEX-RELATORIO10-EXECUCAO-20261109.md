# APOIS — Relatório 10 | Exclusão de conta de Corridas

**Data:** 09/11/2026. **Relatório recebido:** `RELATORIO-10-APOIS-EXCLUSAO-DE-CONTA-20261108.md` (08/11/2026).  
**Integrador autorizado:** `apoistecnologia-gif/apois-superapp` · **`audit/continuacao-20261107`**. O ramo de investigação `audit/ecossistema-20261107` citado no relatório **não** foi usado para gravações.  
**Sem APK, homologação física, publicação, deploy, merge ou exclusão de conta.**

## 1. Continuidade e locks verificados

Antes das alterações, a branch foi consultada diretamente:
- `.apois/source-lock.json` inalterado: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- `auditoria/CODEX-RELATORIO09-EXECUCAO-20261109.md` confirma execução do Relatório 09 e mantém o limite sem build/Android.
- `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` encerra a fase 09 com **60 achados**: A 0, B 41, C 15, D 0, E 1 e G 3. Nome histórico da matriz mantido.
- Fonte Motorista `src/routes/motorista.configuracoes.tsx` inspecionada no commit pinado, incluindo o caminho legado que o gerador v4 já substitui. O gerador v4 existente e seu verificador são invocados no `scripts/build-partner-release.sh`, em sequência já registrada.
- `scripts/harden-corridas-profile-account-deletion.mjs` e `scripts/templates/PassengerAccountDeletion.tsx` conferidos; confirmação `EXCLUIR`, RPC autenticada, soft deletion e filtro `deleted_at` preservados.

Nenhum arquivo da `main`, dos repositórios-fonte protegidos ou dos ambientes de Entregas foi alterado.

## 2. INV-061 — P1 — corrida procurar_motorista não bloqueia exclusão

**Estado: C — correção SQL preparada, NÃO IMPLANTADA.**

### Evidência real antes da correção

Consultado **somente para leitura**, no Supabase Corridas `tbbzkrfupmqdywnzgnms`, o `pg_get_functiondef` de:
- `public.request_own_account_deletion()` — wrapper `SECURITY DEFINER`;
- `apois_rpc_private.request_own_account_deletion()` — função privada `SECURITY DEFINER`, com `auth.uid()`, resolução de `public.users`, `FOR UPDATE`, localização de `public.drivers`, bloqueio de `public.rides`, `users.deleted_at` e `public.audit_logs`.

A lista implantada bloqueia `aguardando_pagamento`, `solicitada`, `requested`, `buscando_motorista`, `searching`, `motorista_a_caminho`, `motorista_chegou`, `em_viagem`, `active`, `accepted`, `in_progress` e `started`. **Não contém `procurar_motorista`.** Não houve chamada da RPC, transação de exclusão ou modificação de perfil.

### Alteração preparada

Novo arquivo:
`supabase/corridas-forward-migrations/20261109_report10_account_deletion_search_guard_QA_NOT_APPLIED.sql`

O SQL consulta a definição vigente **quando e somente quando for executado mediante autorização posterior**, valida os elementos essenciais da função, exige correspondência exata e única da lista antiga e usa `CREATE OR REPLACE` da definição extraída para acrescentar exclusivamente `procurar_motorista`. Não modifica `public.request_own_account_deletion`, não altera autorizações, identidade derivada, soft deletion, auditoria, driver offline ou demais estados. Se a definição divergir, falha sem tentar adaptar por aproximação. A migração está claramente marcada **QA_NOT_APPLIED** e **não foi executada**.

**Limites técnicos:** incluir o estado canônico resolve a lacuna do predicado após implantação, mas **não comprova atomicidade** com criação/aceite concorrente de corrida. Exige testes transacionais em staging sob perfis sintéticos; não inferir correção de corrida agendada nem decidir política não documentada. A rotina viva continua omissa até implantação autorizada.

## 3. INV-062 — P2 — aviso de exclusão ao Motorista não esclarece a conta compartilhada

**Estado: B — correção versionada no gerador, sem homologação integral.**

Arquivo alterado:
`scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs`

O modal já preparado preservou título, estilo, texto de confirmação, fechamento sem mutação, entrada `EXCLUIR`, RPC com `auth.uid()`, exigência de retorno `ok` e navegação para login após confirmação.

**Antes:** o texto específico dizia apenas que o uso do perfil APOIS Motorista seria impedido. Porém a RPC marca `public.users.deleted_at`, compartilhado com o perfil Passageiro de Corridas, cujo carregamento exige `deleted_at is null`.

**Depois:** o aviso explica inequivocamente que a solicitação é da **conta APOIS Corridas compartilhada pelos perfis Motorista e Passageiro**, e que, após confirmação no servidor, o acesso a ambos deixa de funcionar mesmo para quem usa apenas um dos papéis. Explica que a operação registra uma solicitação e **não** apaga imediatamente todos os dados, sujeitos a retenções legais, segurança ou exercício de direitos. Não afirma impacto em Entregas e não implementa exclusão seletiva de papel. Mantém a identidade visual anterior.

Arquivo adicional atualizado:
`scripts/verify-partner-motorista-settings-ui-v4.mjs` — o verificador que já participa do builder agora rejeita a frase ambígua e exige a informação de dois papéis antes de aceitar o módulo.

## 4. Testes e limitações

### Executados, isolados e sem operações externas

**16/16 verificações em runtime JavaScript V8** usando o gerador v4 real contra uma cópia em memória do arquivo pinado e o SQL de migração comparado à definição realmente consultada via `pg_get_functiondef`, sem escrever no banco:
- fluxo de abertura do modal, exigência de `EXCLUIR`, chamada RPC a partir da confirmação, exigência de `data.ok`, ordem de logout/navegação e remoção de endpoint legado;
- aviso compartilhado, retenção e retirada da frase anterior;
- comparação textual estrita da definição viva com a âncora da migração;
- comprovada adição **apenas** de `procurar_motorista`, sem apagar aliases e sem bloquear `concluida/completed` ou `cancelada/cancelled` no predicado;
- marca explícita `QA_NOT_APPLIED`.

Houve uma primeira tentativa com três falhas do **roteiro de verificação** (recorte errado da ordem de navegação e decodificação incorreta do resultado da ferramenta SQL); a lógica de extração foi corrigida e os **16 casos foram repetidos, todos passando**. Essas falhas não demonstraram defeito no app e não são contabilizadas como aprovação automática.

### Preparado, NÃO executado no checkout completo

Novo teste Node versionado: `scripts/qa/test-report10-account-deletion-v1.test.mjs` com cinco testes de contrato/fixture sintética. **Não foi executado `node --test` contra o checkout materializado.**

**Não realizados:** builder real, typecheck, lint, build React/Android, mock integral dos triggers PostgreSQL, transações em staging, disputa de exclusão versus aceite/criação de corrida, exclusão de perfil, logout real, envio de e-mail, recuperação de senha, contas reais, APK, deploy, migração ou publicação.

## 5. Arquivos e commits

- **Criado:** `supabase/corridas-forward-migrations/20261109_report10_account_deletion_search_guard_QA_NOT_APPLIED.sql` — `2699ccabb9702a44c0dc65bb85d7b31fc63babc8`.
- **Modificado:** `scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs` — `9d7c91245336b41881e124566c915b5e22a856ce`.
- **Modificado:** `scripts/verify-partner-motorista-settings-ui-v4.mjs` — `df7bd680595b54a5682606218c1ec2092db702c9`.
- **Criado:** `scripts/qa/test-report10-account-deletion-v1.test.mjs` — `dc882ab38a1f1e1ae58d08028d4823299f807db3`; ajuste de localização de fixtures `d1d27dce589847303de69768dacc171bece35d2b`.
- **Criado:** este relatório.
- **Alterado:** atualização da matriz histórica acrescentando apenas INV-061 e INV-062.

A inserção do aviso utiliza o gerador v4 **já conectado ao builder**; não altera arquivos fonte fixados nem cria UI alternativa. O novo teste Node é um artefato de QA separado ainda não executado.

## 6. Riscos e reversão

- O RPC no Supabase de produção **permanece sem `procurar_motorista`** até autorização e implantação: INV-061 não é B e nem está resolvido no servidor.
- `FOR UPDATE` no usuário por si só não demonstra serialização com todas as operações de criação/aceite. A concorrência segue pendente.
- A migração deve ser revisada contra a versão viva e exercitada em banco isolado, não sobre perfis reais. Testes de conta compartilhada e sessões expiradas continuam para homologação final.
- Reverter o gerador/validador no branch desfaz a alteração de interface na próxima montagem. O SQL apenas versionado pode ser removido/revertido antes de publicação; **nenhum rollback de produção é necessário nesta execução**.
- INV-054 G, INV-055 C e INV-056 C permanecem inalterados. Nenhum `QA_NOT_APPLIED` foi implantado nesta fase.

## 7. Consolidação

**Novo Relatório 10:** INV-061 = C; INV-062 = B. Acrescentados **2** achados, sem reclassificar os 60 anteriores.

**Total 62:** **A 0 / B 42 / C 16 / D 0 / E 1 / G 3**.

Próximos relatórios podem ser recebidos, mas publicação, testes Android/APK e homologação física continuam bloqueados até a autorização expressa: **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
