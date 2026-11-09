# APOIS — Matriz independente de comunicação visual — CV 01

**Data:** 09/11/2026. **Repositório:** `apoistecnologia-gif/apois-superapp`. **Branch de integração autorizada:** `audit/continuacao-20261107`.

## Integridade histórica

Esta matriz **NÃO substitui** `CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` nem `CODEX-PENDENCIAS-VERIFICACAO-FISICA-RELATORIOS01-14-20261109.md`. Base técnica preservada, conforme declaração dos relatórios 01–14: **67 achados; A 0, B 46, C 17, D 0, E 1, G 3**. Não promover os estados históricos sem nova evidência.

**VIS-001 = alias de INV-047:** fora da nova contagem visual. Identificadores VIS-002–009 pertencem ao relatório externo de 09/11/2026. Aqui, cada referência recebe CV-001–008. IDs CV organizam trabalho visual; referências INV já existentes não geram achados técnicos duplicados.

## Achados visuais — rodada 01

| CV | Origem | Prioridade | Superfície | Evidência original | Estado na integração em 09/11 | Aceite restante |
|---|---|---|---|---|---|---|
| CV-001 | VIS-002 / INV-028 | P1 | Estabelecimento / login público | Texto de produto #FDEBED em branco, contraste 1,15:1, 14 px | **Pendente de vinculação a build publicado**. Fonte pinada do login Entregas é escura; não corrigir cegamente o CSS de uma versão possivelmente diferente | Identificar commit/deployment publicado; contraste >=4,5:1 no contexto claro e verificar estados escuros |
| CV-002 | VIS-003 | P1 | Estabelecimento / Entrar | Texto #070707 sobre gradiente vermelho, extremos de 4,33:1 e 3,45:1 | **Preparação existente, sem comprovação no publicado**: `fix-entregas-login-cta-contrast-v1.mjs` aplica branco apenas ao CTA na montagem merchant; falta vincular e renderizar o deployment | Verificar botão Entrar, hover, loading, disabled e efeitos de CSS posterior |
| CV-003 | VIS-004 / INV-029 | P2 | Estabelecimento / revelar senha e recuperação | Áreas de 20 px observadas na página | **Preparação existente, não homologada**: `fix-entregas-login-accessibility-v2.mjs` amplia alvo de toque no código gerado | Captura final, área 44x44 quando aplicável, ausência de sobreposição e teste touch |
| CV-004 | VIS-005 / INV-030 | P2 | Estabelecimento / inputs | DOM público sem associação observada de labels | **Preparação existente, não homologada**: overlay `fix-entregas-login-accessibility-v2.mjs` associa `htmlFor/id` no source transformado | Associar no DOM publicado, testar clique no label, teclado e leitor de tela |
| CV-005 | VIS-006 | P2 | Motorista / login | Texto técnico `APOIS Parceiro • visual 18` na UI | **Alterado em gerador**, commit `10703768`: removido texto técnico visível; preservado `data-apois-partner-auth-v18` e logic de auth/Google | Rodar gerador, typecheck, comparação de DOM, APK físico |
| CV-006 | VIS-007 | P2 | Motorista / placeholder | Regra intermediária v19 #808995 resulta ~3,54:1 | **Sem duplicação de patch**: etapa posterior `fix-partner-input-contrast-v1.mjs` escreve #596372 em branco, com `!important` e ordem posterior | Verificar CSS computado após cadeia completa, autofill e WebView Android |
| CV-007 | VIS-008 | P2 | Passageiro / localização | Sigla GPS em 10 px sem orientação na Home | **Alterado em gerador**, commit `40f745a5`: mensagem existente `locationError` apresentada em card rolável com status acessível; nenhum fluxo do GPS alterado | Rodar compilação, verificar erro negado/indisponível/timeout e 320–412 px, teclado e TalkBack |
| CV-008 | VIS-009 | P2 | Motorista e Passageiro / microtipografia | Auxílio Motorista 10,5 px; assinatura decorativa Passageiro 8 px | **Parcial no código**, commit `10703768`: Motorista aumentou informativo para 12 px. Assinatura decorativa VAMOS? mantida conforme relatório, dependente de renderização | 320–412 px, fonte ampliada, teclado, quebras e contraste contextual |

## Restrições e evidências

- Fonte pinada continua **imutável** em `.apois/source-lock.json`; não alterar nenhum repositório-fonte protegido.
- Não modificar login, Auth, Google, Supabase, RPC, RLS, pedidos/corridas, Safe2Pay, geolocalização, rotas ou handlers.
- O painel do Estabelecimento observado em `parceiros.apoisbrasil.com.br/login` **não tem SHA de publicação associada** nesta rodada. Não inferir que o bundle atual é a página observada.
- Teste de contrato estático adicionado: `node --test scripts/qa/test-comunicacao-visual-01-v1.test.mjs`. Só registrar como executado após execução real.
- Estado de compilação, navegador real e Android físico: **pendentes**. Nenhum APK, deploy, merge, SQL ou pagamento autorizado/executado.
- Dependências INV-047/VIS-001 e INV-065 são funcionais; não chamar corrigidas apenas por mudança de mensagem/cor.

## Encaminhamento

Prioridade de publicação futura: identificar exatamente a origem do login Estabelecimento e verificar CV-001/002/003/004; validar posteriormente o resultado final dos overlays CV-005/006/007/008 em 320, 360, 390 e 412 CSS px, orientação horizontal, fonte ampliada, foco, safe-area, teclado aberto e Android físico. Esta matriz é **incremental**, será ampliada nos relatórios CV seguintes, sem alterar a matriz técnica.


## Achados visuais — rodada 02 (Entregador, VIS-010–013)

