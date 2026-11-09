# APOIS — Relatório 14 | Autorização de ocorrências após troca de motorista

**Data:** 09/11/2026. **Entrada:** `RELATORIO-14-APOIS-AUTORIZACAO-DE-OCORRENCIAS-20261109(1).md`. **Novo achado:** INV-067 (P1 — fronteira de autorização).  
**Repositório autorizado para escrita:** `apoistecnologia-gif/apois-superapp`, branch **`audit/continuacao-20261107`**. A branch `audit/ecossistema-20261107` citada pelo auditor não foi modificada.  
**Supabase Corridas inspecionado SOMENTE em leitura:** `tbbzkrfupmqdywnzgnms`. **Nenhuma migração, solicitação, operação, login, arquivo ou dado de ocorrência real foi acessado, criado ou alterado.**

## 1. Ponto de retomada verificado

Consulta direta ao GitHub:
- `.apois/source-lock.json`, SHA blob `3f98789f28666ccc052175db10f138208dd0937b`, **inalterado**. Snapshots: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- `auditoria/CODEX-RELATORIO13-EXECUCAO-20261109.md` e `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` confirmaram **66 achados anteriores**, A 0 / B 46 / C 16 / D 0 / E 1 / G 3.
- `scripts/harden-corridas-case-center-v1.mjs`, blob `43710296d471d8a362411dee85253202e91da335`, gera a Central de Ocorrências que usa `apois_open_ride_case`, `apois_case_reply`, `apois_case_register_evidence`, SELECT de ticket/eventos/evidências e Storage assinado. A antiga Edge `passenger-support` não é dependência desse caminho. **Não redesenhar a UI nem criar suporte paralelo.**

A comparação com o banco veio de **SELECTs de catálogo**, não de tickets, conteúdos ou perfis reais. Definições e políticas verificadas em 09/11/2026:

| Objeto | Estado implantado antes da correção |
|---|---|
| `public.apois_request_driver_statement(uuid)` | `SECURITY DEFINER`, staff com `private.has_permission('support.read')`, bloqueia caso encerrado, tranca ticket (`FOR UPDATE`); grava apenas `driver_response_requested_at` e `driver_response_requested_by` (este é o solicitante da equipe), e evento de status. **Não fixa destinatário**. |
| `public.apois_case_access(uuid)` | `SECURITY DEFINER`, preserva `staff`, `passenger`, `none`; concede `driver` quando `driver_response_requested_at IS NOT NULL` e `rides.driver_id` **atual** corresponde a `drivers.user_id=mobility_user_id()`. |
| SELECT `passenger_support_tickets` | Política `apois case ticket linked driver read` concede o mesmo acesso pelo `rides.driver_id` atual. Outras políticas de passageiro proprietário e staff independentes. |
| SELECT `apois_case_events` | `staff` lê também eventos internos; `passenger/driver` apenas quando `visible_to_parties`. CHECK de `internal_note` exige visibilidade falsa. |
| SELECT `apois_case_evidence` | Metadados usam `apois_case_access(ticket_id)`. |
| `storage.objects` do bucket `apois-case-evidence` | Políticas separadas SELECT e INSERT para `authenticated` usam `apois_case_access`, checam bucket e formato de caminho; outras políticas Storage consultadas eram restritas a outros buckets. |
| `apois_case_reply` e `apois_case_register_evidence` | Chamam `apois_case_access` e preservam caso `open/in_progress`, tamanho/mime e demais validações. |
| Permissão de suporte no catálogo | A única chave `support.*` observada em `public.role_permissions` foi `support.read`. |

As funções existentes de caso consultadas pertencem a `postgres`, com `authenticated` e `service_role` no ACL; o uso de `SECURITY DEFINER` com `search_path` vazio foi observado antes de preparar qualquer nova definição.

## 2. INV-067 — causa e consequência

O vínculo entre o ticket e seu motorista era calculado **na hora da leitura**, consultando a atribuição operacional atual da corrida. No cenário A→B, a mesma solicitação de esclarecimentos e o mesmo ticket passam a conceder acesso a B sem convite específico e retiram o acesso de A. O risco abrange ticket, resposta, eventos visíveis, metadados de evidência e acesso aos objetos Storage, pois a função `apois_case_access` alimenta essas camadas.

**Alcance da prova:** conferência das funções e políticas **implantadas** e modelagem lógica com identidades sintéticas. Não houve exploração, leitura de relato, download de objeto privado, simulação de autenticação PostgreSQL como A/B ou incidente real observado. Links assinados já emitidos podem continuar válidos até a expiração, mesmo após uma futura revogação.

