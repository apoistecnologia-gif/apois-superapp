# Safe2Pay cutover runbook

Este runbook é o procedimento de produção. Ele não autoriza deploy-all.

## Pré-condições

1. Os dois projetos Supabase precisam estar ACTIVE:
   - Corridas: `tbbzkrfupmqdywnzgnms`
   - Entregas: `ptgkwyyolrdgnqketkjj`
2. A pendência financeira da organização Supabase precisa estar regularizada.
3. `SAFE2PAY_PIX_FEE_PAYER` precisa ter decisão explícita: `receiver` ou `platform`.
4. Credenciais Safe2Pay e callback HTTPS precisam estar configurados somente como secrets backend.

## Ordem obrigatória

1. Restaurar e confirmar saúde dos dois projetos Supabase.
2. Tirar novo snapshot das Edge Functions e comparar com `docs/provider-runtime-observed-20260921.json`.
3. Aplicar, por projeto, apenas as forward migrations Safe2Pay aprovadas.
4. Neutralizar os 50 runtimes financeiros legados usando `docs/legacy-provider-failclosed-deploy-manifest.json`, um slug por vez, preservando o `verify_jwt` observado.
5. Confirmar que cada endpoint legado responde fail-closed/HTTP 410 e não altera banco.
6. Configurar secrets Safe2Pay.
7. Implantar por slug explícito:
   - Corridas: `safe2pay-subaccount-onboarding`, `safe2pay-subaccount-reconcile`, `safe2pay-create-ride-pix`, `safe2pay-payment-status`, `safe2pay-webhook`.
   - Entregas: `safe2pay-subaccount-onboarding`, `safe2pay-subaccount-reconcile`, `safe2pay-create-order-pix`, `safe2pay-payment-status`, `safe2pay-webhook`.
8. Configurar `SAFE2PAY_ONBOARDING_PRODUCT=rides|orders` e `SAFE2PAY_WEBHOOK_PRODUCT=rides|orders` em cada projeto.
9. Criar/conciliar receivers reais de teste administrativo.
10. Executar Pix real controlado de baixo valor, porque Pix Safe2Pay não usa sandbox.
11. Confirmar webhook idempotente, status autorizado, ledger e avanço da corrida/pedido.
12. Somente após o teste:
    - `SAFE2PAY_PROVIDER_ENABLED=1`;
    - `finance.ride_electronic_payments_enabled=true` em Corridas;
    - provider eletrônico de Entregas liberado;
    - build do passageiro com `APOIS_SAFE2PAY_PIX_ENABLED=1`.
13. Executar E2E físico completo antes da publicação.

## Rollback

Se qualquer etapa Safe2Pay falhar antes da ativação, manter `SAFE2PAY_PROVIDER_ENABLED=0` e o Pix oculto no app. Não reativar Mercado Pago, Asaas, PagBank ou OpenPix como fallback.

Depois da ativação, rollback de aplicação deve desligar primeiro o feature flag eletrônico, preservando ledger e webhooks para reconciliação de transações já criadas.