**Entrada:** `RELATORIO-VISUAL-02-APOIS-ENTREGADOR-20261109(1).md` (auditoria estática, sem homologação). Escopo verificado na branch **autorizada** `audit/continuacao-20261107`, não na branch de auditoria de origem mencionada no relatório. Snapshot `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625` permanece protegido.

| CV | Origem | Prioridade | Superfície | Constatação e decisão | Situação, sem antecipar homologação |
|---|---|---|---|---|---|
| CV-009 | VIS-010 | P2 | Entregador / ActiveDelivery | Gerador final mostrava “PEDIDO RETIRADO” para `onTransition("picked_up")`, indicando fato consumado antes do clique | **Implementado no gerador** “Confirmar retirada”, handler/etapa/PIN preservados; teste de app real pendente |
| CV-010 | VIS-011 | P2 | Entregador / CourierOfferOverlay | Snapshot e patches sem papel de diálogo ou gestão de foco | **Implementado no gerador**: `role=dialog`, `aria-modal`, título, foco inicial, navegação Tab cíclica e retorno de foco. Sem evento novo de recusa; TalkBack e DOM final pendentes |
| CV-011 | VIS-012 | P1 **condicional** | Entregador / oferta em tela baixa | Corpo `max-h-[72dvh]` somado a cabeçalho/reserva da navegação, risco de extravasamento não reproduzido no app real | **Mitigação preventiva em gerador**: altura total limitada, `min-h-0`, corpo rolável e ações fixadas durante rolagem. Fixture Chromium confirmou risco e mitigação; APK não verificado |
| CV-012 | VIS-013 | P2 | Entregador / ações de ajuda e endereços | Alvos inline sem altura/padding mínimos no componente substituído por gerador tardio | **Implementado no gerador**: `min-h-11` (44px), padding, foco visível e quebra de linha. Callbacks inalterados; medição física pendente |

### Execução e evidências CV 02

- Script novo: `scripts/fix-partner-courier-visual02-v1.mjs`, aplicado **após** os geradores de jornada simples, histórico/perfil e ações operacionais; fontes pinadas intactas.
- Teste novo integrado ao builder: `scripts/qa/test-partner-courier-visual02-v1.test.mjs`.
- **Executado:** 8/8 verificações sintéticas em V8 sobre o patcher, incluindo idempotência, fail-closed por desvio de origem, preservação de handlers; inspeção de sintaxe e geometria de fixture Chromium em 5 viewports.
- **Não executado:** teste Node no checkout integral, compilação TypeScript, lint, bundle, E2E, TalkBack, foco Android e telas reais. Não chamar “homologado” apenas por simulação.
- Fixture Chromium (**não produto real**): cartão original ultrapassou o topo em 320×480, 360×640 e 640×360; cartão ajustado permaneceu na área útil nos cinco cenários. Classificação P1 continua condicional à reprodução no app.
- Foram preservados marca, paleta, safe-area, privacidade do endereço antes do aceite, prazo, sons, aceite/recusa, GPS, PIN, pagamentos, valores e histórico. Nenhum merge, deploy, APK, SQL ou mensagem real.

### Contagem e continuidade

**12 itens visuais CV-001–CV-012** (8 da rodada 01 e 4 da rodada 02). VIS-001 segue apenas como alias de INV-047. Os 67 achados técnicos mantêm suas classificações originais **A 0 / B 46 / C 17 / D 0 / E 1 / G 3** e sua matriz oficial separada. Sem autorização para homologação física final.


## Achados visuais — rodada 03 (Motorista, VIS-014–016)

**Referência:** `RELATORIO-VISUAL-03-APOIS-MOTORISTA-20261109(1).md`. Foi verificado o código de `src/routes/motorista.app.tsx` no commit-fonte fixado `9fc171050d8b5703540c49d19a8f1e9f5162775f` e a sequência real de geração no integrador `audit/continuacao-20261107`. A auditoria de origem é estática; não houve novo APK ou versão publicada associada.

| CV | Alias de origem | Prioridade | Superfície | Evidência e tratamento | Estado de aceite |
|---|---|---|---|---|---|
| CV-013 | VIS-014 | P2 | Motorista / RatingScreen / estrelas | Cinco botões SVG sem nome/estado acessível explícitos. Overlay CV03 mantém escala 1–5, `onClick={() => setStars(n)}`, adiciona grupo nomeado, `aria-label` individual e `aria-pressed={stars === n}`, com alvo mínimo 44px e foco visível | **Implementado no gerador, não homologado no app**; verificar TalkBack, teclado, foco e anúncio de nota |
| CV-014 | VIS-015 | P2 | Motorista / RatingScreen / comentário | Somente placeholder identificava a textarea. Overlay CV03 acrescenta label visível `Comentário (opcional)`, `htmlFor` e `id`, mantendo `value={comment}` e `onChange` | **Implementado no gerador, não homologado no app**; verificar campo vazio/preenchido, teclado e leitor de tela |
| CV-015 | VIS-016 | P2 | Motorista / RatingScreen / placeholder | V7 gera `#8A9098` sobre branco (contraste teórico **3,22:1**); o CSS de login não alcança automaticamente a avaliação. Overlay CV03 aplica `#596372` somente à textarea desta tela (contraste teórico **6,08:1**) | **Implementado no gerador, sem CSS computado real**; inspecionar WebView, campo aberto e compilação |

### Retificação explícita do Relatório Visual 01

**CV-006 / VIS-007**: **retirado da fila de defeitos ativos no código de montagem**; `fix-partner-input-contrast-v1.mjs` já substitui o placeholder intermediário do login por `#596372` com `!important`, antes da correção final da avaliação. Não duplicar nem reabrir sem nova evidência de CSS computado ou APK. Preservado como registro histórico com aceitação física ainda pendente; esta retificação não altera os 67 estados técnicos, nem deve ser interpretada como homologação da interface.

### Execução e limites da rodada 03

