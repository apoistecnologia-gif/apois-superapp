# APOIS — Matriz geral consolidada (51 achados, 09/11/2026)

> Histórico anterior integralmente preservado; os três novos achados estão na última seção.

# APOIS — Matriz geral consolidada (48 achados, 09/11/2026)

> Histórico de 43 itens preservado abaixo e cinco achados novos acrescentados ao final. Leia a última seção para o total atual.

# APOIS — Matriz geral consolidada (43 achados, 09/11/2026)

> Inclui a matriz histórica de 08/11/2026 integralmente, seguida dos nove novos achados e atualização de totais. O título interno da seção histórica abaixo continua refletindo os 34 achados daquela data.

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
| INV-012 | P2 | Entregas build | B | Gerador reconcile-entregas-bun-lock-v1.mjs corrige apenas na cópia .work as duas resoluções comprovadamente ausentes (@capacitor/app@8.0.0 e @capacitor/browser@8.0.0), com integridades SHA512 idênticas verificadas em cinco bun.lock públicos independentes, e bun install --frozen-lockfile obrigatório nos dois builders. Teste funcional puro V8 sobre manifesto/lock originais do pin: 0 diferenças após overlay, idempotência e 4/4 alterações inesperadas rejeitadas. Adicionada suíte Node de fixture ainda não executada no checkout completo. SEM execução do Bun frozen, typecheck, lint ou APK: não homologado. |
| INV-013 | P2 | Entregas | B | Gerador de histórico paginado por cursor `(created_at,id)` em páginas de 30, owner scoped, Realtime e deduplicação, conectado aos dois builders. Teste TEMP/ROLLBACK percorreu 105 pedidos sintéticos com timestamps iguais e inserção recente, sem duplicar, ignorando 13 pedidos da outra conta; ainda faltam typecheck, build e UI 51+. |
| INV-014 | P2 | Cliente Entregas avatar | B | Fonte usava URL fixa e upsert sem política própria. Gerador de avatar versionado conectado aos dois builders: URL única, MIME seguro, upsert=false e confirmação por leitura de profiles. Política INSERT restrita ao próprio UID em pasta customer-avatar, aplicada na produção. 6/6 casos de formato sintético aprovados. Faltam build, autenticação real e visual em duas telas/sessões; arquivos antigos preservados. |
| INV-015 | P2 | Estabelecimento / imagens | C | Confirmada ausência de política INSERT para product-images apesar do upload direto. Migração em produção restringiu novos arquivos a gerentes autorizados e produtos da loja; 6/6 formatos sintéticos passaram. Gerador de upload faz verificação de MIME e confirmação de update por leitura posterior. Falta build/upload autenticado; se o update realmente falhar, objeto novo pode permanecer órfão e exige reconciliação posterior segura. Nenhuma exclusão automática. |
| INV-016 | P2 | Corridas | B | Anexo sem URL mostra erro/retentativa; homologação pendente |
| INV-017 | P2 | Supabase | G | Proteção contra senhas vazadas depende de configuração/testes |
| INV-018 | P2 | Supabase Entregas e Corridas | C | Entregas: 113 SECURITY DEFINER com anon EXECUTE inicialmente, 26 ACLs reduzidas, restam 87. Corridas: 84 inicialmente, 12 funções administrativas, 3 financeiras e mais 3 operações de saque com ACLs reduzidas; restam **66**, pós-verificação do advisor. Migrações com BEGIN/ROLLBACK e checagem posterior sem efeitos financeiros. Ainda exige revisão das RPCs restantes por guarda/chamador, incluindo utilitários públicos; contagens não equivalem a falhas comprovadas. |
| INV-019 | P1 | Vercel / versão publicada | C | Vercel consultada com projectId sem teamId: domínio parceiros.apoisbrasil.com.br vinculado a deployment CLI de 27/10/2026 (`dpl_GT6JfV8dJ7MQrydb7Vo2MTde9G2r`), sem SHA Git. Preview Estabelecimento de 03/11 (`dpl_J6ozrdGUkkipCczc5Tp8pSLKhHuy`) aponta para fonte Entregas commit `ccd30fc03cc95119f702ceab27b85fd81e57c88d`, ramo `legal/novos-planos-assinatura-homolog-20261103`, diferente do snapshot pinado. Diferença entre versões confirmada; precisa build/publicação de artefato auditado e QA da URL sem alterar alias por presunção. |
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
- B: 24 — correções implementadas e/ou aplicadas, sem homologação integral do produto.
- C: 7 — medidas parciais, inclusive promoções mantidas desativadas, limpeza de órfãos pendente e versão publicada divergente.
- D: 0 — não restou item sem remediação alguma; os bloqueios continuam classificados como parciais, condicionais ou externos.
- E: 1 — evidência/versão ainda a comprovar.
- G: 2 — bloqueios externos ou de configuração.
- Soma conferida: 0 + 24 + 7 + 0 + 1 + 2 = 34.
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

