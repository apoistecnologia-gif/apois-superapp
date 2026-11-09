# APOIS — Matriz geral consolidada (34 achados, 08/11/2026)

**Base executora:** apoistecnologia-gif/apois-superapp, branch audit/continuacao-20261107.
**Referências:** Relatório 01, Relatório 02, auditoria/CODEX-MATRIZ-CONSOLIDADA.md, auditoria/CODEX-RELATORIO02-EXECUCAO-20261108.md.
**Não substituir:** mantém 20 achados da fase 1; inclui 14 da fase 2; nenhum encerrado por aparecer outro relatório.

## Semântica de status
A = corrigido, build e E2E validados; B = correção implementada no código, sem homologação integral; C = correção parcial; D = confirmado, ainda não corrigido; E = risco/impacto/versão a comprovar; G = depende de produção, autorização externa ou staging.

| ID | Prioridade | Área | Estado | Síntese e aceite restante |
|---|---|---|---|---|
| INV-001 | P2 | Entregas | B | Edge `customer-support` v12 publicada: ação `detail` por ID e dono, RLS e filtro de mensagens internas confirmados, `list/create/message` preservadas. Tela canônica patchada via builder; falta compilação, deploy web/mobile e E2E 51+ e IDOR. |
| INV-002 | P1 | Corridas | B | Troca de protocolo protegida contra resposta antiga; E2E pendente |
| INV-003 | P1 | Corridas | B | Rascunho/arquivos isolados por protocolo; E2E pendente |
| INV-004 | P1 | Corridas | B | Upload reconciliado por arquivo; verificar Storage real |
| INV-005 | P2 | Corridas | C | Recuperação de falha RPC implementada; órfãos antigos pendentes |
| INV-006 | P1 | Corridas | B | Botão de ocorrência legível no código; Android pendente |
| INV-007 | P1 | Corridas | B | Link para protocolos no histórico atual; navegação real pendente |
| INV-008 | P1 | Entregas | B | Credencial fora de argv/log; build real com token sintético pendente |
| INV-009 | P0 | Entregas financeiro | B | Migração `apois_inv009_restrict_financial_settle_direct_execute_20261108` aplicada e ACL verificada no banco: `anon=false`, `authenticated=false`, `service_role=true`; faltam testes de operação autenticada/integração financeira (não reaplicar). |
| INV-010 | P1 | Pagamentos | G | Gate Safe2Pay/regras de pagamento eletrônico pendente |
| INV-011 | P2 | Testes | C | Gates expandidos, falta comportamento autenticado |
| INV-012 | P2 | Entregas build | C | Builder do estabelecimento agora impede release com `bun.lock` divergente, instalação frozen ou lint falhos; fallback somente fixture local mediante opt-in, nunca Vercel/CI. Snapshot pinado ainda não contém `@capacitor/app` e `@capacitor/browser` no lock (79 dependências declaradas vs 77). Falta reconciliar lock e compilar. |
| INV-013 | P2 | Entregas | B | Gerador de histórico paginado por cursor `(created_at,id)` em páginas de 30, owner scoped, Realtime e deduplicação, conectado aos dois builders. Teste TEMP/ROLLBACK percorreu 105 pedidos sintéticos com timestamps iguais e inserção recente, sem duplicar, ignorando 13 pedidos da outra conta; ainda faltam typecheck, build e UI 51+. |
| INV-014 | P2 | Entregas | E | Avatar cache URL fixa; confirmar regressão |
| INV-015 | P2 | Entregas | E | Imagem de produto órfã após falha do update; confirmar fonte final |
| INV-016 | P2 | Corridas | B | Anexo sem URL mostra erro/retentativa; homologação pendente |
| INV-017 | P2 | Supabase | G | Proteção contra senhas vazadas depende de configuração/testes |
| INV-018 | P2 | Supabase Entregas e Corridas | C | Entregas: 113 RPCs `SECURITY DEFINER` com `anon EXECUTE` inicialmente, 26 ACLs reduzidas (20 admin e 6 internas), restam 87. Corridas: 84 inicialmente, ACL de 12 ações administrativas e 3 RPCs financeiras service-role corrigida e verificada, restam 69. Migrações aplicadas com testes rollback de ACL; nenhuma operação financeira executada. As 156 RPCs remanescentes somadas exigem classificação por privilégio/chamador; contagem não equivale a vulnerabilidades comprovadas. |
| INV-019 | P1 | Vercel | E | Aliases/previews demandam identificação do commit em publicação |
| INV-020 | P2 | Entregas financeiro | B | Migração `apois_inv020_settlement_notification_mojibake_fix_20261108` aplicada após simulação rollback. Literal corrigido, ACL INV-009 preservada; não altera lançamento/valor, falta E2E e histórico. |
| INV-021 | P1 | Corridas carteira | B | DOMAIN ID e hardener Auth ligados à montagem; teste real pendente |
| INV-022 | P2 | Entregas busca | B | Lojas não dependem dos 40 produtos exibidos |
| INV-023 | P2 | Entregas busca | B | Coordenada ausente não vira 0,0; zero explícito preservado |
| INV-024 | P1 | Entregas horários | B | RPC autoritativa aplicada e conectores de Home/Busca/Estabelecimento versionados; função SQL atual clonada para `pg_temp` e testada em 16 casos sintéticos com rollback (24h, madrugada, Recife/Nova York, cidade inativa, fechamento temporário, datas especiais, 2º turno), todos aprovados. Falta E2E UI, realtime e Android. |
| INV-025 | P1 | Admin Corridas | B | Período relativo recalculado a cada Atualizar |
| INV-026 | P1 | Admin Entregas | B | Draft ligado à cidade e respostas A/B isoladas; RPC real pendente |
| INV-027 | P1 | Admin Entregas | B | Centro vazio/fora da faixa rejeitado antes da RPC |
| INV-028 | P2 | Login publicado | E | Contraste de deployment não atribuído à fonte pinada |
| INV-029 | P2 | Login Entregas | B | 44px toque no snapshot; publicação ainda não homologada |
| INV-030 | P2 | Login Entregas | B | IDs/htmlFor/name em ambas variantes do snapshot |
| INV-031 | P1 cond. | Promoções | C | Geradores client e SQL versionados; revisão de elegibilidade produto+categoria e limite com cancelamento sem pagamento; 9 casos SQL sintéticos em TEMP/ROLLBACK passaram. Migração **não aplicada**, sem E2E, sem desconto/cobrança real. Consentimento cliente quando preço do backend diverge em ambos os sentidos. |
| INV-032 | P2 | Cupons | B | Falha de leitura não aparenta zero nem permite exclusão |
| INV-033 | P2 | Sacola | C | Novo addItem atualiza preço; gerador de sacola persistida consulta produtos/opções e sinaliza indisponibilidade; checkout confere total autoritativo. Falta typecheck, testar falha de rede durante revalidação, reabertura e dispositivo. |
| INV-034 | P1 cond. | Trigger QA | B | Migração `apois_inv034_qa_order_guard_null_safe_20261108` aplicada no Supabase Entregas; trigger `apois_qa_never_real_payment` ativo e função NULL-safe confirmada. Testes reais de âncora ausente/renomeada e fluxos QA ainda pendentes. |

