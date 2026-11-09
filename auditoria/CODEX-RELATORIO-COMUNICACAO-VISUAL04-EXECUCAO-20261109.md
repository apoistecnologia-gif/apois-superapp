# APOIS — Relatório de Execução Visual 04 — Cliente/Passageiro

**Data de referência:** 09/11/2026  
**Relatório recebido:** `RELATORIO-VISUAL-04-APOIS-PASSAGEIRO-20261109(1).md`  
**Repositório de integração:** `apoistecnologia-gif/apois-superapp`  
**Única branch autorizada e modificada:** `audit/continuacao-20261107`  
**IDs visuais desta rodada:** VIS-017–019, correspondentes a CV-016–018.  
**Autorização:** alterações de aparência e acessibilidade; **não** homologação física, deploy, APK, alterações de negócio ou publicação.

## 1. Fontes efetivamente inspecionadas

- Snapshot Cliente/Passageiro fixado: `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`.
- Rotas reais lidas: `src/routes/_authenticated.buscar-destino.tsx` (SHA blob `d0f80674406d98d477b21a35662c6c32cfc57580`), `src/routes/_authenticated.revisar-solicitacao.tsx` (SHA blob `6bbe02c5fb7e08b7be79e13525893c518078e50b`).
- Contrato e origem das categorias: `src/types/pricing.ts` define `RideCategory.details?: any`; `src/services/categories/category-service.ts` mapeia `details: {}`; `src/components/pricing/ServiceDetailsForm.tsx` contém um placeholder de formulário, sem campos específicos para Fretes/Guincho/Envios naquele commit.
- `scripts/build-isolated-module.mjs`: execução dos geradores de busca, favoritos, confirmação, roteiro, preferências de conforto e checkout, mantendo testes preexistentes.
- `scripts/fix-corridas-ride-comfort-preferences-v1.mjs`: tipos e opções concretos `conversation` / `music` / `air_conditioning`, valores `quiet`, `talk`, `no_preference`, `yes`, `no`. Os valores já estão definidos pela interface; a alteração CV-04 não modifica esses contratos.
- `scripts/fix-corridas-client-comfort-finish-v2.mjs`: retorno automático de 3200 ms após `screenState === "completed"` e ID de corrida correspondente; arquivo **não editado**.

## 2. Alterações efetivamente registradas no integrador

| CV | Alteração visual, código gerado | Preservado | Estado |
|---|---|---|---|
| CV-016 / VIS-017 | Botão `clearQuery` de ícone X passa a ter `aria-label="Limpar busca"`, title, `type=button`, tamanho mínimo de 44 px e outline visível; alinhamento dentro do espaço já reservado ao input | `clearQuery`, digitação, composição, seleção de sugestões, Maps, histórico de destinos e favoritos | **Implementado em gerador**, sem TalkBack ou WebView |
| CV-017 / VIS-018 | Apresentação `Object.entries(selectedCategory.details)` usa `formatApoisReviewDetailLabel(key)` e `formatApoisReviewDetailValue(value,key)`. Known keys: conforto do usuário, comprovados no contrato. Valores genéricos: `boolean` = Sim/Não; números; arrays com separador; objetos recursivos legíveis; campos vazios; códigos não reconhecidos permanecem literais e nomes técnicos apenas são espaçados. Elementos de detalhe quebram linha e não impõem `capitalize` aos códigos originais | `selectedCategory.details` original, `confirmRide(comfort)`, preços, `checkout.finalTotal`, persistência e payload íntegros | **Parcial**: formato genérico implementado. Traduções específicas de Fretes/Guincho/Envios não podem ser inferidas do snapshot; nenhum contrato novo foi inventado |
| CV-018 / VIS-019 | **Nenhuma mudança de tempo ou navegação.** Risco de leitura do resumo de conclusão registrado para a engenharia. A duração observada no código é de **3200 ms** | `handleReturnHome`, estado completed, confirmação por ID, histórico e ciclo da corrida | **Pendente de decisão técnica**, sem teste de leitura real |

A existência de código genérico em CV-017 **não comprova ocorrência de identificadores técnicos na interface publicada**: no snapshot, `categoryService` retorna `details: {}`. O patch é defensivo e de apresentação; não substitui o trabalho de definir formulários e categorias. O relatório 04 não reabre nem resolve INV-064–066.

## 3. Arquivos editados na branch autorizada

- `scripts/fix-corridas-visual04-passenger-v1.mjs`: novo patcher visual fail-closed e idempotente para busca/revisão; modifica apenas a cópia descartável `.work/corridas`.
- `scripts/qa/test-corridas-visual04-passenger-v1.test.mjs`: teste sintético de botões, tipos de valores, contratos, idempotência, divergência de origem e guarda do temporizador.
- `scripts/build-isolated-module.mjs`: execução do patcher **após** `fix-report09-pricing-checkout-v1.mjs`, seguida de gate Node de fixture e conferência de marcadores.
- `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md`: incremento histórico CV-016–018, preservando CV-001–015 e os 67 registros técnicos.