## Continuação complementar — INV-012/014/015/033 (08/11/2026)

- INV-012: o módulo Entregas do Superapp passou a exigir instalação Bun frozen e validação explícita de manifesto/lock antes de montar o aplicativo. A divergência real de dois pacotes do login Google no snapshot pinado permanece e impede um release não reproduzível. Sem alteração dos pins.
- INV-033: mutações de sacola agora invalidam leituras concorrentes de catálogo e mistura de lojas rejeita o checkout.
- INV-013/014/015/033: cinco geradores reais aplicados em memória a seis arquivos pinados, sem falhas nem alteração da fonte; teste Node de workspace temporário incluído nos dois builders, ainda sem execução do checkout integral.
- INV-015: criada e aplicada apois_inv015_product_images_merchant_insert_20261108, política limitada a INSERT autenticado com proprietário/gerente ativo, produto, loja, extensão e caminho verificados. Antes não havia política para product-images. Simulação DDL com rollback e 6/6 formatos sintéticos confirmados; política relida após aplicação. Gerador do editor reconcilia resposta perdida do update. Sem exclusões.
- INV-014: criada e aplicada apois_inv014_customer_avatar_versioned_insert_20261108, política separada para avatar do próprio usuário em subpasta customer-avatar, sem sobreposição da política existente do entregador. Simulação e 6/6 formatos sintéticos aprovados; política relida após aplicação. Cliente grava URLs únicas e confirma profile por readback. Sem exclusões.
- Persistem: compilação/typecheck, testes reais com conta autenticada, publicação web/Android, validação de upload/CDN, plano seguro para objetos órfãos, conciliação Bun e E2E de funcionalidades e pagamentos. Promoções continuam NÃO aplicadas. Nenhum APK ou cobrança real foi produzido.

## Continuação — evidência Vercel e segurança Corridas (08/11/2026)

- INV-019: projeto e deployment de produção identificados por consulta Vercel de leitura. `parceiros.apoisbrasil.com.br` corresponde a deployment **CLI** de 27/10/2026, sem Git SHA. Preview do Estabelecimento em 03/11 está no branch comercial de Entregas com SHA `ccd30fc...`, e não na fonte pinada da auditoria. Sem substituição de alias ou deploy automático: o código auditado ainda precisa de build/QA/release.
- INV-018 Corridas: revogadas EXECUTE de anon e authenticated em 3 funções de status de saques, que já exigiam `service_role` no próprio corpo. Migração `apois_corridas_inv018_withdrawal_state_service_only_20261108` aplicada após BEGIN/ROLLBACK; funções e ACL 3/3 verificadas. Advisor de segurança de Corridas após a migração apontou 66 funções SECURITY DEFINER anon-executáveis (antes 69), das quais não se pode deduzir vulnerabilidades por contagem. Nenhum saque ou valor alterado.

## Continuação disparada manualmente — 09/11/2026

