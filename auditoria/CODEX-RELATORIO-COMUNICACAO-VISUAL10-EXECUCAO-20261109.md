# APOIS — RV-10 | Relatório independente de execução: produtos e sacola

**Data da auditoria:** 09/11/2026  
**Arquivo-fonte recebido:** RELATORIO-VISUAL-10-APOIS-PRODUTOS-SACOLA-20261109(1).md  
**Repositório e branch únicos de escrita:** apoistecnologia-gif/apois-superapp — audit/continuacao-20261107  
**Estado inicial:** RV-09 finalizado em a5639fd6b1ad1183526916618c2ce042e8178da9, matriz visual CV-001–CV-028.  
**Registros:** CV-029 / VIS-030 (P2, intervenção visual implementada) e CV-030 / VIS-031 (P2 do auditor, **não aplicável ao contrato de dados pinado**; sem patch de limites).  
**Escopo:** apenas visual e acessibilidade da seleção de opções; preservar checkout, pagamento direto e dados de catálogo. **Nenhuma homologação ou produção executada.**

## 1. Inspeção real, versão e source-lock

Foram lidos, com acesso apenas de leitura aos repositórios-fonte, os seguintes artefatos da versão protegida Entregas **2f4606e0fb52dffb49f2e6aebbe921ce687ab625**:
- src/components/ProductCustomizationSheet.tsx — todo o componente de seleção, instruções, contagem, adicional, preço, confirmação e JSX;
- src/routes/sacola.tsx e src/routes/checkout.tsx — preservação de subtotal, controles de quantidade e cálculo de totais;
- supabase/migrations/20260807231500_create_product_options.sql — criação de grupos e CHECKs de mínimo e máximo;
- src/integrations/supabase/types.ts — tipagem não nula de max_selections;
- src/components/MerchantProductEditor.tsx — validação de valores na edição e criação;
- supabase/migrations/20260808060000_create_order_atomic.sql — validação server-side do número mínimo/máximo por grupo no pedido, **não executada**.

No integrador autorizado foram examinados scripts/harden-entregas-overlay-layering.mjs, scripts/harden-entregas-superapp-image-fallbacks.mjs, scripts/harden-entregas-superapp-cart-mobile-ui.mjs, scripts/harden-entregas-superapp-checkout-mobile-ui.mjs, scripts/harden-entregas-payment-provider-boundary.mjs, scripts/harden-entregas-superapp-secondary-mobile-ui.mjs, .apois/modules.json e os dois builders.

A observação inicial do literal pinado mostra que o sheet não tem diretamente o marcador de padding final de safe-area, porque ele é gerado por **dois hardeners sequenciais**: primeiro harden-entregas-superapp-image-fallbacks.mjs transforma o footer em padding dinâmico, depois harden-entregas-overlay-layering.mjs adapta esse padding e a altura de 90dvh. O patch visual novo foi posicionado **depois** dessas transformações para não confundir a fonte crua com a UI final.

Arquivo protegido .apois/source-lock.json: SHA blob **3f98789f28666ccc052175db10f138208dd0937b**, não editado. As três fontes protegidas permanecem nas refs:
- Entregas: 2f4606e0fb52dffb49f2e6aebbe921ce687ab625.
- Corridas/Passageiro: 7b047f75a1a919a5336c0df6e0d60b14b02f2618.
- Corridas/Motorista/Admin: 9fc171050d8b5703540c49d19a8f1e9f5162775f.

## 2. CV-029 / VIS-030 — opções clicáveis sem semântica

**Antes:** cada adicional era apresentado como div com onClick. A cor e o ícone Check indicavam seleção visual, mas não existia botão nativo, role, tabIndex nem estado aria-pressed/aria-checked para cada opção. Não se pode afirmar, sem aparelho/DOM, qual seria a experiência efetiva do TalkBack publicado.

