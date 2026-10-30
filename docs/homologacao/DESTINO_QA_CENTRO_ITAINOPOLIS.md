# APOIS — destino diferente da localização física do cliente QA

Registro de homologação em 29/10/2026. Sem pedido, pagamento ou despacho.

## Origem
Loja `APOIS TESTE Entregas` em Gameleira, Itainópolis/PI. As coordenadas exatas fornecidas pelo usuário estão armazenadas somente no cadastro da loja QA, NÃO neste repositório. Loja permanece inativa/fechada.

## Destino de teste salvo no perfil QA
- Cliente fictício: `qa-cliente@apois-test.dev`.
- Endereço salvo com rótulo `TESTE — Centro de Itainópolis (não entregar)`.
- Referência pública: região dos Correios da Rua Gilberto Neiva, 32, Centro, CEP 64565-970, Itainópolis/PI.
- Referências de coordenadas de terceiros: aproximadamente -7.44748, -41.480869; validar no mapa antes de usar para deslocamento físico. O endereço cadastrado está marcado como NÃO ENTREGAR.
- Distância calculada no banco entre loja QA e destino: 8,21 km em linha reta. Raio padrão de entrega: 10 km, sem zonas ativas. Não é distância por estrada.
- Endereço cadastrado como padrão SOMENTE da conta cliente QA. A posição GPS física do celular pode continuar em Gameleira.

## Verificações
- Banco confirmou cidade coerente com o cadastro canônico usado na regra de quote e coordenadas completas.
- `resolve_delivery_quote` ainda retorna merchant_unavailable porque a loja QA permanece desativada — proteção esperada.
- Zero permissões cash ativas, zero pedidos e zero transações de carteira de testes.
- O fluxo de pedido, notificação e aceite pode ser verificado com os aparelhos em Gameleira. Para demonstrar chegada real e precisão da navegação até Itainópolis, é necessário deslocar-se fisicamente.
- Endereço/numeração da agência devem ser conferidos no aplicativo Maps antes de qualquer deslocamento físico. Nunca envolver funcionários dos Correios no teste nem gerar entrega verdadeira.

## Pendências
- Ativar loja QA somente sob controle de visibilidade; usuário QA autenticado precisa poder navegar no catálogo da loja sem divulgá-la ao público.
- Autorizar par loja/cliente QA por prazo curto e validar zero crédito de carteira.
- APK de homologação cash e painel configurados, entregador elegível presente, confirmar fluxo sem cobranças.
- Analisar posteriormente nome da cidade com problema de codificação e coordenadas globais do centro cadastradas próximas à Gameleira. Não alterar cidade global sem auditoria.