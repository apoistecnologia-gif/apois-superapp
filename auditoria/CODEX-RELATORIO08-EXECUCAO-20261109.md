# APOIS — Relatório 08 | Acompanhamento e retorno da corrida à busca

**Data de execução:** 09/11/2026. **Relatório recebido:** `RELATORIO-08-APOIS-RETORNO-A-BUSCA-20261108.md` (08/11/2026). **Novo achado:** INV-057, prioridade P1.  
**Integrador:** `apoistecnologia-gif/apois-superapp` · branch **`audit/continuacao-20261107`**. O relatório de auditoria cita outro ramo de investigação (`audit/ecossistema-20261107`), que **não** foi usado para gravações.  
**Pin Passageiro:** `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`. A política `.apois/source-lock.json` foi conferida; os pins de Entregas e Motorista/Admin permanecem preservados.
**Limites:** sem APK, deploy, merge, migrações, corrida/push ou escrita em produção.

## Diagnóstico confrontado com o código

1. A fonte original do passageiro `src/hooks/rides/use-active-ride.tsx` **não** contém o guard defeituoso: ele é inserido por `scripts/harden-corridas-superapp-runtime.mjs`, cujo blob consultado permanece `53a61e4062baa65961c9eacd1c40f49a91679155`.
2. O hardener adiciona `RIDE_STATUS_ORDER` e descarta qualquer nova etapa com rank inferior. Como `procurar_motorista` é inferior a `motorista_chegou`, um cancelamento operacional que devolva a *mesma* corrida à busca pode ficar invisível. O passageiro continua vendo a atribuição antiga e a nova aproximação também pode ser rejeitada até alcançar a mesma etapa.
3. A fonte do serviço `active-ride-service.ts` fornece o `updated_at` do servidor aos consumidores e admite atualização Realtime com timestamp posterior, mesmo se a etapa for inferior. O bloqueio adicional ocorre no hook transformado. A checagem de `passenger_id` em `getRideById` preserva o limite de titularidade.
4. `scripts/build-isolated-module.mjs` efetivamente invoca o hardener de runtime para Corridas; `harden-corridas-marketplace-status-order.mjs` não foi encontrado nessa sequência e, de todo modo, não resolve ciclos de motorista.
5. A operação backend de retorno à busca ainda depende das funções ausentes/pendentes do Relatório 07. A correção de INV-057 resolve o cliente **no nível de código**; não comprova cancelamento real funcionando.

## Correção implementada — INV-057

**Estado: B — alteração de código versionada, sem homologação integral.**

O novo gerador **`scripts/fix-report08-passenger-redispatch-v1.mjs`** altera exclusivamente a cópia isolada `.work/corridas/src/hooks/rides/use-active-ride.tsx`, após o hardener anterior. A fonte fixada não foi editada.

- Mantém a identidade `rideId` obrigatória e guarda o último `ActiveRide` aceito, inclusive `driver_id`, `accepted_at`, estado e `updated_at`.
- Comparação de versão do servidor com resolução de **microssegundos** para não confundir timestamps PostgreSQL próximos. Atualizações mais antigas são descartadas, mesmo se entregues por Realtime após uma resposta de polling.
- Reconhece o ciclo válido **A a caminho/chegou → procurar_motorista (sem atribuição) → B a caminho → B chegou**, com timestamp estritamente mais novo. Também reconhece B diretamente após A se o evento intermediário da busca se perder e o `accepted_at` da nova atribuição for posterior.
- Continua impedindo evento de outra corrida, retorno de corrida finalizada/cancelada, regressão de `em_viagem`, busca com motorista ainda atribuído e retrocesso do mesmo motorista.
- Atualizações ambíguas de Realtime disparam **leitura do snapshot autoritativo por `getRideById(activeId,userId)`**. Ela é limitada a uma reconciliação simultânea, protegida pela identidade corrente e por `requestSequenceRef`. O snapshot é avaliado em modo autoritativo, não rejeitado cegamente pelo filtro de evento que causou o problema.
- `loadRide`, polling e `recoverActiveRide` distinguem snapshots obtidos diretamente do servidor de eventos Realtime. `clearRide` e troca de `rideId` limpam referências de versão e reconciliação.
- Todos os demais elementos visuais, PIN, endereços, rotas, preço, autenticação, pagamentos, paradas e regras de negócio foram deixados inalterados.

