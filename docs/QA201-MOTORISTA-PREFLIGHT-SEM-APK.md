# APOIS Parceiro — QA201, pré-homologação (sem novo APK)

Base canônica: `666430e848414cf7d4eb86e2f840e3f58b7c279c` (QA200). Patch posterior: `scripts/fix-partner-driver-qa201-route-reliability-v1.mjs` e teste `scripts/qa/test-partner-driver-qa201-route-reliability-v1.test.mjs`.

## Confirmações técnicas
- No vídeo QA197 a oferta escondia o mapa com o fundo opaco causado pela transformação visual global. Corrigido em QA200; precisa de validação física futura.
- A QA179 já havia introduzido retry ao cancelar por mudança de célula GPS (~100m), mas a corrida continuava cancelando requisições em deslocamento e sem atualização após receber a primeira rota. QA201 usa epoch + identidade da corrida para descartar apenas respostas obsoletas, preservando respostas válidas após movimento.
- A atualização anterior da rota podia acontecer a cada mudança de célula GPS (~100 m), sem limite real de custo. QA201 passa a condicionar a consulta adicional a deslocamento significativo e intervalo mínimo. QA201 limita o refresh a 3 minutos E pelo menos 450 metros percorridos (ou no máximo duas tentativas após falha), evitando picos de chamadas cobradas.
- No erro da API o cliente desenhava linha reta e inventava ETA a 35 km/h. QA201 não inventa dados; mantém apenas a última rota confirmada da mesma etapa ou mostra marcadores, emitindo aviso anterior.
- O CSS do trip HUD tinha seletor incorreto, pois o atributo data-apois-trip-top-v6 fica no próprio cartão, não no pai. QA201 corrige o seletor, sem alterar o Entregador.
- A barra inferior da viagem mostrava nome, mas omitia a nota genuína. QA201 acrescenta a nota ao lado do primeiro nome sem novo painel, exibindo "Novo" se ainda não houver avaliações.

## Gatilho de navegação vetorial — pendência externa concreta
O usuário exige a aparência do mapa do Passageiro (JSON embarcado) E rotação real da câmera. Google Maps JS não aplica um JSON styles local quando Map ID está presente. É necessário importar e publicar `docs/google-maps/apois-passageiro-vector-style-import.json` no Google Maps Platform, associar a um Map ID JavaScript vetorial com tilt/heading e verificar a conta/custo. Nenhum Map ID APOIS Corridas foi encontrado no build do Motorista; só a chave da Maps JavaScript API. Sem acesso às configurações do Google Cloud, não é seguro ativar o mapa vetorial padrão, alterar cobrança nem afirmar homologação.

## Preservação
Não tocar em fontes protegidas, repositório franciel046631/apois-entregas, pagamentos, RLS, assinaturas, Google Cloud billing nem deploy. A compilação do APK não deve ser disparada até as dependências externas e os testes físicos de GPS/câmera serem resolvidos.

## Estado
Correções de QA201 **registradas em código, aguardando integração e build**. Nenhuma versão Android nova nem homologação declarada.

## Código preparado para vetor sem trocar identidade visual
- `scripts/fix-partner-driver-qa202-cloud-vector-readiness-v1.mjs`: disponibiliza, apenas ao Motorista, o mapa vetorial com Map ID validado e estilo Cloud previamente aprovado. Fora dessas condições continua usando o raster atual, sem mudanças no meio da corrida.
- `scripts/qa/test-partner-driver-qa202-cloud-vector-readiness-v1.test.mjs`: exige associação de Map ID e proíbe misturar estilos locais com Cloud.
- **Não ativado:** ainda não existe Map ID APOIS Corridas configurado/verificado neste ambiente; portanto a orientação não está homologada. O arquivo JSON de estilo para importação está pronto.
