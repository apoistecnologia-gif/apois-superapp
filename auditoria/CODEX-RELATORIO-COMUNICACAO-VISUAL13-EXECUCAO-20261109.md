# APOIS — RV-13 | Relatório independente de execução

**Data:** 09/11/2026  
**Relatório recebido:** RELATORIO-VISUAL-13-APOIS-COMPONENTES-COMPARTILHADOS-20261109(1).md  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch escrita:** `audit/continuacao-20261107`  
**HEAD inicial confirmado:** `d8b5b21adce734aa97393301989512f6fbf9eb8c`  
**Origem de referência do auditor:** `audit/ecossistema-20261107` — não modificada.  
**Status:** correções de apresentação preparadas e versionadas, homologação **NÃO** concluída.

## 1. Gate inicial de integridade

O HEAD inicial da branch foi confirmado diretamente via `refs/heads/audit/continuacao-20261107`. A matriz CV-001–CV-043 e o relatório RV-12 foram lidos antes de alterar código. `.apois/source-lock.json` retornou SHA blob `3f98789f28666ccc052175db10f138208dd0937b`; três repositórios de origem continuam protegidos:

| Fonte somente leitura | Commit fixado |
|---|---|
| apoistecnologia-gif/apois-entregas | `2f4606e0fb52dffb49f2e6aebbe921ce687ab625` |
| apoistecnologia-gif/say-hello-buddy-23-84b5dcbf | `7b047f75a1a919a5336c0df6e0d60b14b02f2618` |
| apoistecnologia-gif/movvi-go-connect | `9fc171050d8b5703540c49d19a8f1e9f5162775f` |

## 2. Inspeção do código montado e risco de regressão

O `AppBottomNav.tsx` pinado tem quatro `NavButton` e ação central `/buscar`. O hardener `harden-entregas-superapp-auth-runtime.mjs` muda as dimensões para 72 px de largura mínima em cada botão lateral, 68 px no central, padding horizontal `px-2` e altura mínima lateral de 64 px. Nesse estado, mínimo nominal 4×72+68+16 = 372 CSS px. A fonte de navegação, posteriormente, recebe somente marcador V5 e regras de aparência V5/V6. O CSS V6 já prevê `[aria-current="page"]`, mas o botão original não emite o atributo.

Os três componentes `AppBottomNav.tsx`, `ui/dialog.tsx` e `ui/prompt-dialog.tsx` foram consultados diretamente no commit Entregas pinado. `harden-entregas-overlay-layering.mjs` muda o z-index Radix do diálogo antes de RV-13. `ui/confirm-dialog.tsx` usa AlertDialog e foi inspecionado, **não modificado**. Nem o diálogo de confirmação nem `ProductCustomizationSheet` foram confundidos com o DialogContent genérico. As alterações RV-13 são aplicadas **depois** dos hardeners e de RV-12, tanto em `build-isolated-module.mjs` quanto em `build-merchant-panel.mjs`. Os dois builders executam o novo `node --test` antes da etapa de compilação quando o ambiente completo estiver disponível.

## 3. Novos registros e alterações feitas

| CV / VIS | Antes e evidência | Mudança efetiva | O que falta verificar |
|---|---|---|---|
| **CV-044 / VIS-045** | Degradês vermelho-claro com texto branco apresentavam contraste nominal mínimo 3,757:1 no Parceiro e 4,258:1 no Cliente | Em `superapp/partner-shell/index.html` o gradiente virou `#D51722 → #CE101A → #C9141B`. Em `superapp/shell/index.html` virou `#D51722 → #C9141B`. Contrastes sRGB por endpoint: 5,283:1; 5,655:1; 5,834:1. | Medição da cor final sob as letras, foco, active, Android e layout |
| **CV-045 / VIS-046** | Rodapé nominal de 372px em telas de 320/360px | Os quatro botões passaram a `min-w-0 flex-1 sm:min-w-[72px]` e o centro recebeu `shrink-0`. Preservada altura mínima 64px, ícones, rotas e centro 68px. Em 320px, divisão nominal lateral 59px. | Largura computada, overflow, zoom/fonte grande, safe-area e alcance por toque em 320/360/390/412 |
| **CV-046 / VIS-047** | DialogContent sem altura máxima e rolagem genérica | Acrescentados `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain`. Radix, foco, children, props, status e slots preservados. | Muitos campos, teclado virtual, foco/Tab e leitura dos botões em telas curtas; consumidores específicos |
| **CV-047 / VIS-048** | Botão Radix de fechar com texto sr-only `Close` | Apenas `Close → Fechar`. | TalkBack/nome acessível final |
| **CV-048 / VIS-049** | `required` atua no `canSubmit`, mas não era indicado | O label apresenta `(obrigatório)` se o próprio rótulo não o informa e Input/Textarea recebem `aria-required`. Nenhum trecho da validação, Enter, onClick, value, default, cancelamento ou confirmação mudou. | Labels reais, comportamento com leitores de tela e formulários extensos |

**Ampliados sem duplicar identificadores:** VIS-034/CV-033 (`aria-current="page"` no botão ativo); VIS-035/CV-034 (nomes acessíveis `Acessar Corridas` e `Acessar Entregas` na entrada); VIS-004/CV-003 (acionador X com `min-h-11 min-w-11`, 44px nominal, sem trocar primitivo nem handlers).