**Integração de build:** `scripts/build-isolated-module.mjs` executa o novo gerador e o teste Node logo após `harden-corridas-superapp-runtime.mjs`, antes de continuar a montagem do módulo Corridas. **Não foi rodado o builder**, pois pode gerar artefatos de aplicativo e a homologação final está bloqueada.

## Verificações realmente executadas

**Executado em JavaScript V8 isolado, sem conexão a operações do produto:**

1. Lido o hook real do snapshot fixado e extraído/executado o **fragmento original verdadeiro** do hardener de runtime em uma cópia em memória; comprovada a presença do guard de rank antigo.
2. Aplicado o **novo gerador real** na fonte transformada; reaplicação sobre a mesma cópia comprovou **idempotência**, sem alterar fontes protegidas.
3. Extraídas as funções de decisão geradas e exercitadas em **20 cenários sintéticos**: primeiro carregamento, motorista A chegando, liberação para busca, B aceitando e chegando, A atrasado, outro rideId, B direto sem evento de busca, retrocesso do mesmo motorista, período em viagem, terminal, busca inválida, mesma versão ambígua, refresh autoritativo e versão inválida anterior a terminal. Todos **PASS**.
4. A comparação de timestamps `.123450` e `.123451` aprovou o teste de microssegundos.
5. Foi gravado `scripts/qa/test-report08-passenger-redispatch-v1.test.mjs`, que constrói uma fixture a partir do hook pinado e do próprio fragmento real do hardener, aplica a correção em workspace descartável e verifica 19 cenários de sequência/versão, sem serviços externos.

**Não executado:** `node --test` no checkout completo; instalação Bun; TypeScript/typecheck; build Vite; testes de React montado; renderização de interface; reconexão de rede real; Realtime e polling com Supabase autenticado; E2E de cancelamento/redistribuição; Android/APK; deploy; banco de produção. Não confundir os resultados do runtime V8 com teste de aplicativo completo.

## Riscos residuais e critérios de homologação

1. A política usa `updated_at` e `accepted_at` como versões do backend. Para estados distintos que compartilhem a **mesma versão exata** ou timestamp inválido, o cliente é conservador e pode exigir outra atualização; falta um contador/epoch explícito de atribuição para garantias mais fortes. Não inventar esse campo na produção.
2. A ressincronização após evento ambíguo é apenas uma leitura autorizada. Se a rede falhar, mantém o último estado aceito e depende da próxima tentativa de polling/reconexão. Não há mutação nem tentativa de cancelar automaticamente.
3. A transformação de status pressupõe que o cancelamento comum realmente limpe atribuição no RPC, conforme evidências prévias. **INV-054 permanece G**: funções de cancelamento/recusa/dispatch não implantadas no projeto auditado; INV-055/056 também aguardam validação. Nenhum E2E foi inferido.
4. Testar com contas sintéticas controladas após autorização: A → busca → B, eventos Realtime fora de ordem, refresh, background/foreground, reconexão lenta, corrida iniciada, estados terminais, troca de conta e de rideId, e visualização em 320/360/390 px.

## Inventário da mudança e reversão

- **Novo:** `scripts/fix-report08-passenger-redispatch-v1.mjs`
- **Novo:** `scripts/qa/test-report08-passenger-redispatch-v1.test.mjs`
- **Alterado:** `scripts/build-isolated-module.mjs` — somente sequência de chamada no caminho Corridas
- **Documentos:** este relatório e adição de INV-057 à matriz histórica

Nenhum arquivo de `sources/`, Entregas, Motorista/Admin, Supabase, pagamentos, identidade visual ou migrações foi alterado. Reversão por commit incremental na branch de auditoria; nenhum rollback de serviços externos necessário.

**Matriz consolidada após esta fase:** adicionar somente **INV-057 B** aos 56 registros anteriores. **Total 57**: A 0 / B 38 / C 15 / D 0 / E 1 / G 3. Preservar todas as pendências anteriores; não promover nenhum item a A por testes sintéticos.

**Continuidade:** aceitar Relatório 09 sem APK; homologação final continua bloqueada até a frase de liberação expressa do responsável.
