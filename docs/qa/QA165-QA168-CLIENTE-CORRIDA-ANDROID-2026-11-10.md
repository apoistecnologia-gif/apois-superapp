# APOIS Cliente — QA165 → QA168: correção focada do rodapé da corrida Android

Data: 2026-11-10/11 (fuso America/Recife). Repositório integrador `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.
Escopo: APOIS **Cliente Corridas**, corrigido exclusivamente via scripts do integrador aplicados em `.work/corridas`. Nenhum submódulo, banco de produção, pagamento, RLS, backend, Motorista ou Entregador foi alterado.

## Gravação física recebida
Arquivo de reprodução do proprietário: `211110.mp4`, duração 111,57 s, resolução 720×1600 (Android). Evidências visuais:
- 00:00–00:39: seleção da categoria, revisão e preferência de conforto; solicitação aceita.
- 00:39–00:49: busca de motoristas com mapa e bottom sheet.
- 00:51–01:24: cartão de segurança/PIN, motorista e veículo, mas ações “Reportar problema com esta corrida” e “CANCELAR CORRIDA” ficam sobrepostas às informações do painel rolável.
- 01:27–01:39: estado da viagem; a barra continua tapando parcialmente dados de viagem.
- 01:39–01:51: finalização e interface de avaliação do motorista; botão inferior próximo à navegação do sistema.

A gravação não prova deslocamento real do GPS, portanto não demonstra sozinha falha de recomputação de rotas. O mapa mantém visualmente a polyline vermelha entre os estados. O código de `PassengerMap` prioriza a `encodedPolyline` persistida da corrida; verificar em teste com motorista **em movimento** e confirmar se a polilinha de aproximação e a de viagem representam os trechos corretos, antes de introduzir chamadas de API extras.

## Causa da sobreposição confirmada no código
1. `scripts/harden-corridas-trip-flow-ux.mjs` extraía o botão `CANCELAR CORRIDA` do bottom sheet e o montava em um container `fixed inset-x-0 bottom-[max(64px,env(safe-area-inset-bottom))]` com `z-[200]`.
2. `scripts/harden-corridas-case-center-v1.mjs` acrescentava “Reportar problema com esta corrida” no mesmo ponto próximo ao botão de cancelar.
3. A área de ações sobrepunha `DriverCard`, `VehicleCard`, detalhes e valores, em vez de reservar espaço no layout.

## Mudanças efetivas no integrador
- `scripts/harden-corridas-trip-flow-ux.mjs`: container de ações deixa de ser fixo/sobreposto e passa a ser filho `relative z-20 shrink-0` do layout flex, com espaço próprio e reserva inferior para barra Android; marcador `data-apois-passenger-inflow-actions-v1`. Os dois botões e callbacks permanecem.
- `scripts/verify-corridas-dispatch-ux-v1.mjs`: substitui o antigo teste, que obrigava manter o bug `fixed`, por assertivas de layout em fluxo, sem mudar os testes de despacho.
- `scripts/qa/test-corridas-ride-footer-layout-v1.test.mjs`: exige os dois botões no rodapé não sobreposto, seu posicionamento após o painel rolável, safe area, suporte/cancelamento e ações originais.
- `scripts/build-isolated-module.mjs` e `.github/workflows/apois-client-android.yml`: executam e disparam essa regressão durante o build Cliente.

Commits:
- `90fc1a8178194bac9839df7008b95a3fa90a857a` — implementação.
- `5a85d4521f5886949791be03e561d7387337f61e` — reconciliação de teste de despacho.
- `54ca4ce715cb2a1a8fb7d598b2567a4aae0be65c` — validação/trigger QA168.

## Histórico de CI
- QA 166: **falhou** por assertiva antiga exigindo rodapé fixo; nenhum artefato aprovado.
- QA 167: compilação concorrente do mesmo conjunto funcional após reconciliar a assertiva (não usada como candidato principal).
- QA 168: **sucesso**. https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42940418958
  - TypeScript/builds, preflight, Android Gradle e assinatura passaram no workflow.
  - `BUILD SUCCESSFUL` — log do job `130260617121`.
  - APK `br.com.apois.app`, `versionCode=168`, `versionName=1.0.11-qa.168`.
  - Certificado SHA256 original preservado, confirmado pelo apksigner do workflow.
  - ZIP artifact ID `13820577239`, SHA256 `01b1780c0c13016f796feb350aa96c45eaf561c399cc2cc82ff310f4380686c4`.
  - APK SHA256 extraído `4a7019968e42bf3a260ce004d5d71a2b3a2577ebe96c97083672dbf5d44317b8`.
  - Inspeção da carga real: `assets/public/modules/corridas/assets/index-ETf69xwk.js` contém o marcador de layout e ambos os textos de ação.
  - Cópia Drive confirmada: https://drive.google.com/file/d/1ljVspLJeu3kTp0JG5PoPlLcr21BL7Q5L/view

## Validação física ainda necessária
**Build verde não é homologação em aparelho.** Instalar QA168 sobre a QA165, sem limpar dados. Repetir busca → aceite → chegada/PIN → viagem → finalização/avaliação. Conferir que as ações não recobrem a ficha do motorista, que o painel continua rolável, que cancelamento e central de ocorrências abrem corretamente, que a barra Android não cobre os controles e que a rota corresponde ao estado e ao GPS real. Sem movimentação física e log da API não se pode confirmar uma falha de tracking.

Nenhum deploy, merge, alteração financeira, migration ou alteração de código protegido autorizado foi executado neste diagnóstico.
