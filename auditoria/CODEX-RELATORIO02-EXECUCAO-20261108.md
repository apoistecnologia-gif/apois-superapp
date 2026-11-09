# APOIS — Execução complementar do Relatório 02 (08/11/2026)

> **ADENDO DE CONTINUIDADE — 08/11/2026 (situação posterior aos registros históricos abaixo).** O texto original documenta a execução anterior e não deve ser lido como estado atual do banco. Nesta continuação houve alterações autorizadas e aplicadas no Supabase, além de novos commits no GitHub. Nenhum APK, deploy Vercel, pagamento real ou merge foi executado.


## Contexto e proteção de escopo
- Base de auditoria recebida: audit/ecossistema-20261107 @ c51ba5b4307822291c82d4d09f36f9812f937713 (snapshot de investigação, não a branch que recebeu nossas correções).
- Branch realmente editada: apoistecnologia-gif/apois-superapp @ audit/continuacao-20261107; ponto anterior a esta fase a8e7c3e0ae01608d56a57fdcde192ef95a3bb56a.
- Fontes pinadas preservadas: Entregas 2f4606e0fb52dffb49f2e6aebbe921ce687ab625, Passageiro 7b047f75a1a919a5336c0df6e0d60b14b02f2618 e Motorista/Admin 9fc171050d8b5703540c49d19a8f1e9f5162775f.
- Supabase Corridas tbbzkrfupmqdywnzgnms; Supabase Entregas ptgkwyyolrdgnqketkjj — consultas catalográficas somente leitura, nenhuma mutação.
- Nenhuma alteração em fontes pinadas, main, banco, Storage, domínio, publicação Vercel, pagamento real, build APK ou compilação integral.

## Achados e correções no código

| ID | Estado nesta execução | Fonte da correção | O que mudou |
|---|---|---|---|
| INV-021 | Implementado no gerador, validado isoladamente | scripts/restore-corridas-wallet-screen.mjs; scripts/verify-corridas-wallet-screen.mjs; scripts/verify-corridas-auth-wallet-domain-v2.mjs | Taxas usam profile.id/domain ID e não auth.uid; não indica ausência enquanto perfil carrega; hardener existente harden-corridas-auth-profile-resolution.mjs foi ligado ao pipeline e validado em cópia de 7 fontes |
| INV-022 | Implementado, validação isolada | scripts/fix-entregas-search-results-v2.mjs | 40 limita apenas cards de produtos, nunca o conjunto de lojas correspondentes |
| INV-023 | Implementado, validação isolada | scripts/fix-entregas-search-results-v2.mjs | Coordenadas ausentes, vazias, fora de faixa e inválidas geram distância indisponível, zero explícito permanece válido |
| INV-024 | Parcial | scripts/fix-entregas-merchant-hours-24h-v2.mjs | 00:00–00:00 e qualquer abertura=fechamento passam a representar 24h, igual ao servidor. Cidade/approval/temporarily_closed/timezone ainda não unificados |
| INV-025 | Implementado, validação de montagem | scripts/fix-partner-admin-finance-refresh-v2.mjs | Cada Atualizar calcula rangeFor com o instante atual; intervalo realmente consultado é exibido, custom preservado; definição de dias civis em 7d/30d mantida como pendência |
| INV-026 | Implementado no cliente, validação isolada | scripts/fix-entregas-admin-coverage-consistency-v2.mjs | Consulta A/B protegida por sequenciamento; draft armazena cityId original; troca de cidade bloqueada com draft ou gravação; operação normal usa cidade original e não selecionada de outra zona |
| INV-027 | Implementado no cliente, validação isolada | scripts/fix-entregas-admin-coverage-consistency-v2.mjs | Campos em branco rejeitados; lat ±90/lng ±180, vírgula decimal aceita e 0 explícito legítimo; sem inferência silenciosa |
| INV-028 | Não corrigido; versão publicada não identificada pelo relatório | Investigação Vercel em leitura | Preview publicado e snapshot pinado são versões diferentes; texto pálido em painel branco deve ser rastreado ao commit/URL correto antes de editar. Nenhum CSS de produção alterado |
| INV-029 | Implementado no snapshot, não homologado no domínio publicado | scripts/fix-entregas-login-accessibility-v2.mjs | Áreas de toque Voltar/Mostrar senha/recuperação ampliadas no login fonte, sem mexer em auth |
| INV-030 | Implementado no snapshot, não homologado no domínio publicado | scripts/fix-entregas-login-accessibility-v2.mjs | Formulários courier/outros com label htmlFor, id, name e autocomplete preservado |
| INV-031 | INVESTIGAR | Sem implementação deliberada | Fluxo promotions → pedido/preço/limite continua sem contrato comercial verificado; não criar desconto implícito nem remover ferramenta |
| INV-032 | Implementado no cliente, teste isolado de montagem | scripts/fix-entregas-coupon-metrics-v2.mjs | Falha de leitura de usos vira “Indisponível”, exclui ação perigosa, oferece retentativa; FK ON DELETE RESTRICT continua |
| INV-033 | Parcial | scripts/fix-entregas-cart-price-refresh-v2.mjs | Novo addItem de linha igual atualiza preço, opções e metadados com aviso; sacola reaberta sem novo addItem ainda precisa revalidação e confirmação junto ao backend |
| INV-034 | Correção SQL preparada, NÃO APLICADA | supabase/entregas-forward-migrations/20261108_qa_payment_missing_anchor_guard_NOT_APPLIED.sql | Guarda NULL segura IF v_id IS NULL OR NEW.merchant_id IS DISTINCT FROM v_id, preservando proteção QA. Depende de testes com âncora presente/ausente/renomeada |

