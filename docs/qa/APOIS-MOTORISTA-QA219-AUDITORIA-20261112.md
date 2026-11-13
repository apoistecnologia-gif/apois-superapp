# APOIS Motorista — QA219 | Auditoria audiovisual e correções isoladas
Data: 2026-11-12. Evidência: vídeo `1001992822.mp4` (100,602 s; 1080×2400; H.264). Critério: inspecionados quadros representativos por segundo em toda a gravação (101 amostras); inspeção de eventos visuais e detecção complementar de cortes. **Não equivale a uma execução E2E real nem à inspeção humana de cada um dos milhares de quadros.**

## Source of truth
- Superapp de homologação: `apoistecnologia-gif/apois-superapp`, branch `build/qa218-android-homologacao-20261112`, HEAD `d52811bf53dbb8edc198b94f70faf986cda86774`.
- GitHub Actions: run `43328315048`, etapa `build-partner-apk` **success**; isto não prova correção de comportamento Android.
- Fonte fixada Motorista/Admin: `apoistecnologia-gif/movvi-go-connect`, commit `9fc171050d8b5703540c49d19a8f1e9f5162775f`, declarado em `.apois/source-lock.json`.
- O build copia a fonte para `.work/partner-motorista` e executa scripts sequenciais de hardening visual, GPS, mapa, PIN, rotas e Realtime. É proibido diagnosticar só pela main do repositório de origem.
- GitHub Actions QA218: `VITE_APOIS_PARTNER_VECTOR_MAP_ID` configurado; `VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED=true`. **A presença do ID no bundle não prova que a engine efetivamente usou VECTOR no aparelho nem que o estilo publicado está associado/atualizado.**

## Matriz de achados (vídeo + código)

| ID | Evidência temporal | Evidência e grau de certeza | Prioridade | Arquivo/correção | Validação exigida |
|---|---|---|---|---|---|
| QA219-01 | ~18–19s, ~43–46s, ~71–74s | Modal de PIN encosta na área do teclado/corta conteúdo. Código confirmado: script de apresentação transformava contêiner em `overflow-hidden`. | P1 | `scripts/fix-partner-driver-pdf-notes-20261112-v1.mjs` mudou para `overflow-y-auto`; teste atualizado. | Android físico com teclado Gboard/Samsung; título, 4 dígitos, Confirmar, Cancelar acessíveis com IME aberta e sem sacolejo. |
| QA219-02 | Transições rápidas recorrentes ~0–100s, causa NÃO conclusiva só pelo vídeo | Código de `applyActive` permitia processar eventos terminais antigos mesmo havendo outra corrida/oferta visível; cancelamento limpava `incoming` indiscriminadamente. Risco de corrida de eventos demonstrado estaticamente, ocorrência específica não comprovada por logs. | P0 | `scripts/fix-partner-driver-qa219-stale-ride-events-v1.mjs` aplicado após demais transforms, com teste sintético. Preserva corrida e oferta não relacionadas. | Dois IDs de corrida, notificações fora de ordem, cancelamento de corrida na fila, nova oferta durante viagem; conferir logs Realtime e UI. |
| QA219-03 | Mapa global, várias passagens | Código fazia `map.setOptions({styles,...})` no `onLoad`, mesmo com Map ID de estilo Cloud. A API Google Maps proíbe combinar styles e mapId; configuração vetorial no build foi confirmada. | P1 | `scripts/fix-partner-driver-video-map-rotation-20261112-v1.mjs` passa a aplicar estilo local no `onLoad` apenas quando `!useCloudVector`; teste atualizado. | Testar log da API, `map.getRenderingType()`, estilo publicado, rotação em trajeto GPS físico e fallback explícito. |
| QA219-04 | ~0–100s | Cartões de oferta, pickup, viagem, conclusão e home reaparecem rapidamente. **Suspeita** de ressincronização, polling, corrida acelerada na gravação ou eventos externos. Sem logs/eventos de toque não atribuir causa definitiva. | P0 investigação | `src/routes/motorista.app.tsx`, callbacks Realtime/polling e `useDriverBroadcast`. | Logs com ride_id/status/timestamp e teste de 2 aparelhos; confirmar se é troca inesperada. |
| QA219-05 | ~93s (passagem da navegação) | Texto de ETA/distância indisponível durante troca de estado. O QA201 já tinha fallback honesto sem rota fictícia; se persistente, falha de Routes/retry/autorização. **Suspeita**. | P1 investigação | `fix-partner-driver-qa201-route-reliability-v1.mjs`, `callRoute`. | Instrumentar HTTP/status/epoch/rota; simular perda/reconexão sem chave real em log público. |
| QA219-06 | Várias passagens | Manchas azul-marinho escuras no mapa. O estilo APOIS define `water.geometry=#0B2944`; **não classificar automaticamente como corrupção de tiles**. | P2 qualidade | Estilo Cloud / `docs/google-maps/apois-passageiro-vector-style-import.json`; contraste e rótulos. | Comparar localização real e aparência do Google Maps na mesma coordenada. |
| QA219-07 | Ofertas com 0,0 km até embarque e ~5,3 km de percurso | Grandezas são etapas diferentes: proximidade do motorista ao embarque versus distância embarque→destino. **Não há contradição comprovada**. | Informativo | Sem correção sem confirmação de cálculo incorreto. | Verificar trajetos de pickup/destino e relógio de GPS no aparelho. |
| QA219-08 | Ganhos 3 corridas/R$64,05 e 4 corridas/R$85,45 | Diferença exata de uma corrida de R$21,40 vista no vídeo; pode ser atualização esperada após finalizar. **Não declarar erro financeiro.** | Informativo | Sem mudanças no financeiro. | Comparar com ledger e histórico do usuário em QA autorizado. |

