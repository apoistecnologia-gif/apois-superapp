# APOIS — dinheiro somente para homologação, sem outro Supabase

## Identidade comercial
- Corridas: Dinheiro e Cartão de crédito são permanentes e pagos diretamente ao motorista.
- Entregas: somente PIX comercial por enquanto; dinheiro é exclusivamente simulação de teste.
- PIX comercial Entregas ainda depende de integração Safe2Pay habilitada. Checkout normal bloqueia finalização para não criar pedido órfão.

## Implementado no Supabase de Entregas já existente
- Projeto: ptgkwyyolrdgnqketkjj. Não criamos novo projeto nem assinatura.
- Migration aplicada: supabase/entregas-forward-migrations/20261029_cash_homologacao_controlada_mesmo_projeto.sql.
- Edge create-order ativa versão 13, verify_jwt=true; PIX permitido normalmente e cash somente para cliente e loja TESTE na whitelist privada.
- Loja de teste precisa ser aprovada, ativa, ter nome começando APOIS TESTE, cliente específico habilitado, prazo não vencido.
- Sem acesso permitido: usuário externo recebe negação. Nenhuma conta é habilitada automaticamente.
- Pedidos teste permanecem cash/pending, sem paid; merchant_net/courier_earnings/platform_fee e estimated_earnings são zerados, não gerando carteira nem repasse.
- Inicialmente não há nenhuma dupla de teste habilitada, nenhum pedido teste e nenhum pedido cash.

## Código mobile na branch fix/apois-cash-test-mesmo-supabase-20261029
- .apois/modules.json: APOIS_ENTREGAS_CASH_TEST_MODE=1 habilita somente o build de homologação com aviso NÃO PAGAR.
- Sem essa flag, Cliente Entregas conserva PIX no checkout, com bloqueio de segurança até Safe2Pay estar comprovadamente pronto.
- scripts/harden-entregas-cash-test-badges.mjs e scripts/harden-entregas-pix-production-guard.mjs mantêm os fluxos visualmente separados.
- scripts/verify-apois-cash-test-same-db.mjs: 18 testes estáticos passaram.
- Corridas permanece com cash/credit diretos e sem qualquer modificação de banco nesta rodada.

## Para teste de ponta a ponta quando houver os participantes
1. Cadastrar uma loja fictícia APOIS TESTE, com produto, endereço, gerente e assinaturas de teste apenas sob autorização restrita.
2. Usar cliente fictício e entregador voluntário dentro do raio permitido, com GPS recente.
3. Autorizar no banco somente a dupla de IDs merchant_id/customer_user_id na tabela private.apois_test_cash_access, com enabled=true e prazo curto.
4. Gerar APK claramente HOMOLOGAÇÃO, pacote distinto, com flag de dinheiro teste e sem publicação pública. Nenhum APK foi gerado agora.
5. Fazer pedido cash/pending, verificar recebimento no painel, preparo, despacho, oferta, aceite, coleta, PIN e entrega.
6. Conferir no banco que não houve transações de carteira, pagamentos marcados paid ou repasses para o teste.
7. Desligar enabled e expirar a autorização após terminar. Não alterar o provider Safe2Pay de produção.

## Situação ao concluir
- Banco atual protegido e Edge v13 implantada.
- 18 verificações estáticas e checagem read-only do estado de produção concluídas.
- Zero autorizações ativas, zero pedidos cash, zero APKs criados, nenhum E2E físico ainda.
- Não há custo de novo projeto Supabase, mas o uso normal do plano atual (DB/APIs/Maps) continua sujeito a quotas e possível cobrança.