- Houve execução real, não mera instrução: o painel do Estabelecimento agora executa o hardener de MIME no build (`scripts/build-merchant-panel.mjs`) antes da reconciliação de imagens. O MIME do editor (JPG/PNG/WEBP) já era reforçado pelo gerador, mas o seletor e upload de logomarca/capa na rota `merchant.tsx` ficavam fora desse pipeline. A falha foi reproduzida por inspeção da sequência real de scripts.
- `scripts/qa/test-entregas-report02-transforms-v1.test.mjs` ampliado para incluir a rota `merchant.tsx` em workspace descartável e exigir seletores MIME específicos.
- Corrigida idempotência entre `harden-entregas-merchant-image-mime.mjs` e `fix-entregas-merchant-product-image-reconciliation-v1.mjs`: a segunda execução do hardener reconhece a validação mais forte sem acusar remendo parcial. Em V8, executamos os dois geradores reais em memória contra os arquivos pinados e repetimos ambos duas vezes: 4/4 aplicações sem exceção, sem alterar fontes protegidas. Não é compilação TSX, build ou E2E de upload.
- Estado continua A0 B23 C8 D0 E1 G2, pois não houve homologação Android ou teste com contas reais. Sem pix, deploy, merge ou escrita nos dados do usuário.

## Execução verificável adicional — 09/11/2026

- INV-012 B, não A: o bun.lock do pin tinha 59/61 dependências de produção, sem duas extensões do Capacitor necessárias ao Google OAuth. Cinco arquivos de lock independentes apresentaram a mesma resolução e checksum de @capacitor/app@8.0.0 e @capacitor/browser@8.0.0. Novo reconciliador bloqueia divergência inesperada e altera somente .work/entregas/bun.lock, preservando pins; ligado aos builders Cliente/Estabelecimento antes do frozen install. Teste V8 com arquivos pinados: 0 diferenças, idempotência, 4/4 adulterações rejeitadas. Teste Node versionado mas ainda NÃO executado; também não executados Bun frozen/typecheck/build/APK.
- Relatório 1, armazenamento: todos os seis buckets exigidos EXISTEM no Supabase de produção. O diagnóstico original de ausência física no ambiente vivo foi descartado, mas faltavam políticas de objeto. merchant-assets recebeu INSERT restrito a gerente da loja e caminhos logo/capa; teste DDL rollback, 8/8 formatos sintéticos, pós-aplicação ok. merchant-documents e courier-documents ganharam quatro políticas restritas INSERT/SELECT para donos e administradores em buckets privados; 12/12 testes sintéticos e inspeção ACL posterior. Nenhum upload real, arquivo existente, saldo ou pedido foi modificado.
- Relatório 1, logo e capa: fix-entregas-merchant-assets-v1.mjs em ambos os builders valida MIME, gera caminho único, consulta estado gravado após perda de resposta e não elimina arquivos cegamente. Sete geradores executados em memória sobre sete arquivos pinados, duas passadas 14/14 sem falhas e sem modificar as fontes.
- Relatório 1, OBS-011 Motorista: histórico pinado consultava apenas 50 registros. Gerador fix-motorista-history-cursor-v1.mjs implementa 50 por página, cursor (created_at,id), consulta por motorista, dedup, confirmação de identidade, botão de páginas anteriores. Ensaio em memória com hardener anterior em duas passadas passou. SQL TEMP/ROLLBACK no Supabase Corridas percorreu 105 registros em três páginas, 0 mistura de 13 registros de outro perfil, 0 duplicações. Suíte Node adicionada e ligada aos três builders. Não houve build nem teste UI.
- Permanecem bloqueados: login autenticado por perfil, E2E, APK Android em aparelho, GPS/push, publicação correspondente ao SHA, Safe2Pay, Bun install --frozen-lockfile real. Testes sintéticos não equivalem a homologação.

**Complemento Storage suporte — 09/11/2026:** pesquisa do código real do Cliente e Admin confirmou que anexos do suporte usam `support-attachments` para upload e URL assinada. O bucket de produção é privado e existia, mas tinha 0 políticas de Storage. Migrada `apois_report01_support_attachment_storage_20261109` com `apois_support_attachment_insert_v1` (somente UID dono, ticket aberto, caminho UID/ticket/UUID-nome, MIME permitido) e `apois_support_attachment_read_v1` (somente objeto citado em mensagem visível do ticket próprio ou de Admin; mensagens internas só Admin). Simulação da DDL em BEGIN/ROLLBACK, **8/8** formatos sintéticos e inspeção das duas políticas após aplicação passaram. Não foram acessados documentos, dados ou contas reais. **INV-001 continua B** porque não há E2E autenticado e não foi provado upload, assinatura de URL, cancelamento do envio ou visualização em Android.

