# APOIS Brasil — Corridas Only + Mensalidade Pix R$ 99,90

**Status:** implementação e homologação parcial; NÃO LIBERADO PARA PRODUÇÃO.
**CNPJ:** 68.290.710/0001-37.
**Data da vistoria:** 23/11/2026.
**Branch:** `feature/apois-corridas-only-mensalidade-9990-20261123`
**Ponto de recuperação imutado:** `checkpoint/apois-parceiro-qa290-acumulado-20261123` (commit `6b0d31dcad5be9b7c7b9a8c651deeca98104b65f`).

## Repositórios / fonte travada

- Principal: `apoistecnologia-gif/apois-superapp`.
- Cliente: `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf`, pin `7b047f75a1a919a5336c0df6e0d60b14b02f2618`.
- Motorista: `apoistecnologia-gif/movvi-go-connect`, pin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- Entregas preservado: `apoistecnologia-gif/apois-entregas`, pin `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- Banco Corridas: Supabase `tbbzkrfupmqdywnzgnms`. Banco Entregas: `ptgkwyyolrdgnqketkjj` — **SEM ALTERAÇÕES**.

## Implementações já commitadas — isoladas da produção

- `config/apois-launch-mode.mjs` centraliza `APOIS_LAUNCH_MODE=corridas_only`.
- `superapp/shell/corridas-only.html` inicializa diretamente Corridas e conserva callbacks Google/reset.
- `superapp/shell/build.mjs` permite somente `modules/corridas` no build exclusivo, preserva full-mode para reativação posterior.
- `superapp/partner-shell/corridas-only.html` inicia Motorista e ignora deep links/notificações de Entregas.
- `superapp/partner-shell/build.mjs` exclui o pacote web Entregador e preserva `full` reversível.
- `scripts/build-partner-release.sh` evita compilar Entregador no modo exclusivo.
- `scripts/strip-generated-courier-native-v1.mjs` remove serviço/plugin Entregador **apenas do Android gerado em .work**, mantendo os scripts Java originais.
- `scripts/qa/test-corridas-only-launch-v1.test.mjs` comprova política, callbacks, source locks e os módulos empacotados.
- Workflows isolados Cliente/Motorista QA no GitHub, mantendo IDs Android e assinatura original; ficaram com acionamento manual para evitar desperdício de minutos de CI.
- Tela de assinatura Motorista com nova oferta de R$99,90 **sem habilitar gateway**, preservando contratos existentes.

## Financeiro Pix — desenvolvimento offline, ainda NÃO ativo

- `supabase/functions/_shared/apois-driver-membership-pix-v2.mjs`: adaptadores server-only de Asaas e Mercado Pago para QR dinâmico de R$99,90; idempotência de requisição, recibo e comparação com o pagamento bancário.
- `scripts/qa/test-driver-membership-pix-v2.test.mjs`: testes por mock, sem internet nem geração de cobrança real.
- `supabase/corridas-forward-migrations/20261123_driver_9990_pix_STAGE_ONLY_NOT_APPLIED.sql`: configuração R$99,90, restrições que preservam R$49,90/R$59,90 históricos, identificação do provedor por cobrança. **NÃO APLICADA**.
- `supabase/corridas-forward-migrations/20261123_driver_9990_entitlement_settlement_STAGE_ONLY_NOT_APPLIED.sql`: gate backend (ONLINE/aceite) condicionado ao plano válido, transação atômica após comprovação bancária, bloqueio de novo aceite sem mensalidade e preservação de viagem em andamento. **NÃO APLICADA**.
- Controle backend `finance.driver_membership_pix_enabled` fica **false** até homologação, credenciais e autorização expressa.
- Gateway legado `asaas-create-driver-membership`, `driver-membership-checkout` e demais endpoints antigos seguem aposentados. Nenhum endpoint foi reativado.
- NÃO há split, comissão sobre corridas, Pix Out, cobrança real ou alteração de dinheiro de corridas.

## Evidências / ambiente inspecionado

- Motorista QA290, com correções de GPS/entrada/aceite, foi conservado como baseline.
- Cliente Corridas-only passou pelo build web e teste de exclusão do diretório Entregas em GitHub Actions.
- Corridas Supabase: parâmetro atual do banco `finance.driver_monthly_fee_cents=5990`, mas restrições antigas só aceitam 4990; ambas as tabelas de assinatura/cobrança estavam vazias na inspeção.
- Migração de valor foi preparada, NÃO executada.
- Workflows Android identificaram verificadores legados que exigiam Entregas / seletor e foram adaptados ou isolados. **Não afirmar APK aprovado até GitHub Actions verde + teste físico.**

## Asaas x Mercado Pago — dados externos confirmados em 23/11/2026

**Asaas:** Pix de cobrança dinâmica via `POST /v3/payments` com `billingType=PIX` e QR via `GET /v3/payments/{id}/pixQrCode`; webhook `asaas-access-token`; precificação efetiva depende da conta.
Docs: https://docs.asaas.com/docs/cobrancas-via-pix ; https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook ; https://central.ajuda.asaas.com/hc/pt-br/articles/32040230167067-Quais-s%C3%A3o-as-taxas-para-receber-via-Pix

**Mercado Pago:** API Pix via `POST /v1/payments`, `payment_method_id=pix`; webhooks HMAC SHA256 `x-signature` + consulta bancária `GET /v1/payments/{id}`; taxa real contratada não acessível por documentação pública.
Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix ; https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications

**Comparação financeira:** impossível confirmar custo exato sem condições contratuais exibidas na conta empresária. Não escolher com base em promoção, nem contratar recursos pagos sem autorização.

## Bloqueadores antes do lançamento

1. CI dos **dois novos APKs** com resultados integralmente verdes, inspeção real do APK assinado e validação em dois celulares.
2. Homologação das regras de lançamento sem referências acessíveis a Entregas e testes de deep links de versões antigas.
3. Autorização para aplicar migrations financeiras em Supabase Corridas e revisão de RLS, KYC, nova elegibilidade e privilégios.
4. Credenciais/sandbox operacional do Asaas ou Mercado Pago e taxas reais da conta empresarial para selecionar um único provedor de novas cobranças.
5. Fluxo completo do webhook assinado -> consulta bancária -> idempotência de cobrança -> atualização da assinatura, incluindo estorno, duplicidade e reconciliação em homologação.
6. Integração do checkout com a tela do Motorista, status, QR, Pix Copia e Cola, renovação, histórico; sem bloquear histórico ou corridas já em andamento.
7. No backend de Entregas, bloquear novas operações públicas durante isolamento via feature gate **somente com autorização de produção**, pois não se deve mexer no banco Entregas nesta branch.
8. Revisão de riscos do pagamento direto por Pix ao motorista sem confirmação bancária da APOIS; dinheiro direto permanece o fluxo mais simples.
9. Homologação final de Android Cliente, Motorista, histórico, Google OAuth, GPS, push, áudio de chamada, preço, navegação, RLS, disponibilidade, escalabilidade e custo de mapas.

Não efetuar merge, deploy, SQL de produção, ativação de gateway ou mudança nas contas sem aprovação.