- Gerador de overlay visual isolado adicionado: `scripts/fix-partner-motorista-rating-accessibility-cv03-v1.mjs`, aplicado **após** `fix-partner-motorista-ride-visual-v7.mjs` e demais geradores Motorista, sem editar fontes pinadas.
- Teste de fixture incorporado ao builder: `scripts/qa/test-motorista-rating-accessibility-cv03-v1.test.mjs` (execução Node no checkout completo ainda pendente).
- Ensaios efetivos nesta rodada: 8/8 checks sobre trecho real de RatingScreen do commit pinado com alterações visuais V7 sintetizadas; 7/7 checks sobre fixture QA em V8; checagens de sintaxe e integridade de ordem de build. **Isto não é um teste React, APK ou E2E.**
- Pendências: Node test do checkout, lint, typecheck, montagem final; árvore acessível DOM, teclado/Tab, TalkBack, fontes ampliadas, 320/360/390/412 px, paisagem, input aberto, submissão/erro/retry/skip em homologação autorizada.
- Preservados fluxo de avaliação, proteção de autoavaliação de homologação, oferta, PIN, mapas, GPS, política financeira, identidade visual e logomarca. Nada foi publicado.

**Contagem visual atual: 15 registros CV-001–CV-015** (8 + 4 + 3), sem contar VIS-001 novamente (alias INV-047). **Classificação histórica técnica inalterada: 67; A 0 / B 46 / C 17 / D 0 / E 1 / G 3.** Não houve merge, deploy, APK, SQL ou pagamentos reais.


## Achados visuais — rodada 04 (Cliente/Passageiro, VIS-017–019)

**Relatório recebido:** `RELATORIO-VISUAL-04-APOIS-PASSAGEIRO-20261109(1).md`. Fontes verificadas na branch `audit/continuacao-20261107` e snapshot pinado `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`. A referência do relatório à branch `audit/ecossistema-20261107` não autorizou escrita nela.

| CV | Origem | Prioridade | Tela | Evidência e intervenção | Estado / aceite |
|---|---|---|---|---|---|
| CV-016 | VIS-017 | P2 | Passageiro / busca destino | Botão X condicional tinha apenas `onClick={clearQuery}`. Overlay CV04 adiciona `aria-label="Limpar busca"`, `title`, `type=button`, área mínima 44×44px e foco visível; mantém callback/sugestões/input | **Implementado no gerador, não homologado no Android/TalkBack**; testar toque, composição, limpeza e sugestão posterior |
| CV-017 | VIS-018 | P2 | Passageiro / revisão da solicitação | Render `key.replace` e `String(value)` podia exibir `true/false` e `[object Object]` em valores não triviais. Overlay CV04 usa apenas apresentação tipada: rótulos conhecidos do contrato de conforto, booleanos, arrays/objetos, fallback sem tradução comercial inventada e quebra de texto; `selectedCategory.details`, `confirmRide(comfort)`, total/payload permanecem intactos | **Parcial**: melhora genérica aplicada ao gerador e verificada em fixtures; dicionário de campos específicos de Fretes/Guincho/Envios **não fundamentado** porque `ServiceDetailsForm` do snapshot é placeholder e `RideCategory.details` é `any`, inicializado como `{}`. Não declarar categoria real validada |
| CV-018 | VIS-019 | P2 (risco de UX) | Passageiro / resumo após conclusão | `fix-corridas-client-comfort-finish-v2.mjs` agenda `handleReturnHome` em **3200 ms** apenas para `completed` e ID correspondente | **Pendente de engenharia e homologação de leitura**, sem alteração no temporizador ou navegação; medir TalkBack, fontes ampliadas, recuperação de informações pelo histórico |

### Evidências e proteção da rodada 04

- Patcher visual: `scripts/fix-corridas-visual04-passenger-v1.mjs`, integrado **após** `fix-report09-pricing-checkout-v1.mjs` em `scripts/build-isolated-module.mjs`, apenas no workspace `.work/corridas`.
- Testes versionados: `scripts/qa/test-corridas-visual04-passenger-v1.test.mjs`, com fixture, idempotência, source drift e controle de preservação do temporizador. Execução no checkout completo continua pendente.
- Validações executadas em V8 com arquivos em memória: **8/8** sobre rotas reais pinadas (com `confirmRide(comfort)` simulado na camada visual), **17/17** abrangendo fixtures, rótulos/valores conhecidos e desconhecidos, booleanos, listas, objetos, estados vazios, callbacks, idempotência, source drift e verificação do timer; **6/6** checks após ajuste de quebra de texto na fixture. Estes grupos não equivalem a `node --test`, build, DOM, navegador ou aparelho.
- Contratos verificados: `RideCategory.details` genericamente tipado no snapshot, `categoryService` retorna `details: {}`, `ServiceDetailsForm` não define campos reais de frete, guincho ou envios; `RideComfortPreferences` define `conversation`, `music`, `air_conditioning` com opções explícitas. O fallback **não inventa a tradução** de códigos desconhecidos nem mexe no envio.
- Pendentes: montagem completa, typecheck, lint, screenshot de tela real, TalkBack, teclado, 320/360/390/412 px e paisagem, campos longos, dados reais por categoria, retorno à Home e acesso posterior ao histórico. INV-064–066 de seleção/confirmacão/persistência **não** são corrigidos por esses ajustes visuais.
- Sem alterações de mapa/Places, Supabase, SQL, preço, pagamentos, login, ciclo da corrida, conclusão, contador de 3200 ms, notificações, fonte pinada ou dados de usuários.

### Consolidação