## 3. Correção preparada, NÃO APLICADA

Arquivo de migração versionado exclusivamente no GitHub:

`supabase/corridas-forward-migrations/20261109_report14_case_driver_participants_QA_NOT_APPLIED.sql`

A migração está **marcada QA_NOT_APPLIED, não foi executada**, não tem backfill e contém guardas de catálogo que abortam se detectar mudanças imprevistas nas funções, na política direta do ticket ou nas políticas de eventos, evidências e Storage.

### Identidade e autorização

1. Cria `public.apois_case_driver_participants`: registro **por ticket e usuário de motorista**, com `driver_id` e `driver_user_id` capturados, quem concedeu, data, motivo e possível revogação. Registros antigos de concessões revogadas são conservados (ID próprio e índice único parcial para **convite ativo**). Habilita RLS e revoga acesso direto de `PUBLIC`, `anon` e `authenticated`; não cria políticas permissivas para a tabela.
2. Altera `apois_request_driver_statement` mantendo a permissão administrativa existente, o ticket bloqueado, estados, requisitante e evento. Antes da confirmação da solicitação, bloqueia também as linhas da atribuição operacional e do perfil motorista (`FOR SHARE OF r,d`) e registra o destinatário A na tabela de participantes **dentro da mesma transação**. A partir daí, uma futura alteração de `rides.driver_id` não muda o registro convidado.
3. Altera `apois_case_access` para conceder papel `driver` **somente** se o ticket tiver solicitação anterior e houver participante ativo com `driver_user_id=mobility_user_id()`. Mantém `none`, staff e passageiro proprietário.
4. Substitui **somente** a política SELECT direta de motorista no ticket por `USING (public.apois_case_access(id) = 'driver')`, alinhando-a à função que já rege respostas, evidência e bucket. As políticas de staff/passageiro, eventos internos, evidências e Storage **não são removidas ou ampliadas**.
5. Adiciona operações administrativas **expressas, autenticadas e auditadas**, de concessão e revogação de participante. Exigem `private.has_permission('support.read')`, motivo (16–500 caracteres), ticket elegível para concessão, motorista existente e evento `internal_note` com `visible_to_parties=FALSE`. Uma concessão duplicada de participante ativo é recusada; nova concessão após revogação cria **outra linha**, sem sobrescrever a trilha anterior. Os RPCs novos revogam `EXECUTE` de `PUBLIC`/`anon`, com `authenticated` sujeito ao cheque administrativo no corpo.
6. **Casos legados:** não escolhe automaticamente o motorista atual nem reatribui A pela intuição. Um ticket com solicitação antiga e **nenhum participante registrado** fica sem acesso de motorista até **triagem manual auditada**. Staff/passageiro retêm o acesso original. Repetir `apois_request_driver_statement` não atribui o motorista B de um caso legado.

**Atenção antes da implantação:** a única permissão administrativa de suporte confirmada foi `support.read`, já usada pela RPC existente de solicitação. A nova RPC de concessão manual possui alcance maior (pode adicionar um motorista indicado pelo staff, com justificativa). A segregação de funções, quem pode conceder acesso e eventual futura permissão mais específica **precisam de aprovação de segurança** antes de aplicar SQL; não foi inventada uma chave `support.manage` inexistente no catálogo. A documentação Supabase recomenda tratamento rigoroso de `SECURITY DEFINER` em esquemas expostos; as RPCs novas são candidatas a revisão para movê-las a esquema não exposto e oferecer uma camada de integração administrativa apropriada. Esta questão mantém a fase como **preparatória**, não implantação liberada.

### Reversão segura preparada

`supabase/corridas-forward-migrations/20261109_report14_case_driver_participants_EMERGENCY_FAIL_CLOSED_ROLLBACK_QA_NOT_APPLIED.sql`

É um **procedimento de contenção emergencial**, também **NÃO APLICADO**: se a migração principal fosse instalada e revelasse defeito, o arquivo preservaria acesso de staff e passageiro, retornaria `none` para todos os motoristas, restringiria a política do ticket com `USING (false)`, revogaria os RPCs novos de `authenticated` e **não excluiria a tabela, eventos ou trilha de auditoria**. Não é retorno ao predicado inseguro `rides.driver_id`; restaurar legitimamente o acesso de motorista exigiria nova migração revisada. Mesmo essa contenção não invalida automaticamente URLs já assinadas, que dependem de expiração/controlos adicionais.

## 4. Testes e resultados reais