## Código efetivamente alterado — branch de correção
Branch: `fix/motorista-qa219-video-20261112`.

1. **PIN Android**: modal verticalmente rolável sob teclado; preserva campos reais e verificação do PIN no servidor. Teste `scripts/qa/test-partner-driver-pdf-notes-20261112-v1.test.mjs`.
2. **Eventos terminais defasados**: protege viagem/oferta visíveis contra atualização terminal de outro ID; no cancelamento, limpa somente a oferta de mesmo ID e o overlay da viagem correspondente. Teste `scripts/qa/test-partner-driver-qa219-stale-ride-events-v1.test.mjs`.
3. **Google Maps**: evita `map.setOptions({styles})` quando Map ID Cloud está selecionado, inclusive na primeira inicialização. Teste `scripts/qa/test-partner-driver-video-map-rotation-20261112-v1.test.mjs`.
4. **Orquestração**: alteração de `scripts/build-partner-release.sh` para aplicar/verificar QA219 antes da compilação, somente na cópia descartável do Motorista.

## Evidências e limitações de verificação
- O job do APK original foi verificado como sucesso. **Não** foi disparado novo GitHub Actions nem APK.
- Teste da função de transformação QA219 com casos sintéticos passou em execução JavaScript isolada; ainda não substitui compilação TypeScript ou regressão Android.
- O código novo é específico da UI do Motorista. **Nenhum comando de alteração de Supabase, produção, pagamentos, Entregas, Passageiro, segredos ou Google Cloud foi executado**.
- Antes de gerar APK: rodar todos os testes gerados em `.work/partner-motorista`, `bun run typecheck`, `npm run build:motorista`, conferir QA202/QA209/QA219, e homologar em aparelho físico com Realtime.
- Hipóteses não resolvidas: ciclo real das corridas (incluindo fila), retomada background, GPS real, confirmação do renderer e ETA sob falha de rede.

## Matriz de preservação
Login/Google, cadastro/KYC, mensalidades/financeiro, schema/Edge Functions, Passenger, Entregador, assinatura Android, projeto Maps/faturamento: **sem alteração**. Corrigir em branch de homologação, não fazer merge/publicar/gerar APK sem aprovação.