Total visual independente agora **18 registros CV-001–CV-018** (8 + 4 + 3 + 3). VIS-001 segue alias de INV-047, não contado; CV-006/VIS-007 continua fora da fila de defeitos ativos do código, com conferência física pendente. A matriz técnica mantém **67 achados; A 0 / B 46 / C 17 / D 0 / E 1 / G 3**, sem reclassificação. **Nenhum merge, deploy ou APK realizado**.


## Achados visuais — rodada 05 (Cliente Entregas, andamento do pedido, VIS-020–021)

**Relatório de entrada:** `RELATORIO-VISUAL-05-APOIS-PEDIDOS-20261109(1).md`. Fonte oficial verificada: `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`, rota `src/routes/pedido/$orderId/index.tsx`, além dos geradores efetivos na branch **autorizada** `audit/continuacao-20261107`. Não modificar `audit/ecossistema-20261107` nem fontes pinadas.

| CV | Origem | Prioridade | Tela | Comprovação e intervenção mínima | Situação |
|---|---|---|---|---|---|
| CV-019 | VIS-020 | P2 | Cliente Entregas / andamento de pedido | `created`, `pending_payment` e `paid` deixam a timeline sem etapa ativa; `searching_driver`, `driver_assigned`, `driver_arriving_store` compartilham “Pedido pronto”. Confirmadas nomenclaturas na tela `src/routes/pedidos.tsx` e contrato de estados. Overlay CV05 apresenta, quando pertinente, um único texto contextual derivado **somente** de `order.status`, com guarda em `order.payment_status` para não afirmar pagamento confirmado quando os estados divergem. Para retirada, nunca anuncia entregador | **Implementado no gerador, NÃO homologado em tela real**; validar status, pagamento, retorno, estados desatualizados e leitura |
| CV-020 | VIS-021 | P2 | Cliente Entregas / etapas da linha do tempo | O `steps.map` usa `div` com estados principalmente por cor; só atual mostra EM ANDAMENTO. Overlay CV05 usa `<ol>` / `<li>`, `aria-current="step"`, textos `sr-only` para concluída/atual/pendente e marca ícones decorativos, evitando anúncio repetido do indicador visual. **Não** atribui `aria-live` ao conjunto de etapas | **Implementado no gerador, NÃO homologado em TalkBack**; conferir ordem, nome, estado, atualização e fonte ampliada |

### Escopo, preservações e provas CV05

- Patcher de apresentação exclusivo do workspace gerado: `scripts/fix-entregas-order-timeline-visual05-v1.mjs`, chamado no fim do bloco de Entregas em `scripts/build-isolated-module.mjs`, **depois** da implementação existente de rastreamento, atualizações, avaliação e demais transformadores.
- Suíte de regressão versionada: `scripts/qa/test-entregas-order-timeline-visual05-v1.test.mjs`, incorporada ao builder; execução de `node --test` no checkout integral **ainda não realizada**.
- Teste **realmente executado** em V8 sobre a rota pinada com simulação dos trechos relevantes do gerador de rastreamento: **12/12 checks**. Teste sobre a fixture extraída da suíte versionada: **17/17 checks** após ajuste de indentação; valida seleção de texto por estado, `payment_status` independente, lista e estados acessíveis, ausência de anúncio coletivo, preservação de callbacks/PIN, idempotência e rejeição de source drift. Não equivale a React, CSS calculado, browser, APK ou teste E2E.
- Foi verificado que `fix-entregas-customer-delivery-tracking-v1.mjs` já amplia a disponibilidade do PIN **a partir de estados confirmados de coleta/rota**, além de chegada ao destino. Essa lógica posterior é preservada sem alterações pelo patch visual; não é correto usar a condição restrita do snapshot inicial como se fosse a regra final.
- O banner `role="status" aria-live="polite"` somente para `delivered` e a retirada do mapa de entrega concluída **são mantidos**. Cancelamento, reembolso, fulfillment `delivery`/`pickup`, status oficiais, RPC, mapas, polling, Realtime, pagamentos e valores ficam intactos.
- Pendências físicas: confirmar a cadeia final e SHA de APK, DOM e TalkBack, apresentação de 9+ estados em 320/360/390/412 px e paisagem, fonte ampliada, ausência de duplicação sonora em updates, histórico e notificações, e políticas de `payment_status` reais. Problema de estado atrasado/falso é assunto de engenharia, não corrigido por texto.

**Consolidação:** 20 achados CV independentes (`CV-001–CV-020`, 8 + 4 + 3 + 3 + 2). `VIS-001` permanece alias de `INV-047`, não contado novamente; a retificação `VIS-007 / CV-006` permanece válida. **Matriz técnica intocada: 67 achados, A 0 / B 46 / C 17 / D 0 / E 1 / G 3.** Sem merge, deploy, APK, migrations ou operações em produção.


## Achados visuais — rodada 06 (Motorista / anexos de cadastro e correções, VIS-022–023)

**Entrada:** `RELATORIO-VISUAL-06-APOIS-DOCUMENTOS-20261109(1).md`; integrador somente na branch `audit/continuacao-20261107`. As fontes do `.apois/source-lock.json` permanecem pinadas e somente para leitura.

| CV | Origem | Prioridade | Superfície | Evidência e intervenção | Situação |
|---|---|---|---|---|---|
| **CV-021** | **VIS-022** | P2 | Motorista / documentos e fotos de vistoria; central de correções | O gerador V2 conhece os formatos e 8 MiB finais, mas não os comunica perto do seletor. Overlay CV06 acrescenta ajuda por `effectiveAccept`, com PDF somente quando o campo aceita, explica o limite **final** após preparação e associa a descrição acessível. No reenvio por correções acrescenta legenda JPG/PNG/WebP, até 8 MB para envio. Mantém as instruções de enquadramento e a validação existente | **Implementado no gerador; não homologado no Android/DOM.** Verificar fontes reais, leitor de tela, diferentes formatos, tamanho original/processado e alinhamento dos campos |
| **CV-022** | **VIS-023** | P2 | Motorista / seletor nativo da câmera e galeria | `handleNative` pode trocar erro específico de saída acima de 8 MB por aviso de permissão. Overlay CV06 preserva erro de tamanho e `native_photo_size`, trata imagem vazia separadamente e deixa a causa desconhecida neutra. Mantém cancelamento silencioso e funções nativas, sem reimplementar seletor | **Implementado no gerador; reprodução Android e homologação pendentes.** Exercitar erro de tamanho pós-processamento, cancelamento, seleção válida, falhas desconhecidas e WebView |

