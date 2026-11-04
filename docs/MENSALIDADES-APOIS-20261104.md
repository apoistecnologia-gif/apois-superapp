# APOIS — Contrato comercial de mensalidades (04/11/2026)

## Valores atuais aprovados

| Perfil | Valor mensal | Centavos |
|---|---:|---:|
| Motorista de Corridas | **R$ 59,90** | 5990 |
| Estabelecimento de Entregas | **R$ 69,90** | 6990 |
| Entregador de Entregas | **R$ 49,90** | 4990 |

Fonte versionada: `config/apois-monthly-pricing.json`. Os três perfis têm políticas de assinatura distintas. Os valores de corrida, taxa de entrega e pagamento direto não mudaram por causa desta decisão. Não se admite liberação de operações por mero status textual `active`, `ativa` ou `teste` sem evidência de pagamento, nem criação de cobranças, saldos ou recibos fictícios.

## Corridas — motorista R$ 59,90

**Produção ainda não modificada:** a configuração `finance.driver_monthly_fee_cents` e duas constraints existentes ainda refletem a antiga mensalidade de 4990 centavos. Não há registros nas tabelas `driver_memberships` e `driver_membership_charges` na última leitura agregada, mas essa situação pode mudar.

A migração forward-only **não aplicada** `supabase/corridas-forward-migrations/20261104120000_driver_membership_monthly_5990_not_deployed.sql` transforma o default e as constraints para 5990 e atualiza a configuração, mas **recusa a execução** com `HISTORIC_DRIVER_FEE_REQUIRES_RECONCILIATION` se encontrar assinaturas/cobranças históricas com valor antigo. Nunca altera registros históricos de 4990 para fingir que foram pagos 5990. O script de construção da tela do motorista `scripts/harden-motorista-finance-boundary.mjs` passa a obter o valor da fonte comercial versionada, e não do antigo valor fornecido pelo submódulo.

A migração operacional Corridas `20260905162500_remove_retired_driver_subscription_gates.sql` **permanece bloqueada incondicionalmente** com `APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED` (SQLSTATE 55000), agora exigindo 5990 centavos. Antes de remover essa trava, implementar provider habilitado, idempotência/reconciliação, validade da mensalidade, estornos, KYC e testes que neguem operação sem pagamento vigente.

## Entregas — estabelecimento R$ 69,90

Valor preservado. O banco oficial já contém a chave `merchant_monthly_amount_cents=6990` e `merchant_subscriptions.amount` com default `69.90`. Nenhum provider de assinatura foi ativado por esta revisão. A constraint histórica `merchant_subscriptions.provider='mercadopago'` continua exigindo migração comercial independente se outro provedor for homologado.

## Entregas — entregador R$ 49,90

Não existia tabela específica de mensalidade de entregadores. Foi preparada a migração **não aplicada** `supabase/entregas-forward-migrations/20261104121000_courier_monthly_4990_contract_not_deployed.sql`, que cria duas tabelas protegidas por RLS (`courier_monthly_memberships` e `courier_monthly_charges`), com fee obrigatório 4990, SELECT do próprio entregador autenticado, nenhuma leitura anônima e escrita exclusiva do `service_role`.

A migração **proíbe expressamente** o estado de assinatura `active` e cobrança `received`, inclusive para o serviço, até uma futura migração homologada que inclua gateway, validação externa dos recibos e bloqueio das operações de entrega sem assinatura válida. Nenhum checkout, webhook, pagamento ou ativação foi criado. O modelo de repasse operacional `merchant_manual` não muda.

## Evidências e liberação

Os scripts `scripts/qa/verify-monthly-price-contract-v1.mjs` e `scripts/qa/verify-courier-monthly-contract-v1.mjs` fixam os valores. O runner `scripts/test-cash-postgres-isolated-v1.sh` aplica os SQLs staged a PostgreSQL 17 **totalmente descartável**, testa recusa de reprecificação histórica, os novos valores, RLS, recusas de escrita e ausência de ativação/Pix fictícios.

Verificações oficiais **somente de leitura**, em 04/11/2026:
- `database/review/20261104_corridas_driver_monthly_billing_READ_ONLY.sql`: 1/7 requisitos obrigatórios aprovados **contra a produção ainda antiga** (RLS existente). Não é um diagnóstico de regressão causado pelo commit; os novos preços não foram aplicados ao banco.
- `database/review/20261104_entregas_courier_monthly_4990_READ_ONLY.sql`: 1/6 requisitos obrigatórios aprovados **contra produção sem módulo de mensalidade do entregador**, sendo o aprovado o preço do estabelecimento de 6990. O gate do gateway permanece explicitamente bloqueado.
- [CI da atualização inicial de preços](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41768764743): 3/3 jobs aprovados.
- [CI da proteção complementar contra ativações fictícias](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41769072011): verificar resultado final antes de liberação.

**Ainda pendente:** homologação com esquema integral de ambos os Supabases e reais permissões JWT/RLS; integrar cobrança mensal por provedor aprovado; vincular pagamento confirmado às operações de motorista/entregador; atualização do site institucional, revisão completa de telas Android e APKs; rollout seguro após autorização. Não foi aplicado SQL em nenhum banco produtivo, nenhum submódulo foi alterado, não houve deploy nem cobrança.