## Ordem de montagem e regressões
- Corridas build-isolated-module.mjs: usa restore-corridas-wallet-screen.mjs e também o hardener Auth/domain previamente existente, que não estava invocado diretamente na montagem examinada. O guard novo verify-corridas-auth-wallet-domain-v2.mjs valida a saída final.
- Entregas build-isolated-module.mjs e build-merchant-panel.mjs: aplicam 6 transformações acima ao workspace .work/entregas e executam verify-apois-report02-integrity-v1.mjs antes de compilar.
- Admin Corridas: build-partner-release.sh e build-motorista-module.mjs aplicam fix-partner-admin-finance-refresh-v2.mjs e passam pelo mesmo verificador em modo finance.
- Os três submódulos originais permanecem idênticos nos pins; não foram substituídos por código reescrito.

## Testes realmente efetuados nesta interação
1. Correção INV-021 sobre placeholder real: gerada tela da carteira e verificados profile.id, estado loading_profile e ausência de auth UUID no filtro.
2. Hardener da identidade Corridas: aplicado com mock de FS aos 5 arquivos originais e confirmou alterações esperadas. Integração estendida a 7 arquivos de fonte com geração da carteira + verificador final: PASSOU. Não é login físico.
3. Entregas: 6 scripts geradores aplicados aos 6 arquivos pinados originais em FS simulado, dois ciclos consecutivos por arquivo, idempotentes; verificador da fonte gerada PASSOU.
4. Busca: verificação isolada 41 lojas/40 cards e seis coordenadas inválidas com zero explícito válido: PASSOU.
5. Cobertura: gerador aplicado ao arquivo real pinado com novos guards, validação de âncoras: PASSOU. Não foi exercitada uma RPC de zona.
6. Financeiro: gerador aplicado ao admin.financeiro.tsx pinado, com range no load e rótulo do intervalo, PASSOU; não houve consulta de resumo financeiro vivo.
7. Cupons, carrinho, horário e login: geradores aplicados às fontes reais pinadas; validações de presença e execução dupla, PASSARAM; não houve operação de cliente/loja ou login autenticado.
8. Vercel: consultados em leitura projetos e histórico de deploy de estabelecimento, distinguindo deployment visual do snapshot fixado. Nenhum deploy executado.

**NÃO EXECUTADOS:** bun install, typecheck integral, lint, tests full, Playwright/Android, E2E autenticado, teste de pagamento, pedido real, reversão do SQL, migração em staging/produção, screenshots finais. Nenhum item é classificado “corrigido e homologado no APK”.

## Risco conhecido
- INV-009 da fase anterior: execução direta da função SECURITY DEFINER financeira ainda habilitada em produção. A migration de ACL da fase anterior está stage-only.
- INV-034: trigger QA está ativo e âncora existe, logo risco condicional, sem defeito vivo de pagamento demonstrado. O SQL stage-only não é correção aplicada.
- INV-024: helper de horário usa fuso do aparelho e não sabe todos os gates do servidor. 24h é só um componente da solução.
- INV-026: controle de troca de cidade endurecido no front; para segurança completa vale testar permissões/RPC e considerar blindar reatribuição no banco numa migração específica de homologação.
- INV-028: não inferir que o layout branco publicado pertence ao código preto da fonte pinada; exige mapear URL/commit e medir contraste no deployment real.
- INV-031 e INV-033: ajustes futuros devem preservar o cálculo de pedido server-side, estoque, limites, cupons e consentimento a preço final.

