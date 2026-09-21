# Safe2Pay — arquitetura financeira oficial do APOIS

Decisão registrada em 2026-09-21: **Safe2Pay Marketplace** passa a ser o provedor eletrônico alvo do APOIS. Mercado Pago, Asaas, PagBank e OpenPix permanecem aposentados e devem continuar fail-closed.

## Evidência comercial contratada

A proposta da Safe2Pay para a APOIS prevê Marketplace com subcontas e splits ilimitados, split entre múltiplas contas, subcontas sem mensalidade própria, mensalidade do plano de R$ 419, Pix com tarifa comercial apresentada de R$ 0,50 por transação recebida e repasse D+1. Repasse diário possui tarifa comercial de R$ 2,99; semanal/mensal foi ofertado como gratuito.

Esses valores são evidência comercial, não constantes de código. O runtime deve usar configuração/contrato vigente e nunca hardcode de tarifa.

## Contrato técnico verificado

- autenticação server-to-server: `X-API-KEY`;
- criação de cobrança: `POST https://payment.safe2pay.com.br/v2/payment`;
- subconta Marketplace: `POST https://api.safe2pay.com.br/v2/marketplace/add`;
- cobrança pode carregar `Splits[]`;
- split dinâmico suporta múltiplos recebedores;
- `IdReceiver` identifica a subconta recebedora;
- `CodeTaxType`: percentual ou valor fixo;
- `Amount`: valor do split;
- `IsPayTax`: define responsabilidade da tarifa no recebedor;
- webhooks transacionais são usados para confirmar mudança de status;
- status autorizado é código `3`;
- o backend deve tratar webhook de forma idempotente e nunca confiar no frontend para marcar pagamento como confirmado.

## Corridas

Pagamento eletrônico alvo: **Pix Safe2Pay**.

Modelo financeiro atual:
- motorista recebe o valor da corrida via subconta Safe2Pay;
- comissão APOIS por corrida = **R$ 0 / 0%**;
- dinheiro e cartão direto ao motorista continuam fora da custódia da APOIS;
- a mensalidade do motorista é domínio financeiro separado da corrida;
- `ride_settlement`, ledger/carteira e idempotência continuam sendo a fonte interna de conciliação, mesmo que o repasse seja feito pelo provider.

A ativação do Pix fica bloqueada até existir receiver Safe2Pay válido para o motorista, cobrança sandbox com split, webhook autorizado e teste E2E.

## Entregas

Pagamento eletrônico alvo: **Pix Safe2Pay Marketplace com split 1:N**.

Modelo:
- produto/itens → subconta do estabelecimento;
- taxa de entrega → subconta do entregador;
- APOIS → R$ 0 de comissão sobre o pedido neste modelo;
- a soma dos splits deve ser exatamente igual ao valor da cobrança;
- pedido não pode virar `paid` antes do webhook Safe2Pay validado.

## Regra de tarifa

A Safe2Pay separa “quem recebe quanto” de “quem paga a tarifa”. Portanto, `SAFE2PAY_PIX_FEE_PAYER` é decisão comercial obrigatória e aceita somente:
- `receiver`; ou
- `platform`.

Enquanto não houver decisão explícita, produção deve falhar fechado. Não inferir automaticamente.

## Segurança

A API key Safe2Pay nunca entra em Vite, Android, logs ou resposta ao cliente. O frontend chama apenas o backend APOIS. O backend cria a cobrança, grava referência/idempotency key, envia o split e processa webhook.

Tokens de subconta retornados na criação são segredo: nunca retornar ao app. Receiver IDs podem ser persistidos como metadados operacionais; tokens/chaves exigem armazenamento secreto apropriado.

## Migração

1. manter Mercado Pago/Asaas/PagBank/OpenPix bloqueados;
2. criar mapping Safe2Pay de motorista/estabelecimento/entregador → subconta/receiver;
3. integrar criação de subconta server-side;
4. integrar cobrança Pix com split;
5. integrar webhook + dedupe;
6. reconciliar settlement/ledger;
7. executar sandbox E2E;
8. somente então habilitar `SAFE2PAY_PROVIDER_ENABLED=1`;
9. executar E2E físico antes de produção.

Nenhum endpoint legado deve ser reativado para servir como “ponte” para Safe2Pay.
