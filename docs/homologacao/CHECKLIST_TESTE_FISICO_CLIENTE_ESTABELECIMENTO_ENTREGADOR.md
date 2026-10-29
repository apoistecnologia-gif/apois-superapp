# APOIS — teste físico Entregas, sem PIX, no Supabase já existente

Data de preparação: 29/10/2026. Ambiente de banco: Entregas de produção (com acesso a dinheiro de teste restrito e desabilitado por padrão).

## Participantes QA preparados
- Cliente: conta de homologação `qa-cliente@apois-test.dev` já existente; ainda sem endereço com GPS salvo.
- Estabelecimento: `APOIS TESTE Entregas`, slug `apois-teste-entregas-homologacao-20261029`, vinculado à conta QA do comerciante. Criado inativo, fechado e sem entregas, em cidade QA anteriormente configurada (Itainópolis/PI), com o ponto de retirada georreferenciado fornecido pelo responsável; cadastro continua fechado e inativo.
- Produto: `Produto fictício APOIS TESTE`, R$1,00. **Não deve ser preparado, cobrado nem enviado.**
- Entregador: `homolog-qa-2026@apois-test.dev` possui perfil de entregador aprovado, mas está offline, sem GPS recente e sem token push ativo. A conta `qa-entregador@apois-test.dev` ainda não concluiu cadastro de entregador.
- A dupla loja/cliente está registrada em `private.apois_test_cash_access`, com `enabled=false`. Não habilitar antes do GPS e do aceite dos participantes.

## Configuração comercial
- Corridas: dinheiro e cartão de crédito são métodos definitivos pagos diretamente ao motorista.
- Entregas: PIX é a única forma comercial projetada. Dinheiro é restrito ao build QA e ao servidor, por combinação cliente/loja previamente autorizada.
- A integração Safe2Pay/PIX de Entregas ainda não está homologada para concluir uma cobrança real.

## Estado técnico confirmado
- Supabase existente: `ptgkwyyolrdgnqketkjj`. Nenhum projeto adicional.
- Migration de segurança aplicada, e Edge `create-order` v13 ativa com JWT obrigatório e allowlist privada.
- Teste está bloqueado para clientes normais e mesmo para QA até ativação explícita: zero pares autorizados, zero pedidos cash e zero transações financeiras artificiais.
- `scripts/verify-apois-qa-entregas-readiness.sql`: verificação read-only executada com sucesso; loja inativa, GPS configurado, cliente sem endereço e nenhum courier QA elegível; visibilidade anônima foi testada e retornou zero.
- As regras de cálculo zeram merchant_net/courier_earnings/platform_fee em pedidos QA cash; settlement normal permanece preservado para pedidos de produção.

## Condições ANTES de ligar o teste
1. Ponto de retirada informado e configurado no Supabase conforme Google Maps. Revisar segurança e privacidade antes de ativar a loja.
2. Região selecionada: Gameleira, Itainópolis/PI. Confirmar que os dois celulares estarão fisicamente nesse ponto/área. A cidade, o raio de despacho e a posição GPS do entregador devem coincidir com o ponto de coleta.
3. No app de QA, cliente deve salvar endereço próprio com GPS. Entregador aprovado deve entrar com conta de teste e ativar localização para ficar online, dentro do raio da cidade. Push é desejável, mas o polling/Reatime pode cobrir recebimento com app aberto.
4. Aprovar/ativar a loja de teste só depois de confirmar coordenadas reais e permitir entrega, horários de atendimento e disponibilidade. Não abrir loja comercial existente.
5. Um administrador deve habilitar por prazo curto o registro existente em `private.apois_test_cash_access`, e conferir `apois_check_test_cash_access` = true apenas para a dupla QA.
6. Construir um APK **claramente de homologação**, com identificador de pacote distinto, com `APOIS_ENTREGAS_CASH_TEST_MODE=1`. Não distribuir o mesmo pacote ao público. Ainda não foi gerado.
7. Abrir no mesmo banco de QA o painel da loja e app Entregador; não utilizar outras contas em produção como participantes.

## Sequência E2E a registrar
Cliente escolhe item fictício → pagamento DINHEIRO TESTE → pedido `cash/pending` → painel da loja recebe e alerta → aceite → preparo → pronto → solicitar entregador → oferta por polling/realtime/push → entregador aceita → coleta → segue rota → PIN → conclusão.

## Verificações após teste
- Confirmação visual nos três aplicativos.
- Verificar apenas o ID do pedido QA em orders, delivery_jobs, delivery_offers, delivery_events, notification_push_outbox.
- Confirmar `orders.payment_status=pending`, sem `paid` e sem cobrança externa.
- Conferir zero `wallet_transactions`, zero `courier_settlement_deliveries` e zero obrigação de repasse gerada para o pedido QA.
- Desabilitar o par em `private.apois_test_cash_access` e fechar a loja QA ao encerrar.

## Custo e limites
- Não foi provisionado nenhum novo recurso. Banco, Edge Functions, Maps e push existentes continuam sujeitos a quotas/possível cobrança do plano atual.
- Não houve teste físico, pedido criado ou chamada disparada no momento deste checklist.