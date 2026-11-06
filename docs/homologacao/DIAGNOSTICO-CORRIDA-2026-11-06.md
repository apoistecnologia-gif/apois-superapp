# APOIS — homologação física de chamada Corridas e contraste Cliente
Data: 2026-11-06; status: correções implementadas e APKs Android gerados; **verificação final no celular pendente**.

## Relato de campo
- Screenshot Cliente: status "Buscando motoristas" e, logo acima de "CANCELAR CORRIDA", um quadro branco contornado em vermelho, sem textos visíveis.
- Screenshot Parceiro / Motorista FRANCISCO: status ONLINE e "Recebendo solicitações", sem cartão de oferta para a corrida requisitada a partir do Cliente.
- Capturas reportadas como testes reais em Petrolina.

## Evidência Supabase somente leitura (projeto Corridas tbbzkrfupmqdywnzgnms)
- Corrida `28fc6b2b-603a-46cf-884b-7c8be4a9fd34` criada em 06/11/2026 às 14:04:21Z, categoria `carros`, posteriormente `cancelada_passageiro`.
- `candidate_driver_ids` e `offered_driver_ids` continham o ID de usuário público vinculado a FRANCISCO (motorista online), `dispatch_attempts=1` e `request_expires_at=14:05:21Z`. Isso comprova encaminhamento da oferta para o cadastro, **não sua apresentação no Android**.
- Nos logs de Android Parceiro entre 14:04:20Z e 14:05:40Z, chamadas repetidas `driver_set_presence` e leitura de viagens **ativas**, mas nenhuma consulta nova a `rides` filtrada por `candidate_driver_ids` após criação da corrida. Não foi observada aceitação de motorista.
- O mesmo aparelho registrou alguns `driver_set_presence` HTTP 401 antes do pedido, seguidos por HTTP 200; verificar continuidade de sessão se persistir. NÃO interpretar como a única causa sem evidências adicionais.
- Duas contas de motorista registradas com `approval_status=aprovado`, assinatura `teste`, veículo `carros` e indicador `is_online=true` em consulta de 06/11. Sem alterações SQL.

## Correção Cliente (branch fix/passageiro-ocorrencias-safearea-20261105)
- Novo script `scripts/fix-corridas-ride-timeline-contrast-v1.mjs` aplicado em `scripts/build-isolated-module.mjs`, corrigindo fundo, borda, marcadores e cores explícitas de Embarque, Paradas e Destino Final em `RideStopsTimeline.tsx`.
- A imagem sugere contraste inadequado do bloco; só o teste físico distinguirá com certeza a origem da área branca.
- GitHub Actions Cliente execução [#97](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42238212246): job `build-client-apk` SUCCESS, assinatura QA pinada validada, APK no artefato `APOIS-Cliente-TESTE` ID 13513261972. Job paralelo TypeScript ainda falha em erros previamente observados. Gatilho temporário retirado.

## Correção Parceiro (branch fix/motorista-39-achados-20261105)
- Novo script `scripts/fix-partner-motorista-offer-watchdog-v3.mjs` após os hardeners existentes em `scripts/build-partner-release.sh`. Novo teste `scripts/qa/verify-partner-motorista-offer-watchdog-v3.mjs`.
- Restaura leitura independente de ofertas pendentes enquanto online a cada 3,5 s em app aberto, sem depender de eventos Realtime, FCM ou indicador `navigator.onLine`. Mantém `presentOffer` original para confirmar categoria, prazo, recusa anterior, corrida ativa e elegibilidade; somente consulta com RLS, não altera despacho nem aceita corridas sozinho. Mostra aviso após falhas sucessivas.
- GitHub Actions Parceiro execução [#121](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42238507140): SUCCESS, build Motorista + Entregador, verificação do certificado de assinatura QA e APK no artefato `APOIS-Parceiro-TESTE` ID 13513820799.
- O patch ainda requer teste físico com dois aparelhos e disparo de NOVA corrida de homologação; a oferta anterior já terminou cancelada.

## Teste de aceitação recomendado
1. Instalar APKs QA Cliente #97 e Parceiro #121 (certificados QA anteriores preservados), iniciar sessão e deixar motorista ONLINE.
2. Solicitar nova corrida `carros` em área próxima; o Parceiro deve mostrar cartão com tempo/valor e botão Aceitar dentro da janela da oferta (60 s, de acordo com dados observados; verificar as regras de negócio atuais).
3. Aceitar no Parceiro e observar avanço no Cliente, sem duplicações; testar também recusa e cancelamento; conferir status no banco sem mexer manualmente.
4. No Cliente, conferir visualização de embarque e destino no quadro antes do botão de cancelar. Reportar novo print se ainda houver quadro em branco.

## Guardrails
- Nenhuma modificação no Supabase produção, permissões, pagamentos, geolocalização, regras do despacho, contas ou certificados de produção.
- Correções nas branches isoladas; nenhuma publicação em loja ou merge.
- NÃO declarar resolução física sem testes do usuário. Não recriar apps, não refazer arquitetura de dispatch nem liberar aceite automático.
