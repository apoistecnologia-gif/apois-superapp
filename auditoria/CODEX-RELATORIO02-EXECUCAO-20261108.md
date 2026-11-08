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
| INV-024 | Migração `apois_inv024_visible_merchants_open_status_20261108` consta no histórico; RPC `apois_visible_merchant_order_status(uuid[])` acessível aos autenticados, consulta `merchant_accepting_orders` | RPC aplicada; client integrado em builders; sem teste de fuso/24h/cidade inativa |
| INV-018 | `apois_inv018_restrict_anon_admin_rpc_execute_20261108` aplicada nesta continuação, a partir de `20261108_inv018_restrict_anon_admin_rpc_execute.sql` | 20/20 funções privilegiadas `public.admin_*` bloqueadas para `anon`; 20/20 preservadas para `authenticated` e `service_role`. Permanecem outras RPCs expostas para análise |

A migração de ACL INV-018 foi primeiro testada com `BEGIN/ROLLBACK`; durante o teste todas as 20 funções perderam acesso anônimo. Após aplicação por ferramenta Supabase, nova consulta confirmou `anon=0/20`, `authenticated=20/20`, `service_role=20/20`. Os corpos das 20 funções já possuíam a validação `current_user_is_admin()`. **O alerta original de 113 funções `SECURITY DEFINER` acessíveis por `anon` não está totalmente encerrado**; uma parte é legítima RPC autenticada e outra exige revisão de ACL e de privilégio interno.

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

`fix-entregas-persisted-cart-validation-v3.mjs` consulta catálogo, opções e grupos vigentes na restauração da sacola e bloqueia itens marcados indisponíveis. O código do checkout contém gate antes do PIX, aceitando total autoritativo apenas mediante conferência/consentimento em caso de divergência. **Não executar o verificador de integridade em isolamento como substituto de typecheck/build.** Ainda falta confirmar tratamento fail-closed de falha de rede durante revalidação, atualização quando o estabelecimento muda dados com app aberto e testes reais em telas.

### INV-028 — Vercel

A ferramenta Vercel listou os projetos `apois-entregas-estabelecimento`, `apois-estabelecimento-visual-preview` e `apois-entregas-visual-preview`. Porém, a consulta de deployments com escopo do projeto/equipe retornou **HTTP 403 (forbidden)**. Não foi possível atribuir a captura de texto pálido sobre fundo branco a uma URL/commit específica. **Não houve CSS alterado por presunção nem deploy.**

### Outros bloqueios herdados do Relatório 01

- INV-001: protocolo ausente na consulta paginada; INV-012: fallback de instalação `bun` e lint não bloqueante no builder de estabelecimento; INV-020: texto SQL com codificação incorreta; INV-010: pagamento Safe2Pay não homologado; INV-017: checagens de credenciais vazadas; INV-019: aliases não identificados.
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
