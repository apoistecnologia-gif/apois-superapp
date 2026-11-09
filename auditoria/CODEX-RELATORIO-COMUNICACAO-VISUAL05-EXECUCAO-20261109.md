# APOIS — Relatório de Execução Visual 05 — Andamento de Pedidos (Cliente Entregas)

**Data:** 09/11/2026  
**Entrada auditada:** `RELATORIO-VISUAL-05-APOIS-PEDIDOS-20261109(1).md`  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch modificada:** `audit/continuacao-20261107`  
**IDs:** VIS-020/VIS-021 => **CV-019/CV-020**; independente da matriz técnica 01–14 e das quatro rodadas visuais anteriores.  
**Limite:** correções só de apresentação, sem homologação física final, deploy ou APK.

## 1. Investigação da fonte efetiva

Fonte protegida verificada diretamente no GitHub:
- `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- `src/routes/pedido/$orderId/index.tsx`, SHA blob `17887640fa273067c76bdbea538d5847a9b030dc`, 603 linhas.
- `src/routes/pedidos.tsx`: labels oficiais para `created` (Criado), `pending_payment` (Aguardando pagamento), `paid` (Pagamento confirmado), `searching_driver` (Buscando entregador), `driver_assigned` (Entregador encontrado), `driver_arriving_store` (Entregador indo à loja), entre outros.
- `scripts/build-isolated-module.mjs` (integradora): gera a cópia `.work/entregas`, aplica primeiro `fix-entregas-customer-delivery-tracking-v1.mjs`, avaliações, recuperação de homepage e demais transformações. A nova correção CV05 entra no final dessa sequência **antes** da verificação geral de integridade.

Mecanismo confirmado: o switch de `deliverySteps` e `pickupSteps` não marca uma etapa atual para `created/pending_payment/paid`. Na entrega, `searching_driver/driver_assigned/driver_arriving_store` usam `stepIndex=2` (“Pedido pronto”). Antes da correção, o `steps.map` usa `div` e cores, com texto somente para `current`.

A tela completa também possui uma seção “Pagamento” com `order.payment_method` e `order.payment_status`. Não seria correto concluir que falta toda informação na página; a lacuna específica é a **explicação contextual junto à progressão** e a semântica dos estados. O snapshot antigo não prova a aparência do APK vigente.

## 2. Mudanças aplicadas no gerador, sem alterar o produto em produção

| CV | Alteração visual | Garantias |
|---|---|---|
| CV-019 / VIS-020 | Texto complementar curto, somente nos status `created`, `pending_payment`, `paid`, `searching_driver`, `driver_assigned` e `driver_arriving_store`. O texto de pagamento verifica `order.payment_status` separadamente para não anunciar pagamento confirmado caso os campos oficiais não coincidam. Estados de entregador são omitidos para `pickup`. Para os outros status, nenhum novo texto é adicionado | Não modifica `deliverySteps`, `pickupSteps`, seus índices, status oficiais, pedido, pagamento, API, persistência, seleção ou transições |
| CV-020 / VIS-021 | A timeline muda só sua semântica estrutural para `ol` e `li`, com `aria-label="Etapas do pedido"`, `aria-current="step"` na etapa ativa, texto acessível para concluída/atual/pendente e ícones decorativos ocultados do leitor de tela. O “EM ANDAMENTO” visível é mantido, mas ocultado da leitura duplicada | Não foi adicionada região `aria-live` à lista inteira, não há novos handlers, não há redesenho, nem mudanças no fluxo do pedido |

**Proteções encontradas e preservadas no gerador já existente:**
- O banner “Entrega concluída!” utiliza `role="status"` e `aria-live="polite"` somente após `delivered`; o mapa de rastreamento não é mostrado para concluído.
- `fix-entregas-customer-delivery-tracking-v1.mjs` estende a exibição do PIN de entrega a estados confirmados de coleta/rota (`picked_up`, `on_the_way`, `arrived_destination`); isto difere da condição mais restrita no snapshot original e **não foi alterado** nesta rodada.
- Retirada, cancelamento e reembolso mantêm percursos distintos; os comandos de cancelar e avaliar, mapa, polling e Realtime continuam com o código preexistente. Nenhum texto novo afirma que dinheiro foi recebido sem verificar `payment_status`.

## 3. Arquivos/commits

1. `b34b4ddae106e30eaea8be4b2949ea30ef989124` — novo patcher `scripts/fix-entregas-order-timeline-visual05-v1.mjs`.
2. `8a37ba62aa0d5962b47ffb0a295615c0a854b52c` — alinha guarda de PIN ao resultado final do gerador de tracking.
3. `cae050fbf953e09c88d8fa9a519ac63fb6e1ee52` — proteção para `pending_payment` com `payment_status=paid`.
4. `9ace575927ebea416845ea45e11c3ac971e4c498` — suíte `scripts/qa/test-entregas-order-timeline-visual05-v1.test.mjs`.
5. `d7623de2a325e99475e23b982c520cc9c0e5ad43` — chamada tardia no `scripts/build-isolated-module.mjs` com `node --test` e verificações finais de marcadores.
6. `8aaf343a9b73a597b3d3cfcc23046bce669396d3` — ajuste da fixture de ícone para corresponder ao recuo do JSX real.
7. `43e462fb48d011a063e92092c74cfcc30d171b5d` — consolidação da matriz visual CV-001–CV-020.

**Nenhum arquivo dos repositórios-fonte pinados foi editado**; os scripts alteram exclusivamente o workspace descartável da integração na montagem. Nenhuma outra branch e nenhum `source-lock` foram alterados.

## 4. Testes realmente executados

**A. Teste sintético V8 sobre o snapshot completo da rota (603 linhas): 12/12 PASS.** A fixture utilizou a rota pinada e uma reprodução isolada dos trechos relevantes que o gerador de tracking acrescenta (banner de entrega confirmada e condição final do PIN). Verificado: textos de status, tratamento de flags de pagamento divergentes, diferença pickup/delivery, markup de `ol/li`, rótulos de etapas, não duplicação do anúncio visual, manutenção do banner de conclusão, preservação de PIN, handlers e mapa, idempotência e falha segura em desvio de origem. **Não foi uma execução integral de todos os transformadores.**

**B. Teste sintético V8 da fixture incluída na suíte QA: 17/17 PASS.** Exercitados `created`, `pending_payment`, `paid`, `searching_driver`, `driver_assigned`, `driver_arriving_store`, casos contraditórios de `order.status`/`payment_status`, retirada sem promessa de entregador, estados sem parágrafo duplicado, semântica da lista, PIN, idempotência, falha segura em mudança inesperada da fonte, ordem de montagem e presença do gate de teste.

**C. Inspeção de sintaxe V8:** patcher e corpo da suíte QA analisados; imports ESM tratados somente para essa inspeção. O código final está sintaticamente válido no parser da verificação.

**Não executados:** `node --test scripts/qa/test-entregas-order-timeline-visual05-v1.test.mjs` no checkout integral, todas as transformações de Entregas em sequência, lint, TypeScript, build, React montado, CSS calculado, Chrome/WebView real, TalkBack, aparelhos Android e testes E2E com pedidos. **Não há comprovação de que a correção já aparece em APK ou domínio publicado.**

## 5. Homologação futura — sem antecipação

Após autorização expressa para APK/homologação, identificar SHA do pacote e confirmar:
- status `created`, `pending_payment`, `paid`, `confirmed`, `searching_driver`, `driver_assigned`, `driver_arriving_store`, `out_for_delivery`, `delivered` e variantes `pickup`;
- pagamento pendente, confirmado e inconsistências de atualização; confirmar texto com campos oficiais, nunca com cor/índice isolado;
- pedido cancelado/reembolsado sem timeline ativa; entrega e retirada distintas; conclusão apenas no estado oficial;
- TalkBack lê a lista e cada item como “Etapa concluída”, “Etapa atual” ou “Etapa pendente”, sem repetição de anúncios a cada evento de Realtime;
- 320/360/390/412 CSS px, paisagem, fonte ampliada, safe-area, carregamento, strings longas, PIN, histórico e mapa.

Se os estados do backend estiverem atrasados ou incoerentes, encaminhar à engenharia. A intervenção visual não substitui sincronização/regras operacionais.

## 6. Estado consolidado e preservação

- Matriz visual própria: **20 registros CV-001–CV-020**, incremento de dois itens desta rodada. `VIS-001` é alias de `INV-047`; `VIS-007/CV-006` permanece retirado da fila ativa de defeitos de código por correção existente, com teste físico ainda pendente.
- Matriz técnica oficial **intacta**: **67 registros, A 0 / B 46 / C 17 / D 0 / E 1 / G 3**, sem reclassificação.
- Arquivo `.apois/source-lock.json` preservado no SHA blob `3f98789f28666ccc052175db10f138208dd0937b`.
- Sem merge, deploy, APK, SQL, autenticação, pagamentos reais, criação/cancelamento de pedidos, alteração de dados, notificação ou operação produtiva.

**Conclusão:** CV-019 e CV-020 tiveram correção de código preparatória aplicada no integrador e evidências sintéticas registradas. **Aceite no produto real permanece pendente**, assim como a homologação final do ecossistema.
