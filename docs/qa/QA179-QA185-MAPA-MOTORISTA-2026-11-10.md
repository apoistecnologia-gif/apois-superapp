# APOIS Parceiro — investigação focada do mapa do Motorista (QA 179 → QA 185)

Data: 2026-11-10 (America/Recife).
Repositório integrador: `apoistecnologia-gif/apois-superapp`; branch: `audit/continuacao-20261107`.
Fonte protegida Motorista/Admin preservada no submódulo `sources/apois-corridas-motorista-admin` (pin `9fc171050d8b5703540c49d19a8f1e9f5162775f`). Nenhum banco, deploy ou merge foi realizado.

## Evidência funcional: vídeo de Android da QA 179

A captura de 77,78 s fornecida pelo proprietário mostra o mapa com ruas no modo ocioso e, ao entrar no ciclo de corrida, a mensagem **"O mapa não carregou corretamente"**. Ocorrem também **"Rota temporariamente indisponível"**, ETA/distância indisponíveis e recuperação visual do mapa após retorno ao estado ocioso. O aceite, chegada/PIN e finalização permanecem acessíveis. Isso confirma falha de mapa em uso real, mas a gravação não contém uma exceção JavaScript nem Logcat; portanto não prova a stack trace exata.

## Achado de código e documentação

Na QA 179, `scripts/fix-partner-motorista-map-startup-stability-v1.mjs` alterava as opções de `MovviMap` para: `renderingType: isDriverRole && navigationMode ? google.maps.RenderingType.VECTOR : undefined` (com verificação de presença de `google`). O mesmo mapa era inicialmente aberto sem navegação e recebia novas opções quando a corrida era aceita. Isso cria uma alteração de uma propriedade que a documentação oficial do Google Maps JavaScript API declara que **não pode ser definida ou alterada depois da instância do mapa**. Referência: https://developers.google.com/maps/documentation/javascript/reference/map#MapOptions.renderingType.

Este conflito é uma causa técnica concreta e altamente plausível para a regressão de transição do mapa; a causa exata da exceção no aparelho permanece **não confirmada** por falta de Logcat.

Outro problema independente foi identificado no efeito de rota de `src/routes/motorista.app.tsx`: ele dependia da latitude/longitude brutas e tinha limpeza `cancelled=true` a cada atualização relevante do GPS, enquanto `lastRouteRequestKeyRef` podia impedir nova solicitação do mesmo trecho. Isso podia descartar a resposta de rota/ETA e manter campos vazios. A gravação, isoladamente, não distingue esse problema de eventuais erros de autenticação, quota ou disponibilidade da Edge Function `passenger-routes-compute`.

## Correção já commitada no integrador

Os commits posteriores à QA 179, de `da62d2ac9de85c403f3b2287faf78b0398871a0a` até `11160d2f79bc479541e07fd165668eb8988fa846`, introduziram e passaram a executar `scripts/fix-partner-motorista-active-ride-map-v2.mjs` e o teste `scripts/qa/test-partner-motorista-active-map-v2.test.mjs`.

Mudanças: mapa sem alternância dinâmica para VECTOR (`renderingType: undefined`); interações de tilt/heading desabilitadas para essa apresentação; menor sensibilidade a GPS no efeito de cálculo de rota; liberação da chave de requisição quando uma solicitação é cancelada durante remontagem/atualização; manutenção do cálculo real `callRoute`, polyline, voz, PIN e comandos da corrida.

Limitação visual deliberada: navegação 2D estável tem prioridade sobre rotação/inclinação 3D. Sem suporte vetorial validado no Android WebView, não declarar rotação de mapa totalmente disponível.

## Evidência de build e pacote

Workflow: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42934585859
Run: QA 185, commit de código `11160d2f79bc479541e07fd165668eb8988fa846`, conclusão `success`.
Build React/TypeScript, verificações do Motorista/Entregador, Android Gradle, integridade de assets e assinatura executados pelo workflow. Log do job confirma `BUILD SUCCESSFUL`, `Partner APK signature matches protected original QA certificate`, app `br.com.apois.parceiro`, `versionCode=213`, `versionName=1.0.28-qa.185`.
Artefato GitHub: `13817624269`, SHA-256 do ZIP `c94a44e48839fa8ac14c72d673f4fe79e605f73fe21da1e6dfa104669668d967`.
SHA-256 do APK extraído: `82b3245a43451cfd184136e1a2318d6a10d4eb999f50e4e9552d028a56d2f885`.
Upload Drive confirmado: https://drive.google.com/file/d/1S5sbnV5wQbW4VZCiKKEyCy2hMwhj2mNN/view

Comparação de QA179 e QA185 extraídos dos dois APKs: os JS/CSS/recursos dentro de `assets/public/modules/entregador/` ficaram idênticos; o HTML desse módulo difere apenas por timestamp de hidratação. Os novos chunks JavaScript estão em `assets/public/modules/motorista/`. `sources/` e source-lock não foram alterados pela correção.

## Situação de homologação

**QA 185 pronta para teste físico, NÃO homologada funcionalmente.** Não houve acesso à execução no Android, WebView/Chrome DevTools nem captura Logcat nesta investigação. Validar no aparelho, na mesma corrida: online → oferta → aceite → rota real ao embarque → ETA/km → deslocamento/GPS → chegada → PIN → rota ao destino → finalização → retorno ocioso → nova corrida. Conferir `getRenderingType()`, erro JS e resposta da Edge Function caso o problema continue. O sucesso do GitHub Actions, isoladamente, não prova a navegação em uso real.

Nenhuma mudança em produção, banco, RLS, pagamentos, repositórios/sources protegidos, passageiro ou módulo Entregador foi realizada para este diagnóstico.
