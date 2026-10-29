# APOIS — PIX simulado, sem movimentação financeira

**Escopo:** homologar Corridas e Entregas sem Pix real. A Safe2Pay declara que não disponibiliza Sandbox para transações Pix: https://developers.safe2pay.com.br/reference/cobranca-criar

## Estado verificado em 29/10/2026
- Supabase Corridas produção: tbbzkrfupmqdywnzgnms
- Supabase Entregas produção: ptgkwyyolrdgnqketkjj
- Nenhum projeto ou branch Supabase de homologação foi localizado.
- Corridas: finance.ride_electronic_payments_enabled=false; provedor alvo safe2pay. O PIX cadastrado como método ativo não torna o gateway disponível ao cliente.
- Entregas: checkout Android consolidado usa pagamento direto cash/pending, sem Pix eletrônico ativo. Açaí no Grau tem assinatura vencida e não está pronto para pagamento Safe2Pay.
- Entregador online verificado estava a 249,9 km da loja, além do raio de 20 km.

## Teste executado nesta branch
Rode: node scripts/verify-apois-pix-isolated-homologation.mjs

São nove testes DE CONTRATO EM MEMÓRIA: Pix fictício sem QR pagável, pagamento pendente, confirmação simulada, reenvio idempotente, rejeição de origem falsa, valor divergente, mensalidade vencida, distância e etapas de corrida/pedido.

**Não é um teste E2E com os aplicativos reais nem com banco de homologação**. Não valida que os frontends ou Edge Functions implantadas estão funcionando, nem usa a API da Safe2Pay.

## Pré-requisitos para homologação física sem dinheiro
1. Criar projetos/branches Supabase separados de homologação Corridas e Entregas. Há potencial custo; exigir autorização antes de provisionar.
2. Aplicar migrações canônicas e popular apenas usuários, loja, motorista e entregador TEST-* fictícios em mesma região. Nunca copiar dados pessoais.
3. Usar provider FakePix apenas no backend de staging, jamais no app nem na produção, com autenticação administrativa, audit log, confirmação de cobrança vinculada, valor exato e idempotência.
4. Bloquear definitivamente o simulador quando URL ou project ref forem de produção; não gerar Pix copia-e-cola pagável nem chamar a Safe2Pay.
5. Gerar APKs distintos de homologação apontando explicitamente para staging e mostrando PAGAMENTO SIMULADO. Não reutilizar APK atual contra produção.
6. Corridas: solicitar → cobrança Pix simulada pendente → evento administrativo autorizado → pago no staging → despacho → motorista recebe → aceite → PIN → trajeto → finalização → ledger virtual e recibo.
7. Entregas: carrinho → cobrança Pix simulada pendente → evento administrativo autorizado → pedido pago no staging → loja recebe/prepara → solicita entregador → push/oferta → aceite → coleta → entrega → ledger virtual e recibo.
8. Testes negativos: callback falso, duplicado, fora do valor, atraso, falta GPS, fora do raio, assinatura vencida, bloqueio do motorista, cancelamento, timeout e app em segundo plano.

## Regras de não regressão
- Proibido atualizar rides/orders.payment_status, saldo, mensalidade ou ledger de produção artificialmente.
- Proibido afrouxar RLS, alterar radius global de produção ou ligar o gateway real para testes fictícios.
- Somente ambiente TEST comprovado pode registrar payment_provider=mock_pix; nem o servidor de staging deve ter chave Safe2Pay de produção.
- Não executar migrações destrutivas em produção.
- Não gerar APK nesta etapa.

## Entregável
O runner offline verifica 9 cenários por chamada em memória, sem acesso a banco nem rede. Não substitui teste físico de ponta a ponta.