Commits realizados nesta rodada, em ordem:  
`e54dc0e4cadec44b8777433f83d25ed7451d9a69` (patch inicial),  
`531ac79f86c4aa8771a51d70e171669bc6a46447` (teste),  
`98b00ddc07e307afa28c8d364630113b3012b6c9` (integração no builder),  
`2e394bc57ec8b3099c14601efb9c857003686b49` (quebra de linhas),  
`d10585374ecbfb4f3d55b9e8b759b4d21e142025` (teste de apresentação),  
`cc5b01403c57bd37cf2b9524ecc285c1b25c6175` (retornos tipados),  
`7bd7bb8f78e30b8d338d1cb70644ea8d298b98ba` (enum próprio / desconhecido),  
`ef3885d4ac49a977b9e1a5168ce1de1cf04d22ec` (teste de fallback),  
`c561fa26d224b1bbe48cc250d9a54b219f129578` (correção de sintaxe identificada na validação),  
`5e6ac0ddbe1bf8b828b1fefd4dc5879431a1ba9e` (matriz).

O último estado do patcher após todas as revisões foi novamente inspecionado e passou em teste isolado de sintaxe V8.

## 4. Testes realmente executados e grau de evidência

- **V8 em memória, com adaptador simulado de filesystem, sobre as duas rotas pinadas e a substituição relevante `confirmRide(comfort)` sintetizada:** 8/8 conferências PASS. Isso não equivale à execução completa da cadeia de transformadores.
- **V8 em memória com fixtures da suíte QA versionada:** 17/17 conferências na primeira bateria, incluindo transformador de nomes/valores; 6/6 conferências após melhoria de quebra de linhas; e **14/14 na validação final**, incluindo códigos desconhecidos como `toString` e `__proto__`, tipos primitivos, arrays/objetos, idempotência, tolerância a código fonte fixado e preservação do timer. Todas as baterias são **sintéticas**, sem React montado.
- **Parser:** o patcher e a suíte de QA foram inspecionados por V8 após tratar declarações de import ESM apenas para a inspeção. Uma regressão de aspas introduzida durante o ajuste do fallback foi detectada nesse passo e **corrigida antes do fechamento**. Resultado final: sintaxe **PASS**.
- **Contrato de montagem:** ordem confirmada visual CV04 **depois** do relatório 09, marcadores de busca/revisão verificados em script; `fix-corridas-client-comfort-finish-v2.mjs` mantém `finishHomeActionRef.current(), 3200`.
- **Não executado:** `node --test scripts/qa/test-corridas-visual04-passenger-v1.test.mjs` no checkout completo, build completo, Bun/TypeScript/lint, render real, Playwright no bundle final, TalkBack, Android físico, viagens, consultas e envio de dados a produção.

Os resultados sintéticos verificam apenas os componentes e invariantes exercitados. Nenhum APK ou bundle instalado foi acessado e nenhuma tela física foi considerada aprovada.

## 5. Encaminhamento VIS-019 — decisão reservada à engenharia

A interface de encerramento retorna à Home após 3200 ms somente quando a corrida foi confirmada como finalizada. Não há, neste relatório, evidência de perda de histórico, impossibilidade de leitura física ou recomendação comportamental autorizada. Engenharia deverá estudar:
- Leitura com fonte ampliada, TalkBack e alturas reduzidas;
- Possibilidade comprovada de rever o mesmo resumo pelo histórico;
- Eventual configuração do tempo ou controle de usuário com plano de impacto de navegação, sem presumir que o timeout deva ser removido.

**Nenhuma dessas decisões foi implementada na fase visual.**

## 6. Pendências de aceite físico e funcional

Após autorização expressa da etapa final, identificar SHA/versão do APK, abrir busca e revisão em 320, 360, 390 e 412 CSS px, orientação horizontal, barra Android/teclado, acessibilidade e fonte ampliada. Conferir `Limpar busca` no TalkBack e teste de composição, resultados e favoritos. Validar o renderizador por categoria com os **campos reais que existirem**, valores longos/nulos/listas/objetos; inspecionar CSS computado e retorno ao histórico. Garantir estados de carregamento, falha, confirmar, estimativa de preço e fluxo de solicitação intactos. Não fazer corrida/pagamento real nesta fase.

## 7. Preservação do projeto e contagem

`.apois/source-lock.json` preservado (SHA blob original `3f98789f28666ccc052175db10f138208dd0937b`). Nenhum repositório-fonte, main ou outra branch alterada. Nenhum merge, deploy, APK, SQL, pagamento, exclusão ou disparo. Relatórios técnicos mantidos: **67 achados; A 0, B 46, C 17, D 0, E 1, G 3**. Matriz CV independente atual: **18 achados (CV-001–CV-018)**. VIS-001 continua alias INV-047; VIS-007 retificado continua sem correção duplicada.

**Conclusão:** alterações visuais de baixo risco aplicadas no gerador e documentadas, sem homologação do produto real; VIS-018 parcialmente atendido por fallback seguro e VIS-019 formalmente encaminhado para decisão futura da engenharia.