## Próximos gates
- Conferir checkouts reais e rodar os novos scripts de validação, depois typecheck, lint, builds e fixture dos módulos.
- Homologar fluxo Corridas (login Google/perfil, carteira com AUTH≠DOMAIN, taxas reais sintéticas e histórico) e Entregas (A/B zona, coordenadas, busca 41+, 24h/temporarily_closed, cupons, sacola reaberta).
- Planejar staging dos dois SQL QA_NOT_APPLIED. Não aplicar a produção sem autorização específica e testes de rollback.
- Registrar PR/commit, screenshots e matriz por ID antes de qualquer alegação de produção pronta.

## Continuação efetiva — engenharia e segurança (08/11/2026)

### Controle de versão e escopo

- Repositório: `apoistecnologia-gif/apois-superapp`; branch exclusiva `audit/continuacao-20261107`; HEAD de entrada confirmado como `8a87a091ccc32b0f4368779426109e6a199c16e5`.
- Pins preservados: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`. Nenhum repo pinado nem `main` alterado.
- Builders de Entregas examinados: `scripts/build-isolated-module.mjs` e `scripts/build-merchant-panel.mjs` chamam geradores de promoções, horário autoritativo e sacola persistida na ordem exigida, seguidos do `verify-apois-report02-integrity-v1.mjs`. Trata-se de inspeção de integração, ainda não de compilação real.

### Banco de produção — registros consultados e alterações efetivas

| Achado | Evidência real | Estado |
|---|---|---|
| INV-009 | Migração `apois_inv009_restrict_financial_settle_direct_execute_20261108` consta em `supabase_migrations.schema_migrations`; `settle_delivered_order_financials(uuid)` tem EXECUTE: anon=false, authenticated=false, service_role=true | Aplicada e ACL verificada; sem E2E do settlement |
| INV-034 | Migração `apois_inv034_qa_order_guard_null_safe_20261108` consta no histórico; `apois_qa_never_real_payment` ativo e guard na função `private.apois_qa_no_real_payment`: `v_id IS NULL OR NEW.merchant_id IS DISTINCT FROM v_id` | Aplicada e guard/triggers lidos; sem testes adversariais completos |
| INV-024 | Migração `apois_inv024_visible_merchants_open_status_20261108` aplicada; RPC `apois_visible_merchant_order_status(uuid[])` acessível aos autenticados, consulta `merchant_accepting_orders` | Client integrado aos builders; **16/16 cenários sintéticos SQL com rollback aprovados** em horários, fuso, madrugada, exceções e inatividade; E2E visual/realtime ainda pendente |
| INV-018 | Migrações `apois_inv018_restrict_anon_admin_rpc_execute_20261108` e `apois_inv018_restrict_service_only_dispatch_rpc_execute_20261108` aplicadas, ambas versionadas no repositório | 20 RPCs administrativas bloqueadas para `anon`, 20 mantidas para auth/service; 6 RPCs internas de push/segredos/enfileiramento bloqueadas para `anon` e `authenticated`, 6 mantidas para service_role. Outras RPCs permanecem em triagem. |

A migração de ACL INV-018 foi primeiro testada com `BEGIN/ROLLBACK`; durante o teste todas as 20 funções perderam acesso anônimo. Após aplicação por ferramenta Supabase, nova consulta confirmou `anon=0/20`, `authenticated=20/20`, `service_role=20/20`. Os corpos das 20 funções já possuíam a validação `current_user_is_admin()`. **A contagem inicial de 113 funções `SECURITY DEFINER` acessíveis por `anon` caiu para 87 após as duas migrações INV-018; o alerta não está totalmente encerrado**; uma parte é legítima RPC autenticada e outra exige revisão de ACL e de privilégio interno.

### INV-031 — promoções sem cupom, somente preparadas

Regra comercial preservada: promoção válida cadastrada pelo estabelecimento aparece automaticamente ao cliente, desconto aplicado ao pedido, sem exigir cupom, mas sem acumular com cupom explícito. Foram validadas a existência e conexão dos scripts `restore-entregas-auto-promotions-v3.mjs`, `connect-entregas-auto-promotions-v3.mjs` e da migração `20261108_auto_merchant_promotions_QA_NOT_APPLIED.sql`.

Correções nesta continuação:
- SQL de elegibilidade exige **produto E categoria**, quando ambos forem definidos (antes usava `OR`, divergente do helper do cliente);
- limite de usos deixa de contabilizar pedido cancelado e ainda não pago, sem apagar registro histórico do resgate;
- checkout solicita confirmação quando valor oficial do backend **difere para mais ou para menos** do estimado, antes da chamada ao provedor PIX, usando orderId e fingerprint idempotentes;
- badge de oferta voltou à paleta âmbar APOIS, sem introduzir verde.
- `verify-apois-report02-integrity-v1.mjs` atualizado para a nova proteção de preço.

**Testes realmente efetuados:** compilação da migração SQL com `BEGIN/ROLLBACK`, sem manter RPC/trigger em produção; teste da função de desconto clonada a tabelas `pg_temp` dentro de `BEGIN/ROLLBACK`, com 9 pedidos sintéticos e asserções de total/desconto (percentual, valor fixo, produto/categoria incompatíveis, cupom pré-existente, uso limitado, liberação por cancelamento sem pagamento, mínimo por promoção, limite de total R$0,01 e repetição idempotente). Resultado: **9/9 cenários passaram**, com **5 resgates únicos**; os dados temporários e gatilhos temporários foram revertidos. Nenhum pedido, cobrança ou desconto real foi criado. Verificação pós-teste: `public.apois_available_merchant_promotions(uuid)` inexistente e `apois_automatic_promotion_checkout` inexistente no banco de produção. **INV-031 não está homologada nem habilitada**; testes de concorrência simultânea, checkout E2E, provider, autenticação e cancelamento depois de pagamento permanecem pendentes.

### INV-033 — sacola e checkout

`fix-entregas-persisted-cart-validation-v3.mjs` consulta catálogo, opções e grupos vigentes na restauração da sacola e bloqueia itens marcados indisponíveis. O código do checkout contém gate antes do PIX, aceitando total autoritativo apenas mediante conferência/consentimento em caso de divergência. **Não executar o verificador de integridade em isolamento como substituto de typecheck/build.** A proteção fail-closed foi implementada depois deste registro histórico; faltam typecheck/build, revalidação em falha de rede e testes reais em telas.

### INV-028 — Vercel

A ferramenta Vercel listou os projetos `apois-entregas-estabelecimento`, `apois-estabelecimento-visual-preview` e `apois-entregas-visual-preview`. Porém, a consulta de deployments com escopo do projeto/equipe retornou **HTTP 403 (forbidden)**. Não foi possível atribuir a captura de texto pálido sobre fundo branco a uma URL/commit específica. **Não houve CSS alterado por presunção nem deploy.**

### Outros bloqueios herdados do Relatório 01

- INV-001: backend com ação `detail` aplicada em produção v12 e UI gerada, faltam build/E2E; INV-012: gate estrito de release adicionado; lock do pin ainda incompatível e não homologado; INV-020: literal da liquidação corrigido no banco após rollback, faltam E2E/histórico; INV-010: pagamento Safe2Pay não homologado; INV-017: checagens de credenciais vazadas; INV-019: aliases não identificados.
- Manter revisão de funções `SECURITY DEFINER` restantes, incluindo RPCs de pedidos, carteira, payouts e filas, com classificação pelo uso antes de revogar privilégios; autenticação, cidade e RLS exigem testes adversariais.
- Testes ainda **não executados nesta continuação**: `bun install`, typecheck, lint, unitários completos do workspace, build full/Android, E2E autenticado, pagamento real, varredura funcional de todos os 34 achados. Os testes de SQL sintético não autorizam conclusão da homologação de produção.
- Não foi criada branch Supabase (cobrança adicional dependeria de autorização de custo); não foi feito merge na `main`; não foi requisitada movimentação financeira.

### Commits revisáveis desta continuação

- `aa540aa0694c80276305b0c87c9197109d8886fc` — ACL das RPCs administrativas, migração aplicada após simulação.
- `b422e380e5e7aa5102cd679656bac12419b44ceb` — elegibilidade e limite de promoções no SQL preparado.
- `28c7282238f7a9294956124294424ed21b82554e` — confirmação de qualquer divergência de total servidor.
- `5a065576317052c5cd3dfb6265f5caab9fe4e6e0` — verificador de integridade alinhado.
- `ca15221f5a017aa1dfc93038e56590c3bbb265a6` — manutenção de contraste da marca no badge de promoção.

**Conclusão parcial:** foram feitos commits reais, migração de ACL real e testes SQL sintéticos com rollback. Nenhum item deve receber status `A` até completar regressões, build e E2E. O Relatório 03 ainda **não deve ser solicitado**.

### Complemento: seis RPCs internas com ACL restrita a service_role

A Edge Function pinada `supabase/functions/dispatch-push-outbox/index.ts` usa `SUPABASE_SERVICE_ROLE_KEY` ao chamar `claim_notification_push_batch_v2` e `verify_push_dispatch_runtime_key`. O retorno da função de claim inclui tokens de dispositivos e altera estados da fila. `enqueue_notification` não verifica a autorização do chamador. A exposição dessas funções a `anon` ou usuário comum é incompatível com privilégio mínimo.

Foi criada, testada com `BEGIN/ROLLBACK`, aplicada e verificada a migração `apois_inv018_restrict_service_only_dispatch_rpc_execute_20261108` para as seis funções: `claim_notification_push_batch(integer)`, `claim_notification_push_batch_v2(integer)`, `enqueue_notification(uuid,text,text,text,jsonb,text)`, `verify_push_dispatch_key(text)`, `verify_push_dispatch_runtime_key(text)` e `verify_payout_dispatch_runtime_key(text)`. Estado pós-aplicação: **6/6 anon=false; 6/6 authenticated=false; 6/6 service_role=true**. Contagem total de funções SECURITY DEFINER acessíveis por `anon`: **87** (113 na análise anterior).

Nenhuma mensagem real foi enfileirada e nenhum push foi disparado nos testes de ACL. Teste do fluxo operacional end-to-end do push continua pendente. Commit dessa migração: `988069457f7b45eb417ef1811a5548fb959b17df`.

### INV-020 — correção pontual do texto de liquidação em produção

Fonte do problema: função `public.settle_delivered_order_financials(uuid)` apresentava literal com dupla codificação (`apÃƒÂ³s conclusÃƒÂ£o`). A migração versionada `supabase/entregas-forward-migrations/20261108_inv020_settlement_notification_mojibake_fix.sql`, commit `99c0389ed9b65cb71742873e7127abb989a3e090`, deriva o corpo **vivo** usando `pg_get_functiondef` e substitui apenas a mensagem por `Repasse do pedido liberado após conclusão`, abortando se a assinatura/texto esperado divergirem. Evita restaurar lógica antiga.

Primeiro simulada dentro de `BEGIN/ROLLBACK`: novo literal presente, ACL protegida (anon=false/authenticated=false/service_role=true). Em seguida aplicada como `apois_inv020_settlement_notification_mojibake_fix_20261108`, verificada no banco: novo literal verdadeiro, texto antigo ausente, permissões da INV-009 preservadas. **Não houve movimentação financeira, execução de settlement nem alteração de histórico/valor.** E2E financeiro permanece pendente; demais funções com mojibake são outro inventário.

### INV-001 — consulta direta ao chamado e segurança

A função `customer-support` v11 ativa no Supabase Entregas foi lida e comparada **byte a byte** ao arquivo do snapshot Entregas pinado (`supabase/functions/customer-support/index.ts`), confirmando código idêntico antes de editar. A correção adicionou a ação `detail` ao endpoint: UUID validado, `authClient.auth.getUser(token)`, SELECT `.eq('id', ticketId)` e `.eq('requester_user_id', authData.user.id)` com RLS, retorno 404 quando não pertence ao usuário e filtro para não retornar `is_internal`. Ações `list`, `create` e `message` não foram removidas. `verify_jwt` foi preservado como `true`.

A função foi implantada na produção existente (sem recurso pago adicional): versão **11→12**, status `ACTIVE` confirmado por releitura da Edge Function, marker `APOIS_SUPPORT_TICKET_DETAIL_V1` presente. Políticas RLS de `support_tickets` e `support_messages` revisadas: ambas ativas, SELECT autenticado condiciona ao solicitante e protege mensagens internas. Uma consulta somente leitura com role `authenticated` e **sem `auth.uid()`** retornou zero mensagens. Isso não substitui prova de acesso A/B com sessões reais.

Foi criado `scripts/fix-entregas-support-ticket-detail-v1.mjs` (commit `77701885e1ee929ccb2116e4108b9b32abf5926f`) para alterar apenas `.work/entregas`, substituindo o download da lista de 50 pelo detalhe autorizado na rota canônica. Integrado aos builders em commits `3fbcacbfc109cabe2a6912c54b8f93bf6995dab4` e `6dcd146f9e72221b80d5214376bf3b5353f3229c`. Pontos de inserção do script foram encontrados uma única vez no snapshot pinado. **Não houve build cliente, deploy Vercel ou Android**; verificar 51+ chamados, acesso de usuário B ao protocolo A, anexos, replies e realtime após compilar.

**Validação isolada INV-024 — 16/16 casos aprovados:** o corpo **vivo** de `public.merchant_accepting_orders(uuid,timestamptz)` foi obtido via `pg_get_functiondef`, clonado como `pg_temp.merchant_accepting_orders_test` com referências somente a tabelas temporárias de estabelecimentos/cidades/horários. Transação `BEGIN/ROLLBACK` avaliou: 24h em dois horários; fechamento temporário; cidade inativa; turno atravessando a meia-noite (antes/depois do encerramento); exceção de data fechada; hora local Recife aberta/fechada; Nova York aberta/fechada no mesmo dia UTC; segundo intervalo e intervalo de pausa; exceção de data com horário especial antes/durante; cadastro não aprovado. Assert SQL `16/16` sem falha. Não houve mutação persistente do catálogo nem teste de tela ou acesso anônimo. 

## Continuação — lock Bun, sacola fail-closed, histórico por cursor (08/11/2026)

### INV-012: falha de lock reproduzível identificada e release protegido

Leitura direta do `package.json` e `bun.lock` do snapshot Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`: o manifesto declara 79 dependências de runtime e desenvolvimento, e o lock lista 77. Ausentes `@capacitor/app@8.0.0` e `@capacitor/browser@8.0.0`. A busca do código identificou ambos como imports do `GoogleLoginButton.tsx`; **não foram removidos nem foram inventados pacotes resolvidos**.

