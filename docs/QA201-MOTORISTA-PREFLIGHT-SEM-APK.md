# APOIS Parceiro — QA201, pré-homologação (sem novo APK)

Base canônica: `666430e848414cf7d4eb86e2f840e3f58b7c279c` (QA200). Patch posterior: `scripts/fix-partner-driver-qa201-route-reliability-v1.mjs` e teste `scripts/qa/test-partner-driver-qa201-route-reliability-v1.test.mjs`.

## Confirmações técnicas
- No vídeo QA197 a oferta escondia o mapa com o fundo opaco causado pela transformação visual global. Corrigido em QA200; precisa de validação física futura.
- A busca Google Routes era cancelada implicitamente após um novo tick do GPS e sua chave ficava marcada como atendida, impedindo uma rota válida de aparecer. QA201 usa epoch + identidade da corrida para descartar respostas realmente obsoletas, sem cancelar apenas por movimento.
- No mesmo estado da corrida, a rota e o ETA nunca eram atualizados. QA201 limita o refresh a 3 minutos E pelo menos 450 metros percorridos (ou no máximo duas tentativas após falha), evitando picos de chamadas cobradas.
- No erro da API o cliente desenhava linha reta e inventava ETA a 35 km/h. QA201 não inventa dados; mantém apenas a última rota confirmada da mesma etapa ou mostra marcadores, emitindo aviso anterior.
- O CSS do trip HUD tinha seletor incorreto, pois o atributo data-apois-trip-top-v6 fica no próprio cartão, não no pai. QA201 corrige o seletor, sem alterar o Entregador.
- A barra inferior da viagem mostrava nome, mas omitia a nota genuína. QA201 acrescenta a nota ao lado do primeiro nome sem novo painel, exibindo "Novo" se ainda não houver avaliações.

## Gatilho de navegação vetorial — pendência externa concreta
O usuário exige a aparência do mapa do Passageiro (JSON embarcado) E rotação real da câmera. Google Maps JS não aplica um JSON styles local quando Map ID está presente. É necessário importar e publicar `docs/google-maps/apois-passageiro-vector-style-import.json` no Google Maps Platform, associar a um Map ID JavaScript vetorial com tilt/heading e verificar a conta/custo. Nenhum Map ID APOIS Corridas foi encontrado no build do Motorista; só a chave da Maps JavaScript API. Sem acesso às configurações do Google Cloud, não é seguro ativar o mapa vetorial padrão, alterar cobrança nem afirmar homologação.

## Preservação
Não tocar em fontes protegidas, repositório franciel046631/apois-entregas, pagamentos, RLS, assinaturas, Google Cloud billing nem deploy. A compilação do APK não deve ser disparada até as dependências externas e os testes físicos de GPS/câmera serem resolvidos.

## Estado
Correções de QA201 **registradas em código, aguardando integração e build**. Nenhuma versão Android nova nem homologação declarada.
