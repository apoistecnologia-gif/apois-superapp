# APOIS — RV-17 | Relatório independente de execução — cardápio e formulários

**Data:** 09/11/2026  
**Relatório de entrada:** `RELATORIO-VISUAL-17-APOIS-CARDAPIO-E-FORMULARIOS-20261109.md`.  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch escrita:** `audit/continuacao-20261107`  
**HEAD inicial confirmado:** `054b5fddf22bb058670749ee63b191b20e40585a`, último commit da RV-16.  
**Branch e commit da auditoria externa:** `audit/ecossistema-20261107@18f2fed7e27486f2b3a4170921a246344316a2a4`, somente leitura.  
**Status:** intervenções conservadoras implementadas no integrador; validação estática e testes de lógica em V8 realizados; **não homologado em React, web ou Android**.

## 1. Baseline verificado e proteção

Antes de alterar código, o HEAD da branch foi confirmado pelo GitHub, junto da matriz com **57 registros**, do relatório RV-16 e do blob de `.apois/source-lock.json` com SHA exato **`3f98789f28666ccc052175db10f138208dd0937b`**.

Origens pinadas, todas **somente leitura**:
- `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`
- `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`
- `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`

Foram lidos os três arquivos de produto no commit pinado e a ordem dos dois builders. O editor recebe anteriormente a reconciliação de imagem **INV-015** e a correção de acesso por teclado do seletor **RV-12/CV-043**. A RV-17 foi criada como overlay posterior, não como edição do snapshot ou substituição do código de upload.

## 2. CV-058 / VIS-059 — preço apagado não equivale a zero informado

**Antes (demonstrado no código):** `Number(draft.price)` converte string vazia em 0, e o handler rejeitava somente valores não finitos ou negativos. O botão de salvar tem `type="button"`, de modo que a presença de `min="0"` no input não bloqueia o handler por si só.

**Implementação no overlay:** no início de `saveProduct`, antes da conversão, o trecho `if (!draft.price.trim()) return toast.error("Informe o preço do produto.");` interrompe a atualização se o campo foi apagado ou contém somente espaços. `Number(draft.price)` e o predicado de rejeição de não finito/negativo continuam iguais para valores preenchidos. Campo recebe `required`, `aria-required="true"` e instrução vinculada por `aria-describedby`; a prévia deixa de mostrar R$0 quando o preço está vazio e passa a indicar **“Preço não informado”**.

**Regra preservada:** digitar `0` explicitamente continua produzindo o número 0 e seguindo a regra local anterior. Não foi criada proibição de produtos gratuitos, alterado o banco, o preço persistido, as casas decimais, a consulta Supabase ou a política de preços. A política de preço zero no backend **não foi verificada**; não se afirma que o servidor aceita produto gratuito.

**Testes de execução real do handler em V8 com `from("products")` e `onChanged` simulados:**
- `""`, `" "`, `"   "`: mensagem de preenchimento, **zero chamadas de update** e nenhum `onChanged`.
- `"0"`, `"0.01"`, `"19.90"`: uma chamada de update com preços 0, 0.01 e 19.9 respectivamente, preservando sucesso e `onChanged`.
- `"-1"` e `"abc"`: rejeição por preço inválido, nenhum update.
- Nome vazio com preço válido: sem update.

**Falta:** renderização e teste de clique/teclado em navegador, validação comercial do zero no servidor e execução de typecheck/build.

## 3. CV-059 / VIS-060 — persistências distintas no editor

**Antes:** o mesmo editor possuía `saveProduct` para dados básicos, `uploadImage` para imagem e funções individuais `createGroup`, `editGroup`, `toggleGroup`, `deleteGroup`, `createOption`, `editOption`, `toggleOption`, `deleteOption`. O botão principal dizia “Salvar produto”.

**Depois (apenas comunicação):** botão renomeado **“Salvar dados do produto”**. Texto junto a dados básicos identifica nome, descrição, preço e categoria. Instrução junto à imagem informa que sua gravação é independente do botão e orienta salvar previamente edições de texto/preço não concluídas. A seção de grupos e opções esclarece que as ações persistem por operação, e que fechar a janela não desfaz alterações já salvas.

