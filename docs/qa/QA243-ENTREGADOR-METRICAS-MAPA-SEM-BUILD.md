# QA243 — APOIS Parceiro Entregador | Contador diário e mapa operacional
**Origem:** QA242, commit 74f7b486e2147f7c61a8bc741c2b1aa0a346c66a  
**Evidência:** vídeo físico 1001992901.mp4, 16,6 s, tela online mostrando Ganhos hoje R$ 0,00 / Entregas hoje 3 / Tempo online 15h20.
**Limites:** somente mudanças em scripts que geram o módulo Entregador; não tocar código protegido, banco, APIs de produção, Cliente, publicações ou Play Store. Sem APK e sem GitHub Actions nesta rodada.

## Causa confirmada: 'Entregas hoje' apresentava contagem histórica
O componente gerado por scripts/harden-partner-courier-waiting-compact-v2.mjs usa metrics.completed_deliveries na posição 'Entregas hoje'. A função get_courier_metrics publicada em Supabase Entregas produção retorna completed_deliveries = count(*) de todos os delivery_jobs com status delivered, SEM filtro temporal. Já earnings_today e online_seconds_today são filtrados pela data local. Portanto, os três cartões não usam o mesmo período.
Uma consulta SQL agregada, sem dados pessoais, identificou um entregador com três registros delivered no histórico e zero na data corrente no fuso America/Recife. Isso confirma a natureza da divergência; registros históricos não devem ser apagados nem transformados em pagamentos.

**Correção:** scripts/fix-partner-qa243-courier-daily-stats.mjs injeta consulta SELECT com count exact / head true, filtrando courier_id do login, status delivered e a janela local de hoje. Usa delivered_at ou updated_at somente quando delivered_at for nulo, espelhando o comportamento temporal da função existente. No erro, exibe '—' (dado indisponível), NÃO 0 inventado nem histórico. O total histórico segue intacto na tela financeira.

## Mapa: diferenças relevantes do Motorista
**Motorista (QA239/QA242):** Google Maps/Waze assume orientação de ruas, app acompanha GPS e marca demanda real agregada; sem recalcular a rota paga dentro do app. Painel superior usa distância aproximada em linha reta pelo GPS.
**Entregador (até QA241):** já integrava navegação externa por estabelecimento/destino, bolha nativa com logomarca e pontos de estabelecimentos reais. Contudo, RouteMapContent ainda continha importLibrary('routes') / Route.computeRoutes com TRAFFIC_AWARE condicionado a VITE_APOIS_ENTREGAS_LIVE_ROUTING, além de registrar métricas na tabela delivery_jobs quando habilitado; não era garantia permanente de ausência de chamadas pagas.

**Correção:** scripts/fix-partner-qa243-courier-external-only-map.mjs remove a computação interna de Routes, desenho de linhas de rota por API, recálculos e RPC update_courier_delivery_route_metrics gerada pelo mapa. Preserva ambos os AdvancedMarker de GPS e destino, CourierLiveMap com estabelecimentos próximos, Recentralizar, navegação externa Google Maps/Waze, bolha de retorno por papel e transições de entrega. Exibe distância *em linha reta* calculada localmente e não apresenta ETA de ruas fabricado. A estimativa financeira e os contratos de valores das entregas NÃO são alterados.

**Limitação importante:** o mapa integrado usa Google Maps JavaScript/Dynamic Maps e continua sujeito à cobrança por carregamento da API, como o Motorista. Não chamar Routes não equivale a zerar todos os custos Maps. Valores faturados precisam ser apurados no Google Cloud por SKU.

## Arquivos QA243
- scripts/fix-partner-qa243-courier-daily-stats.mjs
- scripts/fix-partner-qa243-courier-external-only-map.mjs
- scripts/qa/test-partner-qa243-courier-metrics-map.test.mjs
- scripts/build-partner-release.sh (somente integração futura, sem executar build)
- docs/qa/QA243-ENTREGADOR-METRICAS-MAPA-SEM-BUILD.md

## Verificações
- Vídeo inspecionado e comparado ao código protegido e scripts de transformação.
- Definições SQL reais get_courier_metrics e update_courier_delivery_route_metrics examinadas somente leitura.
- Consulta agregada aos delivery_jobs: três registros históricos do caso e zero hoje.
- Sintaxe dos novos scripts verificada em memória; transformações de contagem diária e mapa testadas contra snapshots sintéticos da origem: preservam a contagem histórica separada, marcadores, navegação externa e retiram Route.computeRoutes e escrita de métricas.
- Teste de regressão QA243 preparado para rodar sobre o workspace gerado quando for autorizada execução de build.

## Não realizado por determinação do usuário
Nenhuma geração de APK, Gradle, GitHub Actions, merge, modificação de Supabase, credenciais, pagamentos ou Google Cloud. O typecheck React completo e a homologação física permanecem pendentes.
