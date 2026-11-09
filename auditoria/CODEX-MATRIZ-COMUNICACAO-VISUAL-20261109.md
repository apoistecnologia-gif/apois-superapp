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
