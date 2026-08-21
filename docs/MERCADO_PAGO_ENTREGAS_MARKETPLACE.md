# APOIS Entregas — Mercado Pago Marketplace

## Regra comercial

A APOIS Entregas não cobra comissão percentual por pedido. A monetização do estabelecimento é a mensalidade de R$ 69,90 por mês.

## Disponível agora

- Aplicação APOIS ENTREGAS operando com sellers vinculados por OAuth.
- Authorization Code no backend, com `state` de uso único e PKCE.
- `client_secret`, service role e tokens nunca são enviados ao frontend.
- Access/refresh tokens ficam criptografados no backend com AES-GCM.
- O seller Mercado Pago é relacionado ao `merchant_id` da APOIS.
- O status da conexão é consultado pelo serviço `merchant-mercadopago-oauth`.
- Renovação usa `refresh_token`; o fluxo solicita `scope=offline_access` conforme documentação oficial do Mercado Pago.
- Desconexão/revogação apaga os tokens criptografados e preserva somente metadados não sensíveis e status operacional.
- Pagamentos 1:1 compatíveis podem ser criados diretamente na conta Mercado Pago do estabelecimento; a APOIS não deve custodiar o total do pedido.

## Dependência externa — NÃO IMPLEMENTAR COMO SIMULAÇÃO

O Mercado Pago informou oficialmente à APOIS que o modelo público padrão de Marketplace trabalha com um seller por pagamento + marketplace. A divisão 1:N, com múltiplos recebedores independentes em uma única cobrança, depende de habilitação comercial/carteira assessorada.

O objetivo futuro do APOIS Entregas é:

- produtos → estabelecimento;
- taxa de entrega → entregador;
- comissão por pedido APOIS → R$ 0,00.

Uma cobrança única com estabelecimento + entregador NÃO deve ser ativada até o Mercado Pago habilitar comercialmente o Split 1:N para a aplicação APOIS ENTREGAS.

O estado de produção é registrado em `platform_settings.mercadopago_split_1n_mode = commercial_enablement_pending`.

Enquanto esse estado permanecer pendente:

1. não inventar Split 1:N com APIs não disponibilizadas;
2. não fazer a APOIS receber o total para depois redistribuir;
3. não expor ao cliente um fluxo de entrega que dependa de repasse ao entregador ainda não homologado;
4. manter o fluxo financeiro do entregador sob bloqueio seguro até a habilitação comercial.

## Configuração segura necessária no Supabase

Secrets do backend:

- `MERCADO_PAGO_OAUTH_CLIENT_ID`
- `MERCADO_PAGO_OAUTH_CLIENT_SECRET`
- `MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64`
- `MERCADO_PAGO_MERCHANT_REDIRECT_URI`
- `MERCADO_PAGO_MERCHANT_WEBHOOK_SECRET`

O `MERCADO_PAGO_MERCHANT_REDIRECT_URI` deve ser HTTPS, estático e cadastrado na aplicação correta do Mercado Pago.

Nenhum desses valores deve ser colocado em `VITE_*`, no bundle Android ou em código frontend.