## 4. Arquivos modificados e versionados

| Caminho | Tipo |
|---|---|
| `scripts/fix-entregas-shared-visual13-v1.mjs` | Novo overlay com âncoras fail-closed, idempotência e planejamento antes da escrita |
| `scripts/qa/test-entregas-shared-visual13-v1.test.mjs` | Novo teste Node versionado e integrado aos builders |
| `scripts/build-isolated-module.mjs` | Vinculação RV-13, gate de testes e de marcadores |
| `scripts/build-merchant-panel.mjs` | Mesma vinculação para Merchant |
| `superapp/partner-shell/index.html` | Apenas cores do botão principal |
| `superapp/shell/index.html` | Cores do CTA e nome dos dois destinos |
| `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | CV-044–048 e ampliações sem duplicação |
| `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL13-EXECUCAO-20261109.md` | Este relatório |

## 5. Testes realmente executados

1. **GitHub real, somente leitura:** confirmação do HEAD inicial; blob SHA do lock; leitura integral da matriz e RV-12; leitura do código pinado de navegação, Dialog, PromptDialog e ConfirmDialog; rastreamento de hardeners, camadas, regras V5/V6 e dois builders.
2. **Execução sintética V8 em memória da implementação RV-13:** o código real das funções de patch, carregado do commit da branch, foi compilado em V8 para verificação de sintaxe e executado contra os três componentes pinados após reconstituição em memória das transformações preexistentes relevantes. Resultado final: **3/3 transformações aplicáveis, 3/3 idempotentes, 3/3 rejeições de desvio de âncora; marcadores presentes em todos os três componentes**. Uma falha encontrada no primeiro teste (`requirements` de classes não contíguas) foi **corrigida** no commit `a0a12be966af039cc161ed6ba149efd738f285f7`, e a execução foi repetida com sucesso.
3. **Cálculo sRGB independente:** nova paleta de endpoints dos dois CTAs com contraste branco superior a 4,5:1.
4. **Geometria nominal:** com `px-2` (=16 px) e centro de 68 px, resta (320−16−68)/4 = 59px em 320px; 69px em 360px, em condições nominais sem outros overrides. **Não** é medição de DOM/computed styles.
5. **Integridade do fluxo por comparação estática:** cinco destinos de navegação permanecem no componente transformado; DialogPrimitive.Close/Content preservados; canSubmit/Enter do Prompt preservados.

**Não executado:** `node --test` em checkout integral, `bun run typecheck`, lint, build, testes React/DOM, Chromium real dos apps, contraste por pixels, CSS computado, foco com teclado real, TalkBack, dispositivo Android, impressão, integração com API, dados reais, produção ou qualquer APK. Os testes Node estão **adicionados aos builders**, não devem ser declarados aprovados até serem executados em checkout completo.

## 6. Pendências anteriores preservadas

- **CV-037:** preferências Claro/Escuro/Auto do Motorista ainda sem medição real.
- **CV-038:** endereços longos em pequenas telas ainda sem renderização validada.
- **CV-039 P1:** `build-isolated-module.mjs` incorpora `fix-entregas-merchant-order-review-v1.mjs`, enquanto `build-merchant-panel.mjs` **não** o incorpora. O overlay RV-12 não cria a consulta enriquecida por conta própria. Sem identificar o Merchant efetivamente distribuído, conferir itens/adicionais reais de teste e impressão, **não há resolução operacional confirmada**. Nenhuma query ou regra de pedidos foi alterada na RV-13.
- **CV-030:** não aplicável ao contrato pinado de banco até haver evidência de divergência implantada.

## 7. Commits de implementação RV-13

1. `3e6d5a7a56440b9cad0efe7cbf93e1623ba8daaf` — overlay compartilhado inicial;
2. `f6bfd85e731ce74ae083a0aa085d0ee036714fb7` — testes versionados;
3. `100e4760f84a77cfb8b445f1df49cb58c454a2a9` — gradiente Parceiro;
4. `9b9101756b277d35dcda2286bb79ddae381e86f8` — gradiente/nome de módulo Cliente;
5. `be18eed1bb586fc7bec5e465174184e3725947ea` — builder isolado;
6. `0c1455fd3c90c9bb579ba0bbb51fb610e325878a` — builder Merchant;
7. `a0a12be966af039cc161ed6ba149efd738f285f7` — corrigida verificação de tokens do overlay;
8. `1fd7f00dddafb6bcf3eed2a15d7a400d39ae102c` — matriz CV-044–048.

Todos são na branch autorizada, sem merge nem publicação.

## 8. Integridade e encerramento de rodada

**48 registros visuais CV-001–CV-048** (43 de RV-12 + cinco desta rodada); três ampliações sem duplicação. **67 achados técnicos históricos** mantidos em A=0, B=46, C=17, D=0, E=1 e G=3. Próximo ID **CV-049**.

A validação final do blob SHA `.apois/source-lock.json` deverá permanecer em `3f98789f28666ccc052175db10f138208dd0937b`; nenhum repositório-fonte, SQL/RLS, regra de negócio, preço, cobrança, autenticação, callback, deploy, serviço de produção ou APK foi modificado. Mudanças da RV-13 são reversíveis em commits isolados. O produto **não** foi declarado homologado, e não está autorizado gerar APK até o comando explícito de homologação final.
