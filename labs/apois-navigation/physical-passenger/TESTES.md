# Teste físico do Passageiro — laboratório
Aplicativo separado, sem rede, conta ou GPS. Mapa real OSM do Vale e catálogo de dois pontos públicos; preço/corrida fictícios e servidor local simulado. Não é o app oficial.
1. Abra e confira mapa, zoom, nomes, busca e seleção dos dois pontos. Confirme os pontos e revise o valor.
2. Mantenha marcada a simulação de perda de resposta. Confirme a corrida. O contador deve subir somente uma vez e o painel oferecer recuperação.
3. Feche o app e reabra; o contador deve permanecer igual e o painel oferecer verificação, não nova corrida. Toque em verificar solicitação, acompanhe a corrida, simule encerramento e verifique novamente. Volte ao fluxo de seleção.
4. Informe se mapa carrega, WebView/IndexedDB/Web Locks funcionam, seleção funciona e recuperação mantém o contador. O laboratório não comprova integração real, CI privado do Passageiro ou operação comercial.

O mapa deste teste usa o pacote Vale preservado (run 45750844751), id e SHA-256 anteriores mantidos. O catálogo original de 390 nós OSM é validado integralmente antes de escolher os dois pontos fictícios do fluxo; nenhum registro real ativado. Preço e distância apresentados continuam simulados, não estimativas reais. O catálogo original é preservado em CI separado, não hospedado publicamente.

Catálogo preservado no run 45762910530, validade confirmada 26/12/2026. SHA-256 fixado: bec83aeb51bb7dbcde8795714ceb9e67598443144c1d8ff73e6c717970474ff6. O APK usa essa cópia, não o artefato antigo de 02/12. Retenção temporária de CI não equivale a distribuição definitiva.

Novo teste automatizado instala o APK debug isolado no emulador API 35, desativa Wi-Fi/dados e usa depuração local WebView/ADB para verificar mapa, armazenamento, escolha dos pontos, recuperação após perda de resposta e force-stop, encerramento fictício e contagem única. Se CDP ou WebView não estiver disponível, falha (não há skip). A distribuição do artefato desta revisão exige esse teste verde. Não habilita depuração no app oficial nem usa dados de cliente; renderização de todos os tiles, toque físico e bateria ainda não comprovados.
