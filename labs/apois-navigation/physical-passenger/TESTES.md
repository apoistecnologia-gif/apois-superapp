# Teste físico do Passageiro — laboratório
Aplicativo separado, sem rede, conta ou GPS. Mapa real OSM do Vale e catálogo de dois pontos públicos; preço/corrida fictícios e servidor local simulado. Não é o app oficial.
1. Abra e confira mapa, zoom, nomes, busca e seleção dos dois pontos. Confirme os pontos e revise o valor.
2. Mantenha marcada a simulação de perda de resposta. Confirme a corrida. O contador deve subir somente uma vez e o painel oferecer recuperação.
3. Feche o app e reabra; o contador deve permanecer igual e o painel oferecer verificação, não nova corrida. Toque em verificar solicitação, acompanhe a corrida, simule encerramento e verifique novamente. Volte ao fluxo de seleção.
4. Informe se mapa carrega, WebView/IndexedDB/Web Locks funcionam, seleção funciona e recuperação mantém o contador. O laboratório não comprova integração real, CI privado do Passageiro ou operação comercial.