## Total geral
- A: 0 (nenhuma feature pronta apenas por presença de interface ou teste isolado).
- B: 22 — correções implementadas e/ou aplicadas, sem homologação integral do produto.
- C: 6 — medidas parciais, inclusive promoções mantidas desativadas e lock ainda incompatível.
- D: 0 — não restou item sem remediação alguma; os bloqueios continuam classificados como parciais, condicionais ou externos.
- E: 4 — evidência/versão ainda a comprovar.
- G: 2 — bloqueios externos ou de configuração.
- Soma conferida: 0 + 22 + 6 + 0 + 4 + 2 = 34.
- Total: 34.

**Estado de produção em 08/11/2026:** as migrações INV-009, INV-034, INV-024 e o reforço parcial INV-018 foram confirmadas aplicadas no Supabase Entregas (`ptgkwyyolrdgnqketkjj`). INV-009 deixou de ser bloqueio por ACL de execução direta; **INV-031 permanece NÃO APLICADA**. Não declarar produção homologada: restam E2E de pagamento, permissões e apps. Nenhum pagamento real foi efetuado nesta continuação.

**Homologação obrigatória:** preservar AUTH/DOMAIN IDs, checkout/preço server-side, upload privado e permissões, operações diretas/manuais, identidade visual aprovada e os três pins; testar end-to-end antes de release.