Novo validador `scripts/verify-entregas-bun-lock-v1.mjs` compara dependency maps e identifica drift sem instalar ou alterar `bun.lock`; cinco testes unitários adicionados em `scripts/qa/test-entregas-bun-lock-v1.test.mjs`. O builder `scripts/build-merchant-panel.mjs` agora interrompe o release em divergência do lock, instalação `bun install --frozen-lockfile` falhada ou lint falho. Uma fixture QA local pode usar fallback **somente** com `APOIS_MERCHANT_QA_FIXTURE_ONLY=1` e fora de CI/Vercel; nunca recebe status de release válido. **Os cinco testes estão escritos, não executados neste runtime**, e lock pinado ainda precisa ser gerado/reconciliado e testado com Bun. Nenhum snapshot foi modificado.

### INV-033: validação de catálogo obrigatória para checkout

`scripts/fix-entregas-persisted-cart-validation-v3.mjs` foi ajustado: consulta produtos com `merchant_id` e marca itens de outra loja como inválidos; `refreshCartCatalog` agora retorna `Promise<boolean>`. Valor `false` cobre erro da consulta, falta de hidratação, estado assíncrono obsoleto, produto/opção indisponível, preço ou categoria divergente. A tela de checkout chama `await refreshCartCatalog()` **antes** da Edge Function `create-order`, bloqueando qualquer tentativa de gerar cobrança se a sacola não tiver sido confirmada com catálogo vivo. Quando preço/categoria muda, o usuário revisa os itens renderizados e confirma numa nova tentativa. Gate textual de integridade ampliado para ordem da chamada, checagem de merchant e falha fechada. Ainda **sem typecheck ou teste do app em execução**.