**Depois (overlay somente sobre .work/entregas/src/components/ProductCustomizationSheet.tsx):**
- cada div de opção torna-se um **button nativo** type="button", com estado aria-pressed={isSelected} anunciado a leitores de tela;
- a propriedade HTML disabled={isDisabled} informa que a escolha está bloqueada quando o máximo permitido já foi atingido para uma opção ainda não selecionada;
- o grupo é rotulado com role="group" e aria-labelledby apontando para seu título já existente; cada button referencia também a instrução do grupo em aria-describedby;
- foco visível, text-align à esquerda, largura total e área de toque mínima 44 px sem alterar ícones, hierarquia, cores de seleção ou estrutura de preços;
- **não** se adicionou onKeyDown nem um segundo callback, pois button já responde a Enter/Espaço com o onClick nativo;
- foi preservada exatamente uma invocação a handleToggleOption(group.id, option.id, group.max_selections), guardada por !isDisabled como antes; o próprio handler e setSelections não foram alterados;
- mantidos isGroupValid, isAllValid, totalPrice, Number(opt.price_delta), handleConfirm, onConfirm(formattedOptions), campos adicionais, imagens e footer.

O overlay implementado em scripts/fix-entregas-product-customization-visual10-v1.mjs é idempotente, usa marcador versionado APOIS_CV10_PRODUCT_CUSTOMIZATION_ACCESSIBILITY_V1, recusa fontes que não possuam os anchors da implementação esperada e não modifica arquivos de source/pins, catálogo, valores ou seleção persistida.

## 3. CV-030 / VIS-031 — mínimo positivo com máximo nulo

**Relatório original:** demonstrou uma combinação sintética na qual group.min_selections=2 e group.max_selections=null. A UI daria “Opcional”, embora isGroupValid exigisse duas escolhas.

**Verificação do contrato pinado:**
- criação da tabela: max_selections integer **NOT NULL DEFAULT 1**;
- CHECK product_option_groups_max_selections_check: max_selections >= 1;
- CHECK product_option_groups_selection_logic_check: max_selections >= min_selections;
- row TypeScript product_option_groups: max_selections: **number**;
- criação/edição no MerchantProductEditor: ambos convertem mínimo e máximo em número, exigem Number.isInteger, min>=0, max>=1 e min<=max;
- função create_order_atomic compara a seleção com mínimo e máximo retornados do banco.

**Decisão:** a condição max_selections=null é **incompatível com esse esquema versionado**. Portanto, CV-030 fica **não aplicável ao contrato pinado, sem correção textual, nenhuma modificação de limites ou validação**. É um risco condicional que só deverá ser revisitado se a estrutura **efetivamente implantada** ou alguma fonte de grupos fora do contrato permitir nulo. Não houve acesso à produção, portanto não afirmamos que o banco implantado não tenha divergido do esquema versionado.

O próprio componente continua aceitando maxSelections: number|null como possibilidade no handler legada; isso não justifica criar novos casos de catálogo. Não foi modificado getGroupStatus nem isGroupValid.

## 4. Arquivos versionados e ordem de montagem

| Operação | Arquivo | Resultado |
|---|---|---|
| Novo | scripts/fix-entregas-product-customization-visual10-v1.mjs | Patch cirúrgico de semântica e foco, idempotente |
| Novo | scripts/qa/test-entregas-product-customization-visual10-v1.test.mjs | Testes de fixture pinada, estado/semântica, seleção, limites e ordem de build |
| Modificado | scripts/build-isolated-module.mjs | Cliente Entregas no Superapp; aplica overlay, node --test e gate do marcador **antes do typecheck** e depois dos hardeners e do RV-05 |
| Modificado | scripts/build-merchant-panel.mjs | Mesmo overlay e gate no caminho que monta Cliente Entregas e Merchant; depois das transformações existentes e antes do typecheck/build |
| Modificado | auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md | Adiciona CV-029 e CV-030, preservando CV-001–CV-028 |
| Novo | auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL10-EXECUCAO-20261109.md | Relatório independente desta rodada |