### Preservação e provas RV-06

- Patch criado: `scripts/fix-partner-driver-document-guidance-visual06-v1.mjs`; teste: `scripts/qa/test-partner-driver-document-guidance-visual06-v1.test.mjs`; integrado no bloco Motorista de `scripts/build-partner-release.sh` **depois** do seletor nativo, central de correções, branding e overlay CV03. Apenas workspace descartável é alterado na futura montagem.
- Conferência das fontes pinadas e dos literais reais dos geradores; 4/4 testes locais de Node em **fixtures sintéticas** aprovados, mais sintaxe verificada. Teste versionado programado no builder, mas execução com checkout completo não comprovada. Isso **não equivale** a compilação, teste web, upload ou APK.
- Não alterar `driverRegistration.mobile.ts`, contratos de upload, proteção de dados, compressão, limites, câmera, autenticação, RPC, Supabase, mapas, pagamentos, eventos, estados ou callbacks. Correções do INV-047/VIS-001 e retificação CV-006/VIS-007 não reabertas.
- **Pendências:** executar os geradores completos e gates de Node em checkout apto; TypeScript/lint/build, inspeção de DOM e contraste; validar em Android físico câmera/galeria/cancelamento; PDF só onde permitido, arquivo grande, texto de erro, estados local/enviado; TalkBack e telas 320/360/390/412 px. A homologação física continua bloqueada até autorização específica.
- **Relatório independente:** `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL06-EXECUCAO-20261109.md`.

**Consolidação:** 22 achados visuais CV-001–CV-022 (20 anteriores + 2 novos), sem duplicar VIS-001/INV-047. Retificação VIS-007/CV-006 válida. **Matriz técnica histórica intacta: 67 achados, A 0 / B 46 / C 17 / D 0 / E 1 / G 3.** Nenhum merge, deploy, APK ou alteração de fontes pinadas.


## Achados visuais — rodada 07 (financeiro e mensalidades, VIS-024–025)

**Relatório de origem:** `RELATORIO-VISUAL-07-APOIS-FINANCEIRO-20261109(1).md`, auditoria somente; branch autorizada `audit/continuacao-20261107`. A auditoria externa usou checkout `audit/ecossistema-20261107`, que **não** é destino de alterações.

| CV | Origem | Prioridade | Superfície | Evidência e intervenção limitada | Estado / aceite |
|---|---|---|---|---|---|
| **CV-023** | **VIS-024** | P2 | Motorista / mensalidade | O gerador `harden-motorista-finance-boundary.mjs` apresentava `pending`, `processing`, estado desconhecido ou ausência de registro como **Mensalidade inativa**. Overlay CV07 introduz somente estado de apresentação, com rótulos `Pagamento pendente`, `Pagamento em processamento`, `Mensalidade inativa` apenas para `inactive` conhecido, e `Situação da mensalidade indisponível` quando não houver dado confiável; atualização em curso indica consulta. Erro/desconhecimento não acende o ponto verde. Preserva `operational = paidActive || homologation`, as guardas, consulta RLS, retry, suporte e preço por contrato no Parceiro | **Implementado no gerador, não homologado.** 10 cenários diretos + 3 de falta de dado/erro/atualização verificados em V8; pendente: cadeia completa, React/Android, dados reais, fallback/retentativa |
| **CV-024** | **VIS-025** | P2 | Estabelecimento / cartão de situação da mensalidade | `harden-entregas-merchant-direct-finance.mjs` gerava fallback `Status: ${value}` expondo código técnico `provider_status`. Overlay CV07 preserva exatamente seis casos conhecidos (`paid`, `authorized`, `pending`, `paused`, `cancelled`, `canceled`) e substitui somente o `default` por **Situação da mensalidade indisponível**, tanto para código novo quanto para ausência de dado. Nenhuma confirmação de pagamento inventada, gateway ou callback alterado | **Implementado no gerador, não homologado.** 8 cenários de tradução em V8; pendente: contrato real, renderização, atualização e acessibilidade |

### Execução, integridade e pendências do RV-07

- Patch visual versionado: `scripts/fix-apois-financial-status-visual07-v1.mjs`; teste versionado: `scripts/qa/test-apois-financial-status-visual07-v1.test.mjs`.
- Ordem integrada em **três** builders: `scripts/build-partner-release.sh` (Motorista após preço contratual); `scripts/build-motorista-module.mjs` (Motorista standalone depois do boundary e antes do typecheck); `scripts/build-merchant-panel.mjs` (Estabelecimento depois da neutralização do gateway e antes do typecheck). Scripts não editam `sources/`; destino de alterações durante montagem é `.work/`.
- Validação executada: extração/evaluação isolada dos literais gerados **do próprio integrador remoto**, aplicação real em memória do patch da branch, rótulos em 21 cenários V8, conferência de idempotência, existência de callbacks, mensagens de indisponibilidade e ordem de integração. **Não** se tratou de `node --test` com checkout integral, renderização, compilação, WebView ou movimentação financeira. Teste Node foi versionado e incorporado como gate futuro.
- A atualização `fix-partner-driver-new-monthly-price-v1.mjs` preserva consulta do contrato do Motorista no builder Parceiro, incluindo R$ 59,90 para novos e R$ 49,90 para antigos. Entregador R$ 49,90 é somente divulgação, sem cobrança automática. Estabelecimento R$ 69,90 e gateway inativo preservados. Nenhuma regra comercial mudou.
- **Observação fora do escopo:** `scripts/build-motorista-module.mjs` não contém a etapa de preço contratual presente no builder Parceiro. Confirmar com engenharia qual fluxo standalone é efetivamente distribuído e seu valor exibido. Sem prova de divergência em APK publicado; nenhuma alteração de preço autorizada por este RV.
- Pendências: ler status reais de produção de forma autorizada, executar suites em checkout completo, typecheck/lint/build, layout 320/360/390/412 px, paisagem, fontes ampliadas, teclado/leitor de tela, falha de consulta, retentativa, contrato antigo/novo e distinção de ganhos registrados/recebimento. Não gerar cobrança de teste real.
- **Relatório independente:** `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL07-EXECUCAO-20261109.md`.