**Foram efetuadas consultas somente de catálogo**, para definições de 6 RPCs, colunas e constraints das 3 tabelas principais, políticas RLS SELECT dos tickets, eventos e metadados, políticas INSERT/SELECT do bucket de evidência, ACLs de funções e chave administrativa de permissão. Nenhuma operação `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, execução das RPCs administrativas ou leitura de linhas de chamados foi enviada ao Supabase.

**V8 isolado**: 12/12 testes de contrato/modelo criados em `scripts/qa/test-report14-case-driver-participants-v1.test.mjs` executados com SQL versionado e identidades sintéticas, mais 8/8 checagens adicionais de migração/rollback. **Total 20 PASS / 0 FAIL.** Cenários: A continua autorizado após A→B, B não herda, B incluído apenas por convite explícito, revogação de A, terceiro negado, passageiro/staff preservados, caso legado sem destinatário fechado para motoristas, evento interno staff-only, RLS/bucket usando a mesma função; requisitos formais de lock, trilha de auditoria e corte seguro. **O modelo não executou SQL nem RLS PostgreSQL.**

**Não executados:** `node --test` no checkout completo, parser PostgreSQL de toda a migração, aplicação em staging, sessões reais A/B, `pgTAP`, autorização de Storage efetiva, concorrência A→B sob locks, solicitação/resposta real, links assinados e expiração, tratamento operacional de legados, Android, APK, merge, produção, deploy ou migrations. Não existe homologação real de segurança.

### Roteiro de aceite em homologação controlada

- Instalar migração **somente em ambiente de teste**, após revisar privilégios, contratos, triggers e eventual esquema não exposto para novos RPCs.
- Criar ticket com passageiro sintético, motorista A associado e staff com permissão; solicitar esclarecimento e conferir participante A, `driver_response_requested_by` apontando **staff** e evento de status visível.
- Reatribuir corrida controlada a B; testar SELECT de ticket, SELECT de eventos visíveis/internos, SELECT de metadados, obtenção de URL assinada, upload/registro de evidência e `apois_case_reply` por A, B, passageiro, staff e terceiro. B deve ser negado até inclusão administrativa auditada; notas internas nunca chegam a A/B/passageiro.
- Conceder B explicitamente com justificativa, conferir evento interno, revogar A e repetir todos os testes, inclusive URLs já emitidas até expiração.
- Testar corrida alterada enquanto solicitação segura lock, ticket fechado, usuário eliminado, legado com destinatário desconhecido, duplicação e revogação repetida, erros de autenticação e reversão de contenção.
- Antes de produção, resolver critério de permissão de concessão manual e plano auditado para legados; não fazer backfill pela atribuição atual.

## 5. Arquivos e reversibilidade

| Artefato | Estado |
|---|---|
| `supabase/corridas-forward-migrations/20261109_report14_case_driver_participants_QA_NOT_APPLIED.sql` | **Criado, NÃO APLICADO.** |
| `supabase/corridas-forward-migrations/20261109_report14_case_driver_participants_EMERGENCY_FAIL_CLOSED_ROLLBACK_QA_NOT_APPLIED.sql` | **Criado, NÃO APLICADO.** |
| `scripts/qa/test-report14-case-driver-participants-v1.test.mjs` | **Criado.** A suíte foi exercitada em V8, não no runner Node do checkout. |
| `auditoria/CODEX-RELATORIO14-EXECUCAO-20261109.md` | **Criado.** |
| `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` | Atualizar somente INV-067 e os totais. |

Não foi alterado `scripts/build-isolated-module.mjs`: um teste sintético de SQL não equivale à validação do backend e **não deve dar falsa liberação de build**. O cliente de ocorrências e a UI não foram modificados, pois a causa reside na autorização persistida.

## 6. Consolidação e classificação

**INV-067 = C (correção preparada, NÃO implantada).** Não é B porque a política/funcão problemática ainda permanece no Supabase de produção e a fronteira de acesso continua vulnerável até uma migração aprovada e testada. **Sem declaração de correção efetiva no banco.**

**66 achados anteriores intactos + INV-067 = 67 achados: A 0 / B 46 / C 17 / D 0 / E 1 / G 3.**

Permanecem também as pendências anteriores: INV-054 G, INV-055 C, INV-056 C, INV-061 C (migração de exclusão igualmente `QA_NOT_APPLIED`), e demais bloqueios não homologados. **NÃO publicar, gerar APK, aplicar SQL ou fazer merge** até a autorização expressa para a fase final: **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