### INV-013: histórico de pedidos sem limite silencioso de linhas

O snapshot original `src/routes/pedidos.tsx` carregava todos os pedidos de uma vez por `.order('created_at')`, sem paginação. Foi criado `scripts/fix-entregas-customer-orders-pagination-v1.mjs`, conectando ambos os builders à transformação somente em `.work/entregas`. A tela passa a carregar lotes de 30 com consulta de 31 itens, exibir `Carregar pedidos anteriores`, ordenar por `created_at DESC,id DESC`, manter cursor composto no próximo lote, assegurar `customer_user_id`, mesclar por ID e atualizar linhas históricas já carregadas em eventos Realtime. O checker `verify-apois-report02-integrity-v1.mjs` agora exige marcadores do fluxo e tie-breaker.

**Teste efetivamente executado:** transação no Supabase Entregas com **tabelas temporárias e ROLLBACK**. Foram criados 105 pedidos sintéticos do usuário A e 13 do usuário B, vários com mesmo timestamp; paginação por cursor percorreu **4 páginas, 105 registros únicos**, mesmo após simular inclusão de pedido mais novo entre páginas, sem revelar pedidos B. Resultado aprovado. Isso **não prova** que a consulta `.or()` do SDK, a tela visual, o botão ou o Realtime funcionam no aplicativo real; dependem de typecheck, build e E2E autenticado. Nenhum pedido real foi inserido.