## Evidências adicionais desta continuação — 08/11/2026

- HEAD inicial verificado no GitHub: `8a87a091ccc32b0f4368779426109e6a199c16e5`, branch `audit/continuacao-20261107`; fontes pinadas permanecem intocadas.
- **Produção / publicado no banco:** migrações em `supabase_migrations.schema_migrations`: INV-009, INV-034, INV-024. INV-018 aplicada em duas migrações: `apois_inv018_restrict_anon_admin_rpc_execute_20261108` (20 admin, anon 0/auth 20/service 20) e `apois_inv018_restrict_service_only_dispatch_rpc_execute_20261108` (6 RPCs internas, anon 0/auth 0/service 6). Exposição anônima de SECURITY DEFINER caiu de 113 para 87. São alterações reais de banco, não publicação de aplicativo.
- **Implementado em GitHub, sem APK/deploy:** versão de promoções mais restrita (produto E categoria quando ambos definidos), limite de usos que desconsidera pedido cancelado sem pagamento, badge âmbar da marca, confirmação explícita de **qualquer** discrepância no total servidor versus tela antes de gerar PIX, verificador de integridade atualizado.
- **Testado:** migração promocional compilada com `BEGIN/ROLLBACK`; função da migração clonada para `pg_temp` e exercitada em 9 pedidos e promoções sintéticos, com 9 asserções de desconto/total e 5 resgates únicos. Todas passaram, sem escrita persistente em pedidos reais. ACL INV-018 testada em `BEGIN/ROLLBACK` para cada lote (20 RPCs administrativas e 6 internas) e verificada após ambas as aplicações; sem manipular notificações ou pagamentos reais. Migração de promoções ainda ausente do catálogo de produção.
- **Não realizado:** instalação de dependências, typecheck completo, lint, testes full, build completo, E2E autenticado de pagamentos, Android físico, implantação Vercel. `INV-028` não pode ser atribuída com segurança a commit: listagem de deploys Vercel retornou HTTP 403 para projetos relevantes; nenhuma alteração especulativa de contraste foi feita.
- **Permanecem pendentes:** demais `SECURITY DEFINER` executáveis por anon, lock ainda incompatível no `INV-012` e os E2E de `INV-001`, `INV-013` e `INV-020`, contrato Safe2Pay, validações de regressão de horários/sacola/cupons/carteira/login/cobertura e bloqueios do Relatório 01. O estágio `A` requer E2E e release validados.

**Complemento de segurança INV-018 (08/11/2026):** a Edge Function pinada `dispatch-push-outbox` utiliza `SUPABASE_SERVICE_ROLE_KEY` para `claim_notification_push_batch_v2` e `verify_push_dispatch_runtime_key`. As funções `claim_notification_push_batch`, `claim_notification_push_batch_v2`, `enqueue_notification`, `verify_push_dispatch_key`, `verify_push_dispatch_runtime_key` e `verify_payout_dispatch_runtime_key` passaram a exigir exclusivamente `service_role`. Contrato ACL testado em transação revertida e confirmado após migração. Permanecem 87 RPCs SECURITY DEFINER com EXECUTE de `anon`; isso é superfície pendente de classificação, não confirmação de exploração.

**INV-001, backend publicado parcialmente:** Edge `customer-support` de produção (`ptgkwyyolrdgnqketkjj`) comparada byte a byte ao snapshot pinado: era idêntica antes da mudança (6.067 caracteres). Versão 11→12 (`verify_jwt=true`), action `detail` por UUID, filtro `requester_user_id = authData.user.id`, RLS ativo e mensagens internas excluídas; ações existentes preservadas. UI conectada aos dois builders por `fix-entregas-support-ticket-detail-v1.mjs`; não houve build/deploy do cliente. Faltam E2E com 51+ chamados, sessões de clientes A/B e anexos.

**INV-020, produção corrigida:** migração `apois_inv020_settlement_notification_mojibake_fix_20261108` trocou exclusivamente o literal de notificação do settlement (derivado do corpo atual por `pg_get_functiondef`) após `BEGIN/ROLLBACK`. String final `Repasse do pedido liberado após conclusão` confirmada, ACL `anon=false,authenticated=false,service_role=true` preservada; nenhum lançamento realizado. Textos históricos e outras funções com mojibake não foram alterados.

