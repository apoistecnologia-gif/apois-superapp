# Gate consolidado — APOIS Motorista GPS próprio (25/11/2026)
**NÃO LIBERADO PARA CORRIDAS REAIS / SEM APK.**
Base preservada: cb970bbb2d4fe5358b64d24dc31de8fcbcc3bff4. Antes deste documento, HEAD ae7c98e: 93 commits à frente, 147 arquivos modificados, todos restritos a labs/apois-navigation e workflows exclusivos. Comparação pela API GitHub. Nenhum arquivo APK/AAB ou keystore na árvore do laboratório. O novo gate release-scope verifica a comparação integral com a base, flag desativado, Activities privadas, gateway loopback e ausência de configuração nativa padrão; não equivale a autorização de release.

| Evidência | Estado verificado |
|---|---|
| Ferrostar + Kotlin; validação do mapa antes da rota | SUCCESS 45609499843 (3b932f2) |
| WebView QA290 e voz gerada | SUCCESS 45609766294 (6224805) |
| Valhalla regional, 7 testes gateway, 5 rotas OSRM e 3 replays | SUCCESS 45609195768 / 45608869135 |
| Capacitor, integração anterior | SUCCESS 45609195883 (82bd703) |
| Capacitor exato e nova revogação de áudio | 45609956915 e 45609956849 em andamento na consulta; sem afirmar sucesso antes de concluir |
| Testes físicos | NÃO EXECUTADOS |
| Destinos independentes e infraestrutura real | NÃO CONFIGURADOS |

## Decisões que não podem ser resolvidas por novos commits de laboratório
1. Autorizar separadamente a aquisição de destinos independentes (GPS/mapa OSM ou geocodificação independente), vinculando a evidência à corrida. Não alterar Passageiro/Backend nem promover coordenadas históricas neste escopo. Uma simples etiqueta source no objeto RidePoint, ou uma reconsulta a partir de conteúdo Google, não prova independência.
2. Escolher infraestrutura de roteamento. O Valhalla e gateway local estão testados, mas não expostos. Não contratar serviços, fazer deploy, configurar domínio, abrir portas públicas ou trafegar dados reais sem autorização. Exigir TLS, autorização por motorista/rota, limites, retenção mínima e ODbL.
3. Autorizar APK de homologação isolada, somente após gates anteriores e CI atualizado. Identidade de assinatura original não será alterada. O protótipo exige API 25 enquanto o host histórico é API 24; decidir compatibilidade antes de distribuição, não alterar minSdk de produção unilateralmente.

## Roteiro de homologação física (ainda não executado)
- Primeiro iniciar no modo desligado; confirmar login, cadastro, oferta, aceite, GPS, PIN, corrida, cancelamento, finalização, avaliação, assinatura e retorno do Google Maps/Waze sem regressão.
- Validar pacote de mapa, leitura de PMTiles, glyphs pt-BR, atribuição visível, contraste, rotação, zoom e baixo armazenamento.
- Usar somente dados fictícios ou contas/rotas especificamente autorizadas. Embarque e destino independentes, categoria carros; outros perfis e múltiplas paradas seguem mapa externo.
- Testar rede desligada, GPS impreciso, desvio, ponte nos dois sentidos, mudança de fase, logout, token renovado, segundo plano, recriação e fechamento atrasado. Validar voz pt-BR física, preferência do usuário, interrupção por oferta, ausência de duas vozes e de dois navegadores.
- Medir bateria, dados, latência remota, recursos do servidor, rejeições e limites reais. Sem extrapolar benchmark local de 100 solicitações para capacidade de produção.
- Reprovação de qualquer gate mantém feature desligada. Não fazer merge/deploy automático.