### Limitações deste ambiente e próximos gates

O código fonte privado está disponível pelo conector GitHub, mas o ambiente local de terminal não consegue resolver `github.com` e não tem `bun` instalado. Por isso **não foram executados** node unitários no checkout completo, `bun install`, `tsc --noEmit`, lint, build Entregas/Merchant, Android E2E nem testes autenticados em produção. Os testes SQL temporários acima são resultados reais, distintos das novas implementações React ainda sem compilação. Nenhum GitHub Action novo, deploy Vercel, merge, alteração de alias, cobrança, pagamento ou recurso pago foi criado nesta continuação. A correção `INV-028` ainda depende de identificação da versão Vercel exata. A migração `INV-031` permanece não aplicada.

## Continuação adicional — ACL financeira e administrativa de Corridas (08/11/2026)

**Banco correto:** Supabase Corridas `tbbzkrfupmqdywnzgnms`, diferente do Supabase Entregas. Catálogo anterior indicava **110** funções `SECURITY DEFINER` no schema `public`, **84** com `anon EXECUTE` e **102** com `authenticated EXECUTE`. Essas contagens representam exposição de interface, não comprovação de exploração.

Identificadas e inspecionadas três funções financeiras/prepagas que verificavam `auth.role() <> 'service_role'` no próprio corpo, mas cujo `EXECUTE` ainda era concedido a papéis públicos: `activate_prepaid_pix_ride(uuid,text)`, `claim_prepaid_pix_initial_dispatch(uuid)` e `reverse_refunded_ride_payment(uuid,text,text,numeric)`. Também identificadas 13 funções administrativas `admin_*`, com restrições por `apois_rpc_private` ou `private.has_permission`. A função predicado `admin_is_authorized()` foi **preservada** com acesso público por cautela de compatibilidade do login.