**Contagem visual agora: 24 achados independentes CV-001–CV-024 (22 anteriores + 2 do RV-07).** VIS-001 permanece alias INV-047; CV-006/VIS-007 permanece retificado. **Classificação histórica técnica inalterada: 67, A=0, B=46, C=17, D=0, E=1, G=3.** Sem merge, deploy, APK, SQL/RLS, escrituras financeiras, alterações de repositórios-fonte ou alteração de `.apois/source-lock.json`.


## Achados visuais — rodada 08 (Motorista/Equipe, suporte e esclarecimentos, VIS-026–027)

**Relatório externo:** `RELATORIO-VISUAL-08-APOIS-SUPORTE-20261109(1).md` (auditoria somente). A referência a checkout `audit/ecossistema-20261107` não autoriza nenhuma escrita fora da branch `audit/continuacao-20261107`. A fonte `movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f` permanece protegida.

| CV | Origem | Prioridade | Superfície | Evidência e intervenção | Estado / homologação |
|---|---|---|---|---|---|
| **CV-025** | **VIS-026** | P2 | Motorista / Minha área de esclarecimentos; equipe / Central de Ocorrências | `fix-partner-support-case-workroom-v1.mjs` gera lista de protocolos com `{t.status}` bruto. Overlay `fix-partner-support-workroom-visual08-v1.mjs` adiciona rótulos de apresentação `open → Aberto`, `in_progress → Em atendimento`, `resolved → Resolvido`, `closed → Fechado`; código ausente/desconhecido → **Situação indisponível**. Alinhado com o dicionário já presente em `chamado-suporte.$ticketId.tsx` do Cliente Entregas, que não recebe patch. Valores brutos permanecem nas regras de resposta e consulta | **Implementado no gerador; não homologado em tela física.** Verificar estados do backend real, status desconhecido, listagem 320–412 px, leitor de tela, revisão de protocolos |
| **CV-026** | **VIS-027** | P2 | Motorista/Equipe / consulta, vazio e falha na lista de ocorrências | Antes, erro de consulta e `tickets.length===0` podiam renderizar simultaneamente erro e **Nenhuma ocorrência disponível**. Overlay CV08 distingue consulta **bem-sucedida** (`ticketListLoaded`) de falha (`ticketListFailed`): texto de vazio somente em sucesso, erro inicial sem falsa ausência e lista anterior mantida com aviso de potencial desatualização após falha. Mesmo botão `refresh` muda rótulo para **Tentar novamente** enquanto houver erro; sucesso limpa somente mensagem de erro da lista, sem ocultar erros de detalhe/anexos. Sem alertas de leitor de tela duplicados | **Implementado no gerador; não homologado no Android.** Verificar falha inicial, sucesso vazio, lista carregada, erro de atualização, recuperação, polling, TalkBack e foco |

### Execução preparatória do RV-08 — sem duplicação funcional

- Patch versionado: `scripts/fix-partner-support-workroom-visual08-v1.mjs`; testes versionados: `scripts/qa/test-partner-support-workroom-visual08-v1.test.mjs`. Integrados ao **final do bloco de transformações Motorista** em `scripts/build-partner-release.sh`, depois do gerador original, da triagem `APOIS_STAFF_REQUEST_DRIVER_STATEMENT_V1`, das correções `APOIS_CASE_CONTEXT_SAFE_V2`/`APOIS_CASE_UPLOAD_IDEMPOTENCY_V2` e dos hardeners visuais anteriores.
- O patch edita somente `.work/partner-motorista/src/components/ApoisCaseWorkroom.tsx` quando executado. É idempotente e recusa alteração de âncoras/versões inesperadas. Não toca fontes pinadas.
- **Verificações realmente executadas:** reconstrução sintética do componente final, com literal completo do gerador real e sua transformação de triagem; 17/17 checks V8 para quatro estados conhecidos, desconhecido, erro inicial, sucesso vazio, lista carregada, falha com lista retida, retry, callbacks/privacidade, alerta não duplicado, idempotência, source drift e ordem no builder. Verificada sintaxe JavaScript dos novos scripts em V8. Os testes Node foram versionados, **não executados no checkout completo**; nenhum bundle/React/Android validado.
- Suporte do Cliente Entregas **não modificado**. Sem alterações em protocolo, `passenger_support_tickets`, Supabase, SQL, RLS, anexos, notas internas, `apois_case_reply`, `apois_case_internal_note`, `apois_request_driver_statement`, `apois_case_register_evidence`, polling de 30 segundos ou permissões.
- **INV-002/INV-003/INV-016** seguem achados técnicos anteriores e **não** são reabertos ou reivindicados como correções visuais. Tratamento de rejeições excepcionais do Promise de consulta, fora do cenário `result.error` documentado, também não foi alterado.
- **Pendências:** executar gerador, testes Node, typecheck/lint e build em checkout completo; inspecionar JSX/DOM e estilos calculados, renderização React, Chrome/WebView, erro de backend/retentativa, leitor de tela e fontes ampliadas, 320/360/390/412 px, paisagem, diferenças staff/driver, sessão e anexo.
- **Relatório de execução:** `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL08-EXECUCAO-20261109.md`.