**Preservado:** upload com tipos JPG/PNG/WebP, limite 10 MB, política de nome/storage, URL persistida com verificação de read-back e ausência de exclusão arriscada no reconciliador INV-015; edição e inclusão de grupos/opções; callbacks `onChanged`, `toast`, `setOpen(false)`, transações e dados. Não foi implementado autosave ou descarte em massa. A hipótese de confusão do usuário permanece a ser observada em interface real.

## 4. Ampliações dos achados anteriores

| ID original | Alteração efetiva | Risco pendente |
|---|---|---|
| **VIS-027 / CV-026** | `optionsError` distingue falha de consulta de grupos de falha de consulta de opções. Alerta `role=alert`, com texto compreensível e botão **Tentar novamente** que chama o `loadOptions` já existente; listas vazias são mostradas apenas sem erro de retorno. | Promises rejeitadas fora de um objeto `{error}` não receberam novo tratamento; testar falhas assíncronas e reabertura em React. |
| **VIS-028 / CV-027** | Editor e formulário de suporte passam a declarar diálogo modal com título `aria-labelledby`, botão Fechar de 44 px nominais e foco visual; formulário de suporte ganhou limite de altura e rolagem. **Editor já tinha `max-h-[94dvh]`/rolagem e foi preservado.** | Ciclo completo de foco, Tab/Shift+Tab, Escape, retorno ao acionador e leitor de tela não foram testados nem declarados corrigidos. |
| **VIS-032 / CV-031** | Grupos de estrelas agora diferenciam **“Nota do estabelecimento”** e **“Nota da entrega”** nos nomes acessíveis; textarea de comentário aponta para título “Comentário opcional”. Estrelas mantêm `role=radio`, `aria-checked`, nomes, foco e `onChange`. | Navegação assistiva efetiva/TalkBack pendentes. Nenhuma avaliação foi enviada. |
| **VIS-049 / CV-048** | Ajuda informa mínimos de **3 caracteres no assunto** e **10 na descrição**, com contador de caracteres faltantes; botão aponta para a explicação via `aria-describedby`. A condição de `disabled` e `customer-support` permanecem. | Renderizar texto/zoom e desabilitação real; não foi criado chamado. |
| **VIS-055 / CV-054** | Editor substitui mensagens brutas do serviço por frases neutras em português, com reconhecimento de rede e rate-limit; registra detalhes no console para diagnóstico sem copiá-los ao usuário. | Testar classificação das respostas de erro reais com mocks e garantir tratamento de todas as operações; outros componentes não foram alterados. |

A RV-17 não reabriu VIS-044 como defeito novo: a correção RV-12 de teclado no seletor de imagem foi preservada.

## 5. Arquivos novos e modificados