**Relatório 1 — GPS/endereços, verificação de produção em 09/11:** o cliente Corridas pinado invocava duas Edge Functions `passenger-geocode-reverse` e `passenger-geocode-nearest-poi`, ambas ausentes da lista de Edge Functions publicadas no projeto Corridas. Mesmo a implementação versionada do `passenger-geocode-reverse` esperava chaves `latitude/longitude`, enquanto o Cliente enviava `lat/lng`. A Edge `google-maps-address` v18 está publicada, suporta ação `reverse_geocode` com `lat/lng` e exige cota pela RPC `consume_google_maps_lookup_quota()` (confirmada existente e não executável por `anon`). Criado `fix-corridas-reverse-geocode-live-v1.mjs` que, apenas na cópia isolada de Corridas, invoca o endpoint publicado e converte os `results` de Google/Photon em estrutura do Cliente; não invoca os dois endpoints ausentes nem faz segunda busca de POI. Ligado ao build Corridas, com teste Node de fixture e `bun run typecheck` como gates. **Não foi compilado nem testado com mapa/conta real.** As duas Edge ausentes não foram implantadas; nenhuma chamada de mapas pagável foi realizada nesta auditoria.

**Teste complementar do adaptador GPS:** o corpo exato de `normalizePublicReverseResult` serializado no gerador versionado foi extraído e avaliado em V8 após retirar somente as anotações de tipos: 5/5 cenários aprovados (Google ROOFTOP, Photon rural, POI reportado, lista vazia e resposta inválida). A RPC real de quota Corridas foi lida: requer usuário ativo e limita consultas por janela de minuto, sem executar a função. A suíte Node/TypeScript escrita ainda não foi executada e essa prova parcial não é E2E.

**Continuação Relatório 1 (09/11):** integrado o hardener viewport nas duas montagens de Entregas (31 rotas do hardener, 15 comprovadamente com `h-screen` no pin; três fontes originais transformadas em teste V8 duas vezes, sem remover scroll). Capturados tipos oficiais do Supabase produção (67 tabelas, inclusive as sete originalmente ausentes) e adicionada etapa determinística que altera apenas os arquivos `.work` nos dois builders; a tipagem ainda tem casts legados e precisa de typecheck real. Motorista D-004: adicionado fallback restritivo para RPC de categorias rejeitado em três builds e teste V8 3/3 (rejeição, error retornado, sucesso). D-005 já tem retry e paginação; sem tela real, não atribuir homologação. Admin download permaneceu sob acesso restrito e o bucket `downloads` está ausente na produção Corridas; nenhuma distribuição de ZIP fonte foi ativada. A/B/C/E/G permanecem inalterados até prova adequada, apesar do avanço de implementação.


---

# ATUALIZAÇÃO DO RELATÓRIO 03 — 09/11/2026

Esta seção **acrescenta nove achados** ao registro histórico de 34, sem reclassificar os anteriores nem desfazer as correções dos Relatórios 01/02. Fonte de execução e limites: `auditoria/CODEX-RELATORIO03-EXECUCAO-20261109.md`. A branch continua `audit/continuacao-20261107`; nenhum APK, teste físico, deploy nem merge foi realizado.