**Validação isolada INV-024 — 16/16 casos aprovados:** o corpo **vivo** de `public.merchant_accepting_orders(uuid,timestamptz)` foi obtido via `pg_get_functiondef`, clonado como `pg_temp.merchant_accepting_orders_test` com referências somente a tabelas temporárias de estabelecimentos/cidades/horários. Transação `BEGIN/ROLLBACK` avaliou: 24h em dois horários; fechamento temporário; cidade inativa; turno atravessando a meia-noite (antes/depois do encerramento); exceção de data fechada; hora local Recife aberta/fechada; Nova York aberta/fechada no mesmo dia UTC; segundo intervalo e intervalo de pausa; exceção de data com horário especial antes/durante; cadastro não aprovado. Assert SQL `16/16` sem falha. Não houve mutação persistente do catálogo nem teste de tela ou acesso anônimo. 

## Continuação complementar — INV-012, INV-013 e INV-033 (08/11/2026)

**INV-012:** inspeção comparativa do snapshot Entregas pinado demonstrou 79 dependências declaradas no `package.json` e 77 no `bun.lock`; faltam `@capacitor/app@8.0.0` e `@capacitor/browser@8.0.0` (usadas pelo login Google). Nenhum snapshot ou lock foi reescrito sem resolver os pacotes. Criado o validador `scripts/verify-entregas-bun-lock-v1.mjs` e cinco casos unitários `scripts/qa/test-entregas-bun-lock-v1.test.mjs`, ainda não executados em Node no checkout real. O build de estabelecimento passa a abortar release se o manifesto/lock divergir, frozen install falhar ou lint falhar; o bypass de dependência é permitido apenas como fixture de QA local com opt-in explícito, impossível em Vercel/CI. Ainda falta reconciliar lock em ambiente controlado e comprovar build.

**INV-013:** gerador `scripts/fix-entregas-customer-orders-pagination-v1.mjs` integrado em ambos os builders de Entregas. A consulta anterior buscava a lista inteira, sujeita ao limite padrão; a nova implementação busca 31 para exibir 30 por página, ordena por `created_at DESC,id DESC`, usa cursor duplo, isola por `customer_user_id`, deduplica ao carregar mais e preserva registros históricos carregados após refresh Realtime. Teste SQL TEMP/ROLLBACK executado: 105 pedidos de usuário A, 13 de usuário B, timestamps repetidos e novo pedido após primeira página; retornou 105/105 únicos em quatro páginas sem vazamento. Não houve deploy nem execução de UI/SDK PostgREST real.

**INV-033:** reparo do validador de sacola persistida: `refreshCartCatalog` retorna `Promise<boolean>`; erros de rede e alterações de preço/categoria/opções impedem checkout até uma nova revisão; produto de outro estabelecimento é considerado inválido. Checagem ocorre antes de `create-order` e da criação do PIX. As garantias foram adicionadas ao verificador textual, mas **não executadas no cliente compilado**; não confundir com homologação.

**Complemento INV-018 — Corridas (08/11/2026):** no Supabase `tbbzkrfupmqdywnzgnms`, 84 funções `public SECURITY DEFINER` eram executáveis por `anon`. A migração `apois_corridas_inv018_restrict_admin_pix_financial_rpc_execute_20261108`, versionada em `supabase/corridas-forward-migrations/20261108_inv018_restrict_admin_pix_financial_rpc_execute.sql`, restringiu `anon` em 12 funções administrativas (exceto `admin_is_authorized`, preservada por compatibilidade) e restringiu `anon/authenticated` em 3 RPCs que já exigiam `service_role`: `activate_prepaid_pix_ride`, `claim_prepaid_pix_initial_dispatch`, `reverse_refunded_ride_payment`. Teste `BEGIN/ROLLBACK`: total 15, anon 0, authenticated 12, service_role 15. Aplicação em produção registrada em `supabase_migrations.schema_migrations` e ACL verificada novamente com contagens idênticas. Restam 69 funções `SECURITY DEFINER` com `anon EXECUTE` em Corridas (15 delas triggers), além de 87 em Entregas; inventários separados `auditoria/CODEX-INV018-CORRIDAS-RPCS-20261108.md` e `auditoria/CODEX-INV018-RPCS-PRIVILEGIADAS-20261108.md`. Sem alterar políticas de negócio, contas, dinheiro ou saldo.