**Consolidação: 26 achados visuais CV-001–CV-026** (24 anteriores + 2 desta rodada). `VIS-001` continua alias de `INV-047`; retificação `VIS-007/CV-006` continua válida. **Matriz técnica histórica intocada: 67 achados, A=0, B=46, C=17, D=0, E=1, G=3.** Sem merge, deploy, APK, banco ou atualização das fontes protegidas.


## Achados visuais — rodada 09 (perfil, configurações e exclusão, VIS-028–029)

**Entrada:** RELATORIO-VISUAL-09-APOIS-PERFIL-EXCLUSAO-20261109(1).md (auditoria somente). A branch externa audit/ecossistema-20261107 foi examinada como referência do relatório, não como alvo de modificação. Alterações permitidas somente em audit/continuacao-20261107.

| CV | Origem | Prioridade | Superfície | Evidência / ajuste de apresentação | Estado e aceite |
|---|---|---|---|---|---|
| **CV-027** | **VIS-028** | P2 | Motorista Parceiro / Configurações, diálogo V4; Passageiro Corridas / PassengerAccountDeletion | Os diálogos próprios possuíam role=dialog, aria-modal e nome acessível, mas não foco inicial, contenção do Tab nem restauração explícita. Overlay gera useApoisDeletionDialogFocus e o aplica em ambos os diálogos: foco começa em **Cancelar**, Tab/Shift+Tab permanece dentro, Escape encaminha clique apenas a Cancelar se habilitado, fundo fica temporariamente com inert/aria-hidden, foco retorna ao acionador quando o diálogo fecha. Não modifica EXCLUIR obrigatório, submit/RPC, serverConfirmed/completed, callback, rotas ou textos legais | **Preparado no gerador; não homologado no Chrome/TalkBack/WebView**. Sintaxe do patch e avaliação V8 do foco em DOM simulado (8 verificações) aprovadas. Testar foco real, dispositivo, fonte ampliada, 320–412 px, teclado virtual, animação e modal de processamento |
| **CV-028** | **VIS-029** | P2 | Cliente Entregas / Perfil / Dados pessoais, gerador de solicitação de exclusão usado no builder Merchant | O try/catch original misturava erro da RPC request_own_account_deletion com erro posterior de auth.signOut, podendo negar verbalmente solicitação já aceita. Overlay mantém ordem da limpeza de push, RPC, signOut e navegação; adiciona flag **local somente de comunicação** definida após RPC sem erro. Em falha antes de confirmação mantém mensagem genérica; em falha posterior mostra “A solicitação de exclusão foi registrada, mas não foi possível concluir a saída da conta. Saia manualmente ou procure o suporte.” Não repete RPC, não altera contrato nem manipula dados | **Preparado no builder Merchant, não homologado no app publicado**. Sete cenários de RPC/signOut/confirmar/cancelar reproduzidos com mocks V8. Verificar pós-confirmação com integração real controlada; jamais testar exclusão em conta de produção |

### Implementação, provas e integridade do RV-09

- **Novos:** scripts/templates/useApoisDeletionDialogFocus.ts, scripts/fix-apois-account-deletion-visual09-v1.mjs e scripts/qa/test-apois-account-deletion-visual09-v1.test.mjs. Overlay é idempotente e falha se marcadores/âncoras dos arquivos esperados mudarem. Nenhum arquivo dos submódulos-fonte é editado; arquivos gerados ficam sob .work/.
- **Integração:** scripts/build-partner-release.sh aplica modo motorista após V4 e hardeners; scripts/build-isolated-module.mjs aplica modo passageiro após componente existente ser copiado para .work/corridas; scripts/build-merchant-panel.mjs aplica modo entregas após hardener existente e antes da compilação. Os três incluem o novo gate Node de regressão.
- **Testes executados nesta rodada:** inspeção dos scripts e dos literais vigentes; patch real em memória V8 contra Passenger e handler Entregas extraídos do gerador; patch contra modal/handler produzidos pelo gerador V4; mocks de sete caminhos de confirmação/falha da solicitação; simulação do hook de foco com oito asserções de navegação/isolamento/restauração. Parser V8 verificou a sintaxe dos novos scripts JS. **Não foi executado o node --test no checkout integral, typecheck/lint/build, React/DOM real, navegação física, TalkBack ou exclusão real.**
- **Dependência importante:** o builder separado de Superapp Cliente (build-isolated-module.mjs entregas) não mostra a chamada ao hardener de solicitação de exclusão que já existe no builder do painel Merchant. Sem prova de qual árvore publica a experiência Cliente Entregas, a auditoria **não acrescentou essa transformação funcional**, porque mudaria desativação/autenticação fora do escopo visual. Engenharia deve confirmar qual bundle é publicado e garantir contrato de exclusão vigente antes da homologação. A correção CV-028 está integrada ao caminho Merchant, não comprovadamente a todas as publicações Cliente.
- **Preservado:** login e logout, confirmação digitada EXCLUIR, RPC, histórico de corridas, regras de corrida ativa, retenção, classes visuais, políticas do backend, configurações anteriores e suas limpezas. Nenhum teste de exclusão destrutiva foi feito.
- **Pendências:** confirmar fluxo/versão distribuídos; executar gates Node, TypeScript/lint/build, avaliar retorno de foco e múltiplos modais com teclado/TalkBack, 320/360/390/412 px, paisagem, fonte ampliada, resultado remoto verdadeiro e comportamento de falha após RPC em ambiente de teste. Não ativar novas chamadas de exclusão ou alterar RPC automaticamente.
- **Relatório de execução:** auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL09-EXECUCAO-20261109.md.