| ID | Prioridade | Área | Estado em 09/11 | Síntese e aceite ainda pendente |
|---|---|---|---|---|
| INV-035 | P1 | Identidade / push Corridas | B | Hardener passou a preservar `public.users(id)` e validar domínio do destinatário; testado em simulação sobre as 3 Edge Functions do pin. Necessita Deno check, build e confronto com backend implantado antes de rollout. |
| INV-036 | P1 | Firebase / tokens | B | Classificação tipada `UNREGISTERED`; HTTP400 de payload não desativa token. Sete cenários executados isoladamente; falta Deno check e runtime. |
| INV-037 | P2 | Preferências / cache | B | Cache por identidade+geração e proteção contra resposta tardia; gerador exercitado sobre fonte pinada, pendem UI autenticada e typecheck. |
| INV-038 | P2 | Preferências locais | B | Confirmação parcial se `localStorage` falhar, preservando persistência remota; sem teste navegador/quota. |
| INV-039 | P2 | Logs / estados FCM | B | Suprimido, sem token, falhou e aceito distinguíveis por destinatário; parcialmente aceito inclui metadados. Falta testar enum/FK e inserts reais em staging. |
| INV-040 | P2 | Web Notifications | B | `showPush` devolve resultado, não registra `sent` se construtor falha; rota segura preservada. Sem navegador real. |
| INV-041 | P2 | Android/Capacitor | C | Adaptador de permissão por plataforma aplicado no gerador; falta registro/estado de token, retorno de configurações e homologação final em Android. |
| INV-042 | P1 | Admin / Vercel preview | C | Endpoint GET/POST autenticado e patch SPA criados, sem secrets no cliente; falta execução Node mock, deploy configurado e testes de RBAC autenticado. |
| INV-043 | P1 | Broadcast | B | Limite de 100 por chamada explícito, 101+ rejeitados sem truncamento; API/mensagem de resultado reconciliadas. Não há fila de campanhas nem idempotência de envio; nenhuma campanha real disparada. |

**Subtotal da fase 03:** A 0; B 7; C 2; D 0; E 0; G 0; **9 achados**.

**Novo total consolidado:** A 0; B **31** (24+7); C **9** (7+2); D 0; E 1; G 2; **43 achados**. Estes totais não significam produto homologado nem 43 defeitos resolvidos em produção.

**Verificações reais feitas na fase 03:** leitura dos arquivos pinados, 18 verificações estáticas/lógicas no runtime de execução e simulação dos geradores sobre fontes reais do pin (3 scripts frontend/8 arquivos, 2 scripts backend/3 arquivos). **Não foram executados** testes Node versionados, typecheck, build ou Android físico; estes passos não são pré-requisito para receber próximo relatório, mas ficam explicitamente pendentes.

**Integridade:** os 34 registros anteriores e suas notas foram copiados integralmente acima. Os três pins e duas bases Supabase mantidos; nenhum dado alterado.

**Verificação complementar do INV-042/043 (09/11):** handler de API Admin executado em JS isolado com rede mockada, 9/9 respostas de autorização/histórico/limites corretas; não houve chamada externa. Permanece pendente o endpoint Vercel realmente publicado e teste de Node/typecheck.


---

# ATUALIZAÇÃO — RELATÓRIO 04 (09/11/2026)

A matriz anterior de **43 registros** foi copiada integralmente acima, sem substituir contagens históricas, apagar evidências ou reabrir os Relatórios 01–03. Esta seção adiciona **cinco** achados do relatório em anexo; `VIS-001` corresponde ao `INV-047` e **não** aumenta o total. Base executora: branch `audit/continuacao-20261107` do integrador; snapshots preservados.

| ID | Prioridade | Área | Estado | Síntese e aceite restante |
|---|---|---|---|---|
| INV-044 | P2 | Motorista documentos / Storage | **C** | Biblioteca sem `storage.remove` client-side, recupera commit confirmado por Edge e registra pendência em fila service-only preparada. **Edge e SQL NÃO APLICADAS**: falta validar ownership/objetos referenciados, filas e conciliação em staging. Não há DELETE automático nem limpeza já realizada. |
| INV-045 | P1 | Foto da frente / Correções Motorista | **C** | Trigger isolado de snapshot da frente e validação da foto atual no RPC de reenvio preparados em `20261109_report04_correction_proofs_QA_NOT_APPLIED.sql`. STAGE2 inteiro permanece bloqueado. SQL **não aplicado**, sem teste transacional real. |
| INV-046 | P1 | Evidência de atualização por item | **C** | Trilhas de alteração de CNH/selfie/CRLV/ano vinculadas à solicitação e checagem por item no reenvio estão preparadas, sem alterar aprovação. SQL **não aplicado**, histórico legado e E2E pendentes. |
| INV-047 / VIS-001 | P2 | Central de pendências / UI | **B** | Gerador corrige erro oculto pelo retorno antecipado e fornece retry visível em compacto/completo; dados anteriores preservados durante falha de refresh. Gerador exercitado sobre snapshot pinado. Falta build, UI autenticada e Android. |
| INV-048 | P2 | Documentos / MIME/câmera | **B** | Helper compartilhado verifica assinatura real JPG/PNG/WebP/PDF, normaliza MIME vazio e preserva contrato por tipo. Oito arquivos sintéticos aceitos/rejeitados corretamente em teste isolado. Falta Android, typecheck e seletor real. |

