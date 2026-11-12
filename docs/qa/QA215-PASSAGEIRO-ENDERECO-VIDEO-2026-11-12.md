# QA215 — APOIS Passageiro — diagnóstico dos vídeos de 12/11/2026

Arquivos fornecidos: `211747.mp4` (186 segundos) e `211806.mp4` (31 segundos). Capturas de teste físico, não um log de erro de backend.

## Constatações

- `211747.mp4`: busca, PIN, viagem e confirmação de finalização seguem operando. A avaliação de motorista exige **Enviar avaliação** ou **Pular avaliação** antes do temporizador existente de 3,2s, por decisão explícita do componente `PassengerDriverRating`. Uma tela aberta sem escolha durante ~2 minutos, portanto, **não prova travamento** do sistema.
- `211806.mp4`: depois de avaliação confirmada e retorno para Início, `Local de partida` alterna entre `Identificando seu endereço...` e `Endereço indisponível`. O mapa possui coordenadas; a falha visível está no fluxo de reverse-geocoding e não comprova ausência de GPS.
- Causa demonstrável em código: `use-pickup-address.tsx` reexecuta o reverse-geocoding ao atualizar `location`; o guarda anterior registrava `lastGeocodeRef` **somente em caso de sucesso**. Se a API falha, cada novo ponto de GPS pode gerar nova requisição, alterando status repetidamente. O guarda de 85m também bloqueava `refreshAddress()` manual após um sucesso.
- A função `google-maps-address` está ACTIVE no Supabase Corridas; a análise de logs agregados não comprovou o motivo exato da resposta de erro nessa gravação.

## Correção isolada

- `scripts/fix-corridas-passenger-qa215-pickup-address-v1.mjs` modifica apenas `.work/corridas/src/hooks/use-pickup-address.tsx`.
- Limita tentativas automáticas a ≥20s, ou ≥60s na mesma posição depois de falha; mantém o endereço confirmado se a posição ainda está a menos de 85m; invalida endereço antigo se muda ≥120m; botão manual mantém tentativa forçada; não altera Edge Functions, RLS, pagamentos, GPS nativo nem valor do frete.
- A avaliação de motorista, descontos e lógica de fechamento continuam intactos.

## Verificação pendente
Teste físico com rede ativa, recusa temporária da API de geocodificação e mudança de posição; TypeScript/build aprovados não asseguram retorno efetivo do serviço Google. Não solicitar dados pessoais do passageiro nem executar corridas reais para validar o patch.
