# APOIS Parceiro — QA242 | PIN por alavanca e distância sem rotas pagas
**Base:** QA241, commit `846be7624c803b8e8612e6136a013b83a8e91678`  
**Escopo:** somente Motorista, transformações em workspace descartável.  
**Build:** expressamente não autorizado nesta rodada. Não gerar APK, não publicar, não fazer merge.

## Evidências do teste físico (vídeo 1001992900.mp4)
- No embarque, “INICIAR CORRIDA · DIGITAR PIN” continuava botão comum; o diálogo de confirmação do PIN já usava alavanca.
- O HUD superior exibiu “ETA — · — km · —” no embarque e no percurso após a QA239 desativar rotas internas.

## Alterações
1. `scripts/fix-partner-qa236-pickup-pin-v1.mjs`: nos estados `motorista_a_caminho` e `motorista_chegou`, o acionamento do diálogo PIN passa a `ApoisSlideAction`, usando `onConfirm` original. A segunda alavanca — **Confirmar PIN e iniciar corrida** — permanece; seus 4 dígitos e as checagens reais de GPS, proximidade, precisão e `callStart` não mudam.
2. `scripts/fix-partner-qa242-gps-distance-hud-v1.mjs`: o painel superior mostra distância por cálculo matemático local `haversineKm` entre GPS e embarque/destino, rotulada **“em linha reta”**. A distância é aproximada e diferente daquela percorrida pelas ruas. Se GPS não existir, informa “Distância: aguardando GPS”. Não faz chamada à Routes API, não simula ETA e não restabelece recálculo de percurso interno.
3. Testes específicos atualizados/adicionados e fase QA242 ligada ao `scripts/build-partner-release.sh` **somente para execução futura autorizada**.

## Preservação obrigatória
- Google Maps/Waze permanecem responsáveis pelo direcionamento das ruas.
- Marcadores agregados de demanda, geolocalização, despachos, navegação externa, PIN, chegada automática, multas, finalização, Entregador e Cliente não foram alterados.
- Sem alteração em Supabase, Google Cloud, códigos protegidos ou bancos.

## Verificações executadas nesta rodada
- Leitura do vídeo e confronto com as transformações QA236, QA239 e HUD QA221.
- Inspeção estática de código e parse sintático dos 4 scripts afetados.
- Simulação em memória da transformação QA242: dois HUDs e os dois destinos corretos, sem executar build.
- Consulta à lista de workflows para a branch: nenhum acionado.

**Ainda não executados:** typecheck do app completo, testes com o workspace real, compilação Android, APK, instalação e homologação física. São pendências deliberadas pela ordem “não gere app”.