| Caminho | Operação |
|---|---|
| `scripts/fix-entregas-menu-forms-visual17-v1.mjs` | **NOVO:** overlay reversível/idempotente para três componentes |
| `scripts/qa/test-entregas-menu-forms-visual17-v1.test.mjs` | **NOVO:** sete testes de validação, handlers, escopo, acessibilidade e ordem |
| `scripts/build-isolated-module.mjs` | Adiciona overlay RV-17, gate Node versionado e marcadores antes da verificação final |
| `scripts/build-merchant-panel.mjs` | Mesmo fluxo para o builder Merchant separado |
| `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | CV-058, CV-059 e cinco ampliações, com pendências |
| `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL17-EXECUCAO-20261109.md` | Este relatório |

Os dois builders executam o overlay **depois** da reconciliação de imagem INV-015 e RV-12, RV-13 e RV-16. A aplicação modifica **somente** `.work/entregas/src/components/MerchantProductEditor.tsx`, `.work/entregas/src/routes/pedido/$orderId/avaliar.tsx` e `.work/entregas/src/routes/perfil/ajuda.tsx`. A função calcula as três versões em memória, exige âncoras únicas e idempotência, e grava somente depois de validar todas. Nenhum arquivo de código na fonte pinada foi modificado.

## 6. Evidências e testes realmente executados

1. GitHub real: HEAD inicial, source-lock, matriz, builder isolado, builder Merchant, três arquivos do snapshot protegido, scripts anteriores de reconciliação de imagem e RV-12.
2. V8, aplicação dos patches reais sobre o snapshot: **3/3 transformações aplicáveis, idempotentes e fail-closed** quando a âncora é alterada.
3. V8, ordem efetiva de geração do editor: `fix-entregas-merchant-product-image-reconciliation-v1.mjs` executado em memória, seguido de `patchProductImage` da RV-12 e do patch RV-17, preservando os três marcadores, o handler seguro de imagem e a validação do preço.
4. Suite `scripts/qa/test-entregas-menu-forms-visual17-v1.test.mjs` executada em **harness V8 com arquivos gerados em memória**, em substituição a um checkout Node real. **7/7 verificações passaram:** preço em branco, zero/decimal/negativo/inválido e nome vazio; escopo de três gravações; erro versus lista vazia; erros não expostos; duas notas e comentário; mínimos 3/10 no suporte; integrações de builders e fonte pinada. Correção intermediária da asserção de preservação da instrução de adicionais após primeira tentativa falha: erro foi de âncora com espaçamento incorreto, ajustado e novamente testado.
5. Revisão do patch: `from("products")`, métodos CRUD dos adicionais, upload, `submit_order_review`, `customer-support`, `max-h` do editor, status das avaliações e desabilitação de envio mantidos.

**NÃO executado:** `node --test` em checkout real com dependências, typecheck, lint, Vite/bun/build, renderização React, DOM/browser, prova de foco, teclado, 320/360/390 px, zoom, TalkBack, Android, upload real, alteração de produto real, avaliações, chamados, requests remotas, banco, deploy, merge, GitHub Actions ou APK. Os testes Node estão versionados nos builders, mas só suas funções foram verificadas no harness V8. **Não declarar aplicação em APK ou homologação.**

## 7. Commits da implementação anteriores a este relatório

1. `bc0c892ad018176dcd350d75c571be2c9aa5b4c6` — overlay inicial.
2. `273ef30bb2d145ed1b4a29117825eb0f0c113913` — guarda de âncora textual corrigida.
3. `92e78fc61acdf0dab7279fb4e77809bc943382e9` — suíte versionada.
4. `87ae150d820f68a1fb2c5c289805dfe87b35dc17` — builder isolado.
5. `32dd95af355a321a3bcc4121d44abab1c43e34fa` — builder Merchant.
6. `4062a6f6e1750a0b74df4d5c568abee0bc10e7c8` — orientação preventiva junto à imagem.
7. `4457bf3683c1011547ec05deeda8a492ce7b66e7` — matriz RV-17.

Todos apenas na branch de trabalho autorizada.

## 8. Saldo de auditoria e limites de autorização

**59 registros visuais CV-001–CV-059**, sendo 57 anteriores e dois novos; cinco ampliações sem repetição de IDs. Matriz técnica histórica: **67 achados**, A=0, B=46, C=17, D=0, E=1, G=3. Próximo identificador visual **CV-060**.

CV-058 está **implementado, não homologado**, sem alteração da política do servidor para preço zero. CV-059 é **correção textual implementada, eficácia UX a confirmar**. Permanecem CV-039 P1 (Merchant distribuído/itens de pedido e impressão), CV-037 (tema), CV-038 (endereços longos), CV-053 (política de senha), CV-056 (histórico financeiro/limites), CV-057 (recência de localização), VIS-028 (foco de modais), além dos testes integrados, QA Android/TalkBack e exame do ambiente real. CV-030 continua não aplicável ao contrato de banco versionado salvo novas evidências.

Não gerar APK, não publicar, não modificar banco/RLS/preços ou repositórios-fonte, não fazer merge e não declarar prontidão de produção. A homologação final só ocorrerá após o comando explícito do responsável.