Migração criada em `supabase/corridas-forward-migrations/20261108_inv018_restrict_admin_pix_financial_rpc_execute.sql` (commit `99430e735b8b1a9792685edff8526c7cfdd95f90`). Ela não chama nenhuma função financeira: somente executa `REVOKE/GRANT` para 12 ações administrativas (preservando `authenticated/service_role`) e 3 funções financeiras (preservando apenas `service_role`). Valida que as três ainda contêm guardas de `service_role_required` e que a contagem de funções não mudou antes de agir.

**Teste SQL com transação revertida:** 15/15 funções com `anon=false`, 12/15 com `authenticated=true` (todas as administrativas), 15/15 com `service_role=true`. Depois aplicada como `apois_corridas_inv018_restrict_admin_pix_financial_rpc_execute_20261108` em produção Corridas e registrada em `supabase_migrations.schema_migrations`. Nova consulta confirmou exatamente os mesmos valores. A contagem de `public SECURITY DEFINER` com acesso anônimo caiu de **84 para 69**. Não houve criação de cobranças, estornos, saques, crédito, liquidação ou alteração do ledger.

**Limitações:** sem E2E com papéis reais, não declarar fluxo Pix ou painel Admin homologado. Das 69 funções restantes, 15 são triggers, 54 não-trigger; a ACL de cada uma ainda precisa de revisão de chamador, efeito e guarda. O inventário rastreável foi salvo em `auditoria/CODEX-INV018-CORRIDAS-RPCS-20261108.md`. Não aplicar revogação cega, em especial no login, consulta de categorias, mapas, GPS e status de corrida. Nenhuma alteração na `main` ou nos submódulos pinados.

## Continuação efetiva: proteção do build, upload de produtos e avatar (08/11/2026)

**Mudanças no GitHub, sem alterar fontes pinadas:**
- Em .apois/modules.json, instalador de Entregas passou de Bun livre para bun install --frozen-lockfile. scripts/build-isolated-module.mjs verifica lock do snapshot antes de instalar e de compilar, usando o mesmo validador da montagem Merchant. O lock original continua divergente em @capacitor/app e @capacitor/browser: não existe build/APK aprovado.
- INV-033: o gerador de sacola invalida leituras de catálogo quando o usuário adiciona, altera quantidade, remove ou limpa a sacola. Proíbe mistura de estabelecimentos antes de checkout. Cart price gerador aceita workspace isolado via variável de ambiente sem alterar comportamento canônico.
- INV-015: novo gerador do MerchantProductEditor para caminho único de imagem, MIME JPG/PNG/WEBP, read-back da linha de produto quando UPDATE falha ou retorna resultado ambíguo. Se realmente não persistir, o arquivo novo é preservado até reconciliação server-side; proibição de exclusão cega evita apagar imagem ligada por resposta tardia.
- INV-014: avatar do Cliente usa caminho único no bucket avatars e pasta customer-avatar do próprio UID, sem upsert. Novo URL é persistido no profile e reutilizado entre as telas. Read-back confirma a atualização de profile se a resposta HTTP falhar. Não altera diretório courier-profile.
- Foi criado scripts/qa/test-entregas-report02-transforms-v1.test.mjs, executado no pipeline futuro em workspace temporário com seis arquivos pinados. As cinco transformações reais foram também executadas em V8, em memória, sobre os seis arquivos originais baixados pelo GitHub: sem erros de âncora. Isso valida compatibilidade dos geradores, NÃO sintaxe/typecheck TypeScript nem uso real.