**Commits efetivamente realizados na branch:**
- cf5e99db8edd4766b492124a1956ff15da504141 — criação do overlay, finalizado em 72fbaa8c4681ebdf485b9adf3440d87cb94ad72b com marcador JSX idempotente;
- d0b5e4b8d4952840f595b6cedd2351d29b4d0ffa — testes Node;
- 281b7700b96e032e9adefba443c37b059605b373 — integração Cliente Entregas no Superapp;
- dfcf4e1be9795ac766abed041c74bede2834c15a — integração Cliente Entregas no builder Merchant;
- e8b066cc34b4e812453a6d804ae1f4528c72f56f — matriz visual.

O commit do próprio relatório é gerado na escrita do GitHub e identificável pelo histórico.

## 5. Evidência dos testes efetivamente executados

**Executados:** leitura remota da fonte pinada; revisão dos dois hardeners de viewport e de footer; aplicação em memória, dentro de V8, da função patchProductCustomization real extraída do script versionado sobre a fonte com transformações de layout equivalentes às existentes no builder. As **11/11 verificações V8** concluíram com êxito: esquema max NOT NULL, CHECK max>=min, TypeScript max non-null, Merchant valida limites, botão nativo aria-pressed/disabled, nome de grupo, descrição da instrução, idempotência, callback único, ausência da div clicável antiga e cinco blocos de lógica/preço/validação preservados. O handler de seleção original foi avaliado isoladamente com estado mockado em 7 passos, inclusive seleção única que substitui outra, seleção múltipla que limita a quantidade e remoção de seleção. Os scripts JS novos tiveram sua sintaxe analisada em V8. Foi verificada a ordem e presença do patch e dos testes nos dois builders.

**Não executados:** node --test dentro de um checkout completo, bun install, typecheck, lint, build React, árvore DOM/acessível real, Tab/Enter/Espaço físicos, leitor de tela Android, navegação no teclado virtual, query em catálogo de produção, carrinho real, pedido, pagamento, WebView, APK ou deploy. Os testes estão **versionados no GitHub e integrados como gates futuros**, não se deve chamá-los de aprovados no build.

**Pendências:** homologar seleção com teclado e TalkBack, opções habilitadas/desabilitadas e pronunciamento de nome/preço/estado, interações com máximo=1 e máximo>1, opção já selecionada no máximo, nomes extensos, rolamento, foco e safe-area em 320/360/390/412 px, paisagem e fonte ampliada. Separadamente, conferir read-only o esquema/catálogo implantados antes de eventualmente reabrir CV-030, se autorizada a investigação em produção.

## 6. Preservações e resumo

Sem mudança no valor dos adicionais, regras de escolha, cadastro de produtos, controle da sacola, subtotal, entrega calculada no checkout, desconto, pedido mínimo, total, status do pedido, mensagens de pagamento direto ou desligamento do gateway antigo. Não houve criação de pedidos, alterações de dados, chamadas de pagamento, SQL/RLS, alterações no Supabase, autenticação ou segurança.

**Consolidação visual:** 30 registros CV-001–CV-030; **CV-030 apenas classificado não aplicável no contrato pinado** (não um novo defeito confirmado nem algo “corrigido”). VIS-001 segue como alias INV-047; VIS-007/CV-006 segue retificado.

**Classificação histórica técnica inalterada:** 67, A=0, B=46, C=17, D=0, E=1, G=3.

**Bloqueios preservados:** sem merge, deploy, APK, publicação, homologação física ou edição de .apois/source-lock.json / repositórios protegidos. Próxima numeração visual, se vier RV-11: CV-031.

**Estado final:** CV-029 **implementado em scripts e verificado sinteticamente, sem validação de runtime real**. CV-030 **não aplicável ao contrato pinado, sem intervenção**.
