# APOIS — Execução complementar do Relatório 02 (08/11/2026)

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