**Mudanças efetivamente aplicadas no Supabase Entregas (ptgkwyyolrdgnqketkjj):**
- INV-015: política de INSERT apois_product_images_merchant_insert_v1 em storage.objects restringe product-images ao estabelecimento autorizado pelo current_user_is_merchant_manager, exigindo produto existente e caminho correto. Antes não havia política de INSERT do bucket. Simulação BEGIN/ROLLBACK aprovada, seis formatos sintéticos de arquivo aprovados e política/migração relidas após implantação. Migração apois_inv015_product_images_merchant_insert_20261108.
- INV-014: política de INSERT apois_customer_avatar_versioned_insert_v1 em storage.objects exige auth.uid, pasta customer-avatar, arquivo versionado, extensão permitida e conta ativa. Política de avatar do entregador mantida intacta. Simulação BEGIN/ROLLBACK aprovada, seis formatos sintéticos testados incluindo NULL tratado como rejeição, política relida após implantação. Migração apois_inv014_customer_avatar_versioned_insert_20261108.
- Nenhum upload real, remoção de objeto, alteração de saldos, pagamentos, pedido real, versão Vercel, merge main ou APK ocorreu. NÃO considerar resultados de testes sintéticos equivalentes a E2E com sessões reais.

**Pendências específicas restantes:** reconciliar bun.lock em ambiente Bun e provar instalação frozen; typecheck e build dos módulos; testar upload por gerente autorizado e tentativa por terceiro; avatar em duas contas/dispositivos; evitar órfãos em falha definitiva de UPDATE com reconciliação no backend; testes de permissões/pagamentos/Safe2Pay/promoções e demais IDs da matriz. Proteção contra senhas vazadas ainda desativada em ambos os projetos segundo advisors de segurança; não foi mudada pois exige configuração Auth não disponibilizada pelas ferramentas conectadas.

## Novo resultado comprovado: saques Corridas e rastreabilidade do deploy (08/11/2026)

- No Supabase Corridas, as funções mark_driver_withdrawal_failed, mark_driver_withdrawal_paid e mark_driver_withdrawal_processing continuam com verificação interna service_role. Seus ACLs foram testados em BEGIN/ROLLBACK e corrigidos efetivamente para anon=false, authenticated=false e service_role=true. Migração apois_corridas_inv018_withdrawal_state_service_only_20261108 aplicada, ACL 3/3 relida. Nenhuma função executada, nenhum saque ou saldo movimentado. Advisor de segurança: 66 funções SECURITY DEFINER abertas a anon (antes 69), não equivalem a 66 falhas comprovadas.
- No Vercel, a consulta por projectId sem teamId funcionou: domínio de produção parceiros.apoisbrasil.com.br está ligado ao deployment dpl_GT6JfV8dJ7MQrydb7Vo2MTde9G2r, source=cli, pronto desde 27/10/2026, sem metadado de commit. O preview de Estabelecimento dpl_J6ozrdGUkkipCczc5Tp8pSLKhHuy é de 03/11/2026 e corresponde ao repo apois-entregas branch legal/novos-planos-assinatura-homolog-20261103 commit ccd30fc03cc95119f702ceab27b85fd81e57c88d. O preview Cliente dpl_BYWSBwkQdNWc45DKNHSea3rdKXNF usa o mesmo commit e branch. Portanto preview e painel de produção não são o mesmo artefato e nenhum representa build testado desta branch auditada. Não trocar aliases nem alterar UI de fonte desconhecida.
- Ainda não há Bun no ambiente terminal com repo privado acessível, nem APK/E2E físico, e a divergência do snapshot Entregas package.json/bun.lock permanece. A correção do build não foi declarada concluída.

## Execução imediata adicional — 09/11/2026

- INV-015 / upload de imagem: bug concreto no pipeline de release de Estabelecimento — faltava invocar `harden-entregas-merchant-image-mime.mjs`, diferentemente do pipeline de Cliente. Agora executado antes de `fix-entregas-merchant-product-image-reconciliation-v1.mjs` e validado sobre duas fontes originais do snapshot protegido.
- Corrigido bug de reexecução: após a reconciliação INV-015 substituir o handler de upload, um novo hardener MIME anteriormente acusava transformação parcial, embora o novo handler tivesse MIME explícito e mais restritivo. Agora reconhece especificamente o handler validado, sem abrir exceção genérica para alterações desconhecidas. Ensaio real em V8: MIME → reconciliação → MIME → reconciliação, quatro execuções aprovadas.
- Suíte Node de fixture ampliada para incluir src/routes/merchant.tsx, garantir MIME de logo/capa e a idempotência. O teste de Node no checkout completo, Bun install, typecheck e build continuam pendentes. Não houve alteração da branch principal nem do banco de dados.