**Subtotal Relatório 04:** A 0, B 2, C 3, D 0, E 0, G 0 = **5**.

**Total acumulado de 48:** A **0**, B **33** (31+2), C **12** (9+3), D **0**, E **1**, G **2** = **48**. Não transformar B/C em homologação final. Os totais e datas dentro dos 34 e 43 registros históricos acima são preservados deliberadamente.

**Evidência:** `auditoria/CODEX-RELATORIO04-EXECUCAO-20261109.md`; geradores executados com arquivos pinados (5/5), teste sintético de assinatura (8/8), reconciliação de transformação idempotente (2 passadas) e consultas read-only ao catálogo de Corridas. Tabelas e gatilhos INV-044/045/046 verificados **ausentes** no banco; não foram implantados. Nenhum APK nem teste físico. Receber relatórios subsequentes está liberado sem alteração dos gates de produção.


---

# ATUALIZAÇÃO DO RELATÓRIO 05 — 09/11/2026

A **matriz histórica de 48 itens foi preservada acima integralmente**. Acrescentam-se somente os 3 achados INV-049–051 (Relatório 05 de 08/11/2026). Referência da execução, limitações e testes: `auditoria/CODEX-RELATORIO05-EXECUCAO-20261109.md`. Branch oficial `audit/continuacao-20261107`, sem alterações do source-lock, merge ou produção.

| ID | Prioridade | Área | Estado | Síntese e aceite pendente |
|---|---|---|---|---|
| INV-049 | P2 | Segurança Motorista / Capacitor GPS | **B** | Helper da permissão distingue `precise` e `approximate` (fine/coarse), sem negar coarse concedida; usa `enableHighAccuracy:false` para aproximada. Diagnóstico diferencia GPS desligado, timeout e negação. SOS pode continuar sem coordenadas; despacho de corridas intocado. Gerador exercitado sobre fonte fixada e asserts simulados; falta Android real/typecheck. |
| INV-050 | P2 | Contatos / integridade do telefone | **C** | Cliente não trunca mais dígitos, valida formatação e 8–15 números, preserva entrada para correção. SQL `20261109_report05_emergency_phone_validation_QA_NOT_APPLIED.sql` prepara validação complementar no servidor **sem implantação** nem atualizar registros legados. Ainda há risco de entrada direta no RPC sem a mudança; staging e publicação dependem de autorização posterior. |
| INV-051 | P2 | Compartilhamento de localização | **B** | API share bem-sucedida preservada; cancelamento AbortError sem cópia automática; falha recuperável expõe o link e ação manual `Copiar link`. Clipboard negada preserva campo selecionável. Testado isoladamente, sem Android WebView real. |

**Subtotal Relatório 05:** A 0; B 2; C 1; D 0; E 0; G 0 = **3 novos**.

**Total acumulado dos Relatórios 01–05:** A **0**; B **35** (33+2); C **13** (12+1); D **0**; E **1**; G **2** = **51 achados**.

**Verificação efetiva:** simulação de dois scripts sobre arquivos TSX reais do snapshot, 39/39 verificações sintéticas de helper/classificador/compartilhamento, gerador idempotente; **não foi executado** build, typecheck completo, captura de tela, chamada SOS, ligação ou compartilhamento externo. Supabase Corridas consultado somente para leitura do contrato do RPC, sem migração. A expressão `QA_NOT_APPLIED` preserva bloqueio de produção.

**Continuidade:** sem testes físicos até o usuário autorizar formalmente a homologação geral; novos relatórios podem ser recebidos sem reabrir os achados já registrados. B e C não significam homologação nem conclusão de implantação.
