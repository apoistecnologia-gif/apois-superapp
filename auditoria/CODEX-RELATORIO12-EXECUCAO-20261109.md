# APOIS — Relatório 12 | Destino, validação de coordenadas e escolha no mapa

**Execução:** 09/11/2026. **Entrada:** `RELATORIO-12-APOIS-DESTINO-E-ESCOLHA-NO-MAPA-20261109(1).md` (09/11/2026).  
**Escopo exclusivo:** `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`. **Sem merge, APK, API paga, corrida ou deploy.**  
**Achados do auditor:** INV-064 (P2) e INV-065 (P1 no caminho de escolha no mapa).

## 1. Integridade e evidências anteriores

Conferidos diretamente no GitHub antes da execução:
- `.apois/source-lock.json`, blob `3f98789f28666ccc052175db10f138208dd0937b`: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`. Todos **read-only**.
- `auditoria/CODEX-RELATORIO11-EXECUCAO-20261109.md` e `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md`: 63 registros anteriores (A 0 / B 43 / C 16 / D 0 / E 1 / G 3).
- `scripts/harden-corridas-destination-search-runtime.mjs` (antes blob `d0ba0d706a6f90500c8d688c3f772821a9227542`), o gerador Places real.
- Fonte Passenger pinada: `src/routes/_authenticated.buscar-destino.tsx`, `src/components/map/PassengerMap.tsx`, `src/services/geocoding/geocoding-service.ts`, `src/hooks/use-destination-history.tsx`, `src/hooks/rides/use-ride-stops.tsx`, `src/types/places.ts` e `src/types/rides/stops.ts`.
- Scripts integradores de Maps nativo, foco de embarque, câmera de viagem, GPS, sugestões, favoritos e confirmação de paradas; sequência e verificadores de `scripts/build-isolated-module.mjs`.

O relatório do auditor nomeava `audit/ecossistema-20261107` como branch de investigação. A execução manteve **somente `audit/continuacao-20261107`**, preservando a continuidade.

## 2. INV-064 — P2 — coordenadas ausentes/fora de faixa aceitas pelo normalizador

**Antes:** no `selectPrediction` gerado, `Number(rawLocation?.lat)` e `Number(rawLocation?.lng)` convertiam `null` e string vazia em `0`; valores como 95/200 passavam pela verificação `Number.isFinite`.

**Depois — Estado B (implementação versionada; sem homologação integral):**
- Alterado **o próprio gerador** `scripts/harden-corridas-destination-search-runtime.mjs`.
- O parse exige latitude e longitude com `typeof ... === "number"`, finitude, latitude entre -90 e 90 e longitude entre -180 e 180.
- `null`, `undefined`, strings vazias, strings numéricas, `NaN` e coordenadas fora de faixa geram `places_invalid_location` **antes** de construir `DestinationAddress`, portanto não são entregues ao caminho normal de histórico/favoritos/rota.
- Coordenadas numéricas legítimas (incluindo 0,0 e os limites) permanecem aceitas.
- **Decisão técnica explícita:** strings numéricas são recusadas; o contrato atual da Edge de detalhes opera com `geometry.location.lat/lng` numéricos. A resposta do provedor real não foi chamada para testar variações não documentadas.
- Busca autenticada, debounce, timeout, sequência/cancelamento, retry e regra de não guardar autocomplete vazio em cache permanecem inalterados.

**Limite:** testou-se a fronteira com objetos sintéticos, não se demonstrou que o Google/Edge devolveu dados inválidos nem que um pedido de corrida foi emitido com eles.

## 3. INV-065 — P1 — botão do mapa informa sucesso sem escolher destino

**Antes:** `handleConfirmMapSelection` só executava `toast.success`, fechava a escolha no mapa e reabria o BottomSheet; o componente de mapa estava na Home, **não estava montado na rota de escolha**. Assim, não existia um contrato de câmera disponível para ler o pin nesta rota.

**Depois — Estado B (implementação versionada; sem homologação integral):**

Criado `scripts/fix-report12-destination-map-v1.mjs`, aplicado somente aos arquivos da cópia isolada `.work/corridas`:
1. **`src/components/map/PassengerMap.tsx`:** propriedades opcionais `selectionMode` e `onSelectionCenterChange`; reutiliza a instância original do mapa, sem criar provedor paralelo. No modo de seleção observa `setOnCameraMoveStartedListener` e `setOnCameraIdleListener` no adaptador nativo Capacitor, e os eventos `dragstart`/`idle` no Google Maps JavaScript. A câmera é marcada indisponível enquanto se move e só oferece coordenada estável após parada; não aceita coordenada inválida. A câmera não retorna automaticamente a origem/rota durante a escolha. O identificador de mapa nativo da seleção é isolado do da Home, reduzindo colisão com desmontagem.
2. **`src/routes/_authenticated.buscar-destino.tsx`:** monta o **PassengerMap existente** atrás do pin apenas quando a pessoa escolhe “Escolher no mapa”, preservando as entradas a partir da lista normal, retorno vazio e erro das sugestões. O botão exige uma câmera estável válida; o texto diferencia destino e parada e informa “Identificando endereço...” durante a consulta.
3. A confirmação chama o **serviço já integrado** `geocodingService.resolvePickupAddress` com **as coordenadas reais observadas**. Sem endereço identificável, ou caso o mapa tenha mudado antes da resposta, a operação mostra erro e mantém a escolha recuperável, sem sucesso fictício.
4. Após sucesso válido, cria `DestinationAddress` com latitude/longitude exatas do pin e identificador local estável `map:lat,lng`, **sem fingir ser um placeId do Google**. A origem `source: "map_selection"` foi adicionada nas tipagens `src/types/places.ts` e `src/types/rides/stops.ts`. O handler usa o **mesmo `handleFinalSelection`** de sugestões/histórico, atualizando destino ou a parada conforme `isStopSelection`, e a mesma rotina `addToHistory`. Se estiver no modo salvar favorito, reaproveita `saveAddress`, sem substituir destino por engano.
5. Um lock síncrono impede duplo clique com geocodificação simultânea; uma geração invalida callbacks após desmontagem. Mensagem de sucesso só ocorre **após** registrar seleção. Não há persistência adicional, mapa novo, código de tarifa, mudança financeira ou lógica de pedido.

Os métodos e dados de câmera previstos pelo plugin `@capacitor/google-maps` foram confrontados com a documentação pública do próprio plugin, incluindo `setOnCameraIdleListener`, `setOnCameraMoveStartedListener`, latitude e longitude. Isso **não substitui compilação nem Android real**.

## 4. Encadeamento seguro no pipeline existente

O builder já aplica `harden-corridas-native-map`, `harden-corridas-pickup-map-focus`, `harden-client-live-ride-camera-v2`, busca Places, layout, sugestões, favoritos, GPS e Report09. O novo gerador do Relatório 12 é executado **imediatamente depois** de `fix-corridas-current-gps-fallback-v1.mjs`, **antes** da captura da baseline funcional `protectedCorridasMapRuntimeAfterVisual`.

A verificação anterior de migração exclusivamente visual (comparação byte a byte) permanece onde estava, **antes** do GPS e do Report12; não foi desativada. A checagem final que protege mapas, GPS e Places contra alterações posteriores também permanece ativa. O Report12 é mudança funcional declarada, contemplada na nova baseline. O gerador falha se perder âncoras ou se executado duas vezes e mantém os arquivos em memória até concluir as verificações.

Nova suíte `scripts/qa/test-report12-map-selection-v1.test.mjs` conectada ao builder com `node --test`; contempla normalização e caminho de confirmação, usando fixtures e callbacks sem serviços externos. **A suíte Node no checkout integral ainda NÃO foi executada.**

## 5. Verificações realmente executadas

**15? Não: totais apurados e descritos sem inflar contagens.**

- **14/14 checagens de integração sintética:** executado o gerador versionado sobre quatro arquivos de fonte pinada com marcadores dos hardeners anteriores inseridos apenas em memória para representar a sequência. Foram testados os contratos JS e nativo de observação de câmera, a supressão de auto-follow durante escolha, geocoding existente, seleção, favorito, histórico, prevenção de falso sucesso, os modos de destino/parada e tipagens. **Não foi o builder completo**.
- **21/21 verificações comportamentais sintéticas:** código real versionado do handler extraído do gerador executado com setters, câmera e geocoder simulados (destino B, histórico, parada, favorito, falha por posição ausente, endereço indisponível, mapa movido durante a requisição, duplo clique). Validação real extraída do template Places executada com valores nulos, ausentes, strings, NaN e fora de faixa, além de 0,0 e limites válidos. Sem chamada remota nem conta real.
- **Suíte Node versionada:** oito cenários com fixtures do código integrado, **não executados** no checkout completo. (A suíte foi incluída para falhar no futuro build se os contratos de regressão divergirem.)

**Não executados:** `build-isolated-module`, instalação de dependências, `node --test` real, `tsc`, React, Vite, Android, Mapas nativos/JavaScript em execução, geocodificação real ou paga, fluxo físico de parar o pin, automação do toque, pedido/cobrança de corrida, deploy, migração ou publicação. O Relatório 12 **não** demonstra que a integração nativa esteja homologada em aparelho.

## 6. Mudanças versionadas e reversão

- **Modificado** `scripts/harden-corridas-destination-search-runtime.mjs`: validação de coordenadas INV-064.
- **Criado** `scripts/fix-report12-destination-map-v1.mjs`: adaptação de câmera e confirmação INV-065 em quatro arquivos da cópia Corridas.
- **Criado** `scripts/qa/test-report12-map-selection-v1.test.mjs`: testes com mocks.
- **Modificado** `scripts/build-isolated-module.mjs`: adiciona gerador e verificação Node no momento correto.
- **Criado** este relatório de execução.
- **Atualizada** somente a seção acumulativa do Relatório 12 na matriz histórica.

Reverter os commits dessa fase na branch desfaz as novas transformações geradas. Como nada foi aplicado em Supabase nem publicado, **não há rollback de dados** desta execução.

## 7. Pendências e consolidação

Para homologação final: confirmar que o mapa recebe gestos e emite câmera estável em JS e no dispositivo nativo, mover A→B, confirmar B como destino, inserir parada correta, tratar falha/retry de geocoding, GPS indisponível, Android de tela pequena, teclado/safe-area, texto ampliado, histórico/favoritos e evitar repetição/alegação falsa. Confirmar que a escolha de centro não altera automaticamente mapa em viagem nem preço fora do fluxo autorizado.

**INV-064 B + INV-065 B = 2 novos achados**, sem reclassificar os **63 anteriores**.

**Total 65 achados: A 0 / B 45 / C 16 / D 0 / E 1 / G 3.**

**Dependências preservadas:** INV-054 G, INV-055/056 C, INV-061 C (migração de exclusão ainda NÃO APLICADA). Demais `QA_NOT_APPLIED` continuam intocadas.

**Liberação de homologação/Android somente após frase expressa:** **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