**Contagem consolidada: 28 achados visuais independentes CV-001–CV-028** (26 anteriores + 2 desta rodada). VIS-001 segue alias de INV-047 e VIS-007/CV-006 permanece retificado. **Técnicos históricos: 67, A=0 / B=46 / C=17 / D=0 / E=1 / G=3, preservados.** Nenhum merge, deploy, publicação, APK, SQL/RLS, escrita de dados ou modificação de source-lock.


## Achados visuais — rodada 10 (Cliente Entregas, produtos e sacola, VIS-030–031)

**Entrada:** RELATORIO-VISUAL-10-APOIS-PRODUTOS-SACOLA-20261109(1).md; a base externa audit/ecossistema-20261107 é de auditoria e **não** foi alvo de alterações. Branch modificada: audit/continuacao-20261107.

| CV | Origem | Prioridade | Superfície | Evidência, preservação e decisão | Estado / aceite |
|---|---|---|---|---|---|
| **CV-029** | **VIS-030** | P2 | Cliente Entregas / ProductCustomizationSheet, opções dos grupos | A fonte pinada usa div com onClick para opções, sem semântica, foco nem estado acessível. Overlay visual acrescenta botão HTML nativo type="button", disabled={isDisabled}, aria-pressed={isSelected}, role="group", aria-labelledby e aria-describedby associados ao nome e à instrução do grupo, foco visível e alvo de toque >=44px. Mantém exatamente **uma** chamada a handleToggleOption, classes/ícone de seleção, substituição para máximo=1, limite de opções, isGroupValid, cálculo e CTA. Não cria evento de teclado duplicado: Enter/Espaço usam o clique nativo do button | **Implementado no overlay de apresentação. Não homologado no APK/DOM real.** Avaliação em V8 sobre JSX pinado com hardeners de viewport/safe-area, 11/11 checagens e simulação do handler de 7 ações; Node tests versionados, não executados no checkout completo. Pendente teclado/TalkBack, lint/typecheck, build, fontes ampliadas, telas pequenas |
| **CV-030** | **VIS-031** | P2 no relatório; não aplicável ao esquema pinado | Cliente Entregas / instrução de mínimo/máximo | O relatório comprovou contradição sintética em min>0 com max=null. **Validação do contrato pinado:** supabase/migrations/20260807231500_create_product_options.sql cria max_selections integer NOT NULL DEFAULT 1, com CHECK max >= 1 e CHECK max >= min; src/integrations/supabase/types.ts declara max_selections: number; MerchantProductEditor.tsx exige máximo inteiro >=1 e >=mínimo na criação e edição. Portanto max=null não pode ser gravado via esse contrato. Sem acesso à produção, não se afirma que todas as implantações/dados sigam a migração. **Nenhum texto, mínimo, máximo ou validação foi alterado** | **Não aplicável no contrato versionado / risco condicional.** Pendente, se solicitado, verificar schema e catálogo reais sem modificar dados. Não implementar uma regra hipotética para contornar o NOT NULL |

### Execução preparatória RV-10 e limites de evidência

- Novos scripts: scripts/fix-entregas-product-customization-visual10-v1.mjs e scripts/qa/test-entregas-product-customization-visual10-v1.test.mjs. Overlay **fail-closed** em mudança de âncoras, idempotente e limitado à cópia .work/entregas/src/components/ProductCustomizationSheet.tsx. Nenhuma fonte pinada alterada.
- Duas ordens de montagem atualizadas: scripts/build-isolated-module.mjs (Cliente Entregas embutido no Superapp) e scripts/build-merchant-panel.mjs (monta também Cliente Entregas e painel Merchant). Ambos aplicam CV-029 **depois** de imagem, overlay, catálogo/carrinho/checkout, pagamento direto e demais hardeners; ambos executam teste Node e validam marcador antes de build. Nenhum fluxo foi publicado.
- Verificações **realmente executadas**: leitura remota do componente pinado e scripts; verificação da migração, tipos e editor; reconstrução em memória das duas alterações preexistentes de apresentação (rodapé com safe-area e altura dinâmica); transformação real do patch; 11/11 checagens em V8, simulação de sequência em handleToggleOption (máximo=1, máximo=2 e desseleção), sintaxe JavaScript do script/teste e ordem de montagem. Sem execução do node --test em checkout completo, ReactDOM/árvore acessível real, Playwright, aparelho, banco, compra ou Pix.
- Preservados: sacola, subtotal, entrega calculada no checkout, nomes acessíveis dos controles já existentes, pedido mínimo, total, adicionais e preços, limite de seleção, fallback de imagem, safe-area do sheet, registro de pedido, pagamento direto em cash sem gateway eletrônico APOIS. Não houve modificação em source-lock, SQL/RLS, autenticação, Supabase, catálogo, carrinho, checkout, gateway ou critérios comerciais.
- **Relatório independente**: auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL10-EXECUCAO-20261109.md.
- Pendências: schema implantado e dados efetivos (para reavaliar CV-030 se o contrato divergir), TypeScript/lint/build completo, interação por teclado/Enter/Espaço, TalkBack/VoiceOver, 320/360/390/412 px, orientação paisagem, nomes longos, preço/acréscimo e limite máximo.

**Contagem: 30 registros visuais CV-001–CV-030**, incluindo CV-030 **documentado como não aplicável ao esquema pinado** (não contar como defeito confirmado nem correção executada). VIS-001 segue alias INV-047 e VIS-007/CV-006 segue retificado. **Matriz técnica histórica mantida em 67, A=0 / B=46 / C=17 / D=0 / E=1 / G=3.** Sem merge/deploy/APK/produção. Próxima numeração: CV-031.
