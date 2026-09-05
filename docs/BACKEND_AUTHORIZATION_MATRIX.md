# APOIS — Backend Authorization Matrix

Checkpoint de autorização para o release do Superapp. Esta matriz separa **ACTIVE no Supabase** de **usado pelo release atual**. Não substitui teste E2E/RLS A×B.

## Legenda

- **PUBLIC_RESOURCE** — recurso público deliberado, sem mutação privilegiada de recurso de usuário.
- **WEBHOOK** — entrada máquina-a-máquina; assinatura/segredo e replay protection precisam ser provados.
- **INTERNAL** — job/dispatcher interno autenticado por segredo de runtime.
- **AUTH_USER** — usuário Supabase autenticado; ator deve ser derivado do JWT/sessão.
- **DRIVER** — AUTH → `public.users.auth_user_id` → DOMAIN USER → `public.drivers.user_id` → DRIVER RECORD.
- **COURIER** — `auth.uid()` → courier atual; recursos precisam pertencer ao courier resolvido.
- **MERCHANT** — usuário autenticado + membership/ownership backend.
- **ADMIN** — usuário autenticado + role/permission backend.
- **LEGACY_DISABLED** — não pertence à jornada release atual; continuar implantado não o torna seguro.
- **REQUIRE E2E/RLS** — análise estática não prova isolamento A×B.

## Contagem observada em 2026-09-05

| Projeto | Edge Functions ACTIVE |
|---|---:|
| Corridas `vqtucstyduxrqjgyigfk` | **41** |
| Entregas `sbvhdgyuuperszlsllji` | **38** |
| Total | **79** |

## Corridas — todas as Edge Functions ACTIVE

| FUNCTION | RELEASE_USAGE | CLASS | AUTH | AUTHORIZATION / OWNERSHIP | SERVICE_ROLE | IDEMPOTENCY | STATUS / RISK |
|---|---|---|---|---|---|---|---|
| `passenger-profile` | ACTIVE_CURRENT | AUTH_USER | JWT | profile do ator; AUTH→DOMAIN | a confirmar no source completo | N/A/mutation-specific | current; REQUIRE E2E/RLS |
| `passenger-support` | ACTIVE_CURRENT | AUTH_USER | JWT | tickets do ator | a confirmar | RPC/id próprio | current; REQUIRE E2E/RLS |
| `delete-my-account` | ACTIVE_CURRENT | AUTH_USER | JWT | somente própria identidade | sim/administrativo | operação terminal | current; backend próprio obrigatório |
| `passenger-pricing-estimate` | ACTIVE_CURRENT | AUTH_USER | JWT | cálculo sem aceitar autoridade de user id do body | sim para tabelas de tarifa, conforme runtime | N/A | current |
| `cancel-ride` | ACTIVE_CURRENT | AUTH_USER | JWT | ride do passageiro DOMAIN atual | sim após auth | cancellation fee unique/retry | current; branch possui hardening adicional |
| `passenger-routes-compute` | ACTIVE_CURRENT | AUTH_USER | JWT | cálculo para ator autenticado | não crítico | N/A | current |
| `send-ride-push` | ACTIVE_CURRENT / INTERNAL-AWARE | AUTH_USER/INTERNAL | JWT/service context | evento deve ser compatível com ride e ator ou chamada interna | sim | push sem efeito financeiro | current; identity normalizer na branch |
| `passenger-ride-request` | LEGACY_DISABLED | AUTH_USER | JWT | histórico de pedido de corrida | sim | a confirmar | duplicata histórica; release usa `request-ride` |
| `create-cancellation-fee-charge` | LEGACY_DISABLED | AUTH_USER | JWT | cobrança histórica ligada à fee do passageiro | sim | provider-specific | **REQUIRE REVIEW / release blocker** |
| `cancellation-fee-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | evento provider precisa ser autenticado e correlacionado | sim | webhook receipt esperado | **PUBLICLY EXPOSED / release blocker** |
| `passenger-geocode-reverse` | ACTIVE_CURRENT | AUTH_USER | JWT | ator autenticado/quota | não crítico | quota | current |
| `asaas-create-driver-membership` | LEGACY_DISABLED | DRIVER | JWT | deriva driver autenticado, mas ainda cria provider state | sim | provider keys | **DANGEROUSLY_CALLABLE** |
| `asaas-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura provider precisa ser provada | sim | event id esperado | **PUBLICLY EXPOSED / release blocker** |
| `asaas-create-driver-subaccount` | LEGACY_DISABLED | DRIVER | JWT | driver próprio, porém provisiona subconta/credencial provider | sim | provider-specific | **DANGEROUSLY_CALLABLE** |
| `asaas-create-ride-pix` | LEGACY_DISABLED | AUTH_USER | JWT | ride owner, porém cria cobrança e altera estado financeiro | sim | charge/provider id | **DANGEROUSLY_CALLABLE** |
| `request-driver-payout` | LEGACY_DISABLED | LEGACY_DISABLED | JWT | não chega a payout | não antes do retorno | N/A | **SAFE_DISABLED: HTTP 410** |
| `account-deletion-request` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | verify_jwt=false | solicitação genérica; não apaga conta diretamente | conforme implementação | dedupe operacional | público deliberado; anti-enumeração obrigatório |
| `privacy-policy` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | público | sem recurso privado | não | N/A | safe public resource |
| `finance-oneoff-cancel-orphan-asaas-pix` | LEGACY_DISABLED | ADMIN/INTERNAL | JWT | one-off financeiro histórico | sim | a confirmar | **REQUIRE REVIEW / release blocker** |
| `dispatch-ride` | ACTIVE_CURRENT | INTERNAL/AUTH_USER | JWT | ride/dispatch conforme ator e estado | sim | CAS/state | current; branch hardening deve ser runtime-compatible |
| `driver-cancel-redispatch` | ACTIVE_CURRENT | DRIVER | JWT | ride do driver atual | sim | state transition | current; REQUIRE E2E A×B |
| `driver-reject-redispatch` | ACTIVE_CURRENT | DRIVER | JWT | offer/ride do driver atual | sim | reject/state | current; REQUIRE E2E A×B |
| `admin-driver-operational-status` | ACTIVE_CURRENT | ADMIN | JWT | role ADMIN no backend | sim | mutation-specific | current; non-admin must DENY |
| `driver-finish-redispatch` | ACTIVE_CURRENT | DRIVER | JWT | finish só do driver atual; settlement server-side | sim | finish/credit idempotency | current; REQUIRE E2E |
| `pagbank-connect-callback` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | OAuth state/callback provider | sim | state nonce required | **PUBLICLY EXPOSED / release blocker** |
| `pagbank-apois-logo` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | público | asset/branding | não | N/A | safe if strictly static resource |
| `activate-scheduled-rides` | ACTIVE_CURRENT | INTERNAL | verify_jwt=false | cron/runtime-secret contract obrigatório | sim | scheduled-state CAS | current; secret path REQUIRE REVIEW |
| `request-ride` | ACTIVE_CURRENT | AUTH_USER | JWT→DOMAIN | passenger derivado de `users.auth_user_id`; request key + own active ride | sim após auth | request key / active ride | **CODE FIXED / RUNTIME OLD**: runtime ainda engole dispatch failure e mantém subscription gate antigo |
| `pagbank-create-ride-pix` | LEGACY_DISABLED | AUTH_USER | JWT | ride owner, mas cria cobrança provider | sim | provider id | **DANGEROUSLY_CALLABLE** |
| `pagbank-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | provider signature/replay obrigatório | sim | event id esperado | **PUBLICLY EXPOSED / release blocker** |
| `ride-pix-checkout` | LEGACY_DISABLED | AUTH_USER | JWT | ride owner, mas roteia para provider financeiro | sim | provider-specific | **DANGEROUSLY_CALLABLE** |
| `mercadopago-oauth-start` | LEGACY_DISABLED | AUTH_USER/DRIVER | JWT | ator próprio, mas inicia provider OAuth | sim | state nonce | **AUTHENTICATED_BUT_LEGACY** |
| `mercadopago-oauth-callback` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | OAuth state obrigatório | sim | state nonce | **PUBLICLY EXPOSED / release blocker** |
| `mercadopago-create-ride-pix` | LEGACY_DISABLED | AUTH_USER | JWT | ride owner; cria cobrança provider | sim | provider-specific | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `mercadopago-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay obrigatório | sim | webhook receipts | **PUBLICLY EXPOSED / blocker** |
| `mercadopago-create-driver-membership` | LEGACY_DISABLED | DRIVER | JWT | driver próprio, mas cria membership provider | sim | provider-specific | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `mercadopago-membership-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay obrigatório | sim | event id | **PUBLICLY EXPOSED / blocker** |
| `passenger-ride-request-mercadopago` | LEGACY_DISABLED | AUTH_USER | JWT | passageiro próprio, provider-specific | sim | request/provider | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `driver-membership-checkout` | LEGACY_DISABLED | DRIVER | JWT | driver próprio, provider-oriented membership | sim | provider-specific | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `mercadopago-driver-status` | LEGACY_DISABLED | DRIVER | JWT | driver próprio, provider-specific | sim | read/sync | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `public-ride-tracker` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | verify_jwt=false + capability token | somente ride vinculada a token não enumerável | sim/read-only conforme runtime | token capability | current public surface; ride_id sozinho não pode autorizar |

## Entregas — todas as Edge Functions ACTIVE

| FUNCTION | RELEASE_USAGE | CLASS | AUTH | AUTHORIZATION / OWNERSHIP | SERVICE_ROLE | IDEMPOTENCY | STATUS / RISK |
|---|---|---|---|---|---|---|---|
| `create-order` | ACTIVE_CURRENT | AUTH_USER | JWT via `auth.getUser(token)` | customer vem de `userData.user.id`; endereço `user_id` próprio; RPC recebe customer derivado | sim após auth | request/checkout intent | **runtime ainda Pix; release integration cash => DRIFT** |
| `customer-orders` | ACTIVE_CURRENT | AUTH_USER | JWT | list/detail por `customer_user_id=authData.user.id`; mutations via authenticated RPC | sim para leitura hidratada | RPC/state | static ownership PASS; E2E A×B pendente |
| `create-pix-charge` | LEGACY_DISABLED | AUTH_USER | JWT | provider setting atualmente impede OpenPix | sim | provider charge | **runtime-setting disabled, sem product guard permanente; blocker** |
| `openpix-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay provider obrigatório | sim | provider event | **PUBLICLY EXPOSED / blocker** |
| `customer-favorites` | ACTIVE_CURRENT | AUTH_USER | JWT | `customer_user_id=authData.user.id` | sim para lookup | unique pair/state | current |
| `customer-notifications` | ACTIVE_CURRENT | AUTH_USER | JWT | `user_id=authData.user.id` | sim conforme source | state | current |
| `customer-support` | ACTIVE_CURRENT | AUTH_USER | JWT | requester do ator; attachments no prefixo ator/ticket; RPC authenticated | não privilegiado para mutation | RPC/message | current; E2E cross-ticket pendente |
| `mercadopago-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay obrigatório | sim | event id | **PUBLICLY EXPOSED / blocker** |
| `process-refund` | LEGACY_DISABLED | AUTH_USER/ADMIN | JWT | histórico de refund provider | sim | refund idempotency | **AUTHENTICATED_BUT_LEGACY / blocker** |
| `mercadopago-credential-diagnostic` | LEGACY_DISABLED | ADMIN/DIAGNOSTIC | JWT | diagnóstico provider | sim | N/A | **legacy diagnostic / blocker** |
| `apois-refund-homol-8-7c2f` | LEGACY_DISABLED | AUTH_USER/TEST | JWT | homologação refund | sim | provider-specific | **homologation endpoint ACTIVE / blocker** |
| `sync-payment-status` | LEGACY_DISABLED | AUTH_USER/INTERNAL | JWT | provider payment sync | sim | provider status | **legacy / blocker** |
| `apois-pix-auto-homol-8f4c3e9a` | LEGACY_DISABLED | AUTH_USER/TEST | JWT | homologação Pix | sim | provider-specific | **homologation endpoint ACTIVE / blocker** |
| `merchant-subscription` | LEGACY_DISABLED | MERCHANT | JWT | active membership derivada server-side, mas cria Mercado Pago PIX mensal | sim | subscription/provider payment | **DANGEROUSLY_CALLABLE** |
| `mercadopago-subscription-selftest` | LEGACY_DISABLED | ADMIN/TEST | JWT | provider selftest | sim | N/A | **test endpoint ACTIVE / blocker** |
| `mercadopago-subscription-e2e-test` | LEGACY_DISABLED | ADMIN/TEST | JWT | provider E2E endpoint | sim | N/A | **test endpoint ACTIVE / blocker** |
| `mercadopago-subscription-stage-probe` | LEGACY_DISABLED | ADMIN/TEST | JWT | provider probe | sim | N/A | **test endpoint ACTIVE / blocker** |
| `mercadopago-monthly-pix-probe` | LEGACY_DISABLED | ADMIN/TEST | JWT | provider Pix probe | sim | N/A | **test endpoint ACTIVE / blocker** |
| `merchant-monthly-webhook-selftest` | LEGACY_DISABLED | ADMIN/TEST | JWT | webhook selftest | sim | N/A | **test endpoint ACTIVE / blocker** |
| `asaas-merchant-account` | LEGACY_DISABLED | MERCHANT | JWT | merchant membership/owner esperado | sim | provider account | **legacy / blocker** |
| `create-asaas-pix-charge` | LEGACY_DISABLED | AUTH_USER/MERCHANT | JWT | resource ownership esperado | sim | provider charge | **legacy / blocker** |
| `asaas-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay obrigatório | sim | event id | **PUBLICLY EXPOSED / blocker** |
| `asaas-payout` | LEGACY_DISABLED | LEGACY_DISABLED | JWT | retorna antes de provider work | não antes do retorno | N/A | **SAFE_DISABLED: HTTP 410 ASAAS_RETIRED** |
| `confirm-asaas-sandbox-payment` | LEGACY_DISABLED | ADMIN/TEST | JWT | sandbox payment | sim | test-provider | **sandbox endpoint ACTIVE / blocker** |
| `openpix-sandbox-selftest` | LEGACY_DISABLED | ADMIN/TEST | JWT | sandbox selftest | sim | N/A | **sandbox endpoint ACTIVE / blocker** |
| `openpix-payout` | LEGACY_DISABLED | MERCHANT/INTERNAL | JWT | atualmente bloqueado porque provider setting != openpix | sim | payout attempt | **runtime-setting disabled; callable if setting changes; blocker** |
| `dispatch-push-outbox` | ACTIVE_CURRENT | INTERNAL | runtime key (`x-apois-push-dispatch-key`) | `verify_push_dispatch_runtime_key` antes de claim/process | sim | outbox claim/retry | static ordering PASS; no queue work before authorization |
| `google-maps-address` | ACTIVE_CURRENT | AUTH_USER | JWT | quota pelo ator autenticado | não crítico | quota | current |
| `account-deletion` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | verify_jwt=false | somente registra `external_account_deletion_requests`, resposta anti-enumeração | sim para fila | dedupe temporal | não apaga auth/profile diretamente |
| `privacy-policy` | PUBLIC_RESOURCE | PUBLIC_RESOURCE | público | sem dado privado | não | N/A | safe public resource |
| `merchant-mercadopago-oauth` | LEGACY_DISABLED | MERCHANT | JWT | owner/manager validado, mas conecta/refresh/disconnect provider | sim | OAuth state/account | **DANGEROUSLY_CALLABLE** |
| `merchant-mercadopago-callback` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | OAuth state obrigatório | sim | OAuth state | **PUBLICLY EXPOSED / blocker** |
| `create-merchant-mercadopago-pix` | LEGACY_DISABLED | AUTH_USER/MERCHANT | JWT | order/customer/merchant checks, mas cria cobrança provider | sim | provider charge | **DANGEROUSLY_CALLABLE** |
| `merchant-mercadopago-webhook` | LEGACY_DISABLED | WEBHOOK | verify_jwt=false | assinatura/replay obrigatório | sim | event id | **PUBLICLY EXPOSED / blocker** |
| `merchant-payment-readiness` | LEGACY_DISABLED | MERCHANT | JWT | provider-specific readiness | sim/read | N/A | **legacy / blocker** |
| `process-superapp-refund` | LEGACY_DISABLED | ADMIN/MERCHANT historical | JWT | actor histórico autorizado, mas executa refund provider e muta order/payment | sim | refund/provider id | **DANGEROUSLY_CALLABLE** |
| `temp-mp-token-key-check` | LEGACY_DISABLED | ADMIN/DIAGNOSTIC | JWT | credential diagnostic | sim | N/A | **temporary endpoint ACTIVE / blocker** |
| `mercadopago-payout` | LEGACY_DISABLED | ADMIN/INTERNAL | runtime HMAC + admin | exige mode `mercadopago_connect` + enable flag; runtime atual `merchant_manual` | sim | idempotency | **SAFE_DISABLED_BY_RUNTIME_SETTING** no estado observado |

Detalhes de provider/runtime ficam versionados também em `docs/legacy-provider-runtime-state.json`; o gate de release falha enquanto houver endpoint legado classificado como release-blocking.

## SECURITY DEFINER — invariantes verificadas no runtime

### Corridas

- Funções administrativas privadas usam `SET search_path` fixo e `auth.uid()` + `private.has_permission(...)`; wrappers públicos delegam para a implementação que valida permissão.
- `driver_update_document` resolve AUTH→DOMAIN→DRIVER. A forward migration 14:30 adiciona slot/MIME/filename/10 MiB e policies mais estritas; runtime ainda é a versão anterior.
- `driver_confirm_cash_payment`, leitura de settlement e lifecycle de driver escopam pelo driver atual.
- Funções de marcação/reversão de withdrawal/pagamento de serviço verificadas como `service_role`-only onde aplicável.
- Existem predicates antigos de subscription no runtime (`driver_subscription_allows_rides` e caminhos associados); isto mantém drift com a decisão de mensalidade eletrônica desativada.

### Entregas

- `current_user_is_admin()` = conta ativa + role admin backend.
- Família `admin_*` inspecionada usa `current_user_is_admin()` antes da mutação e `SET search_path=''`.
- `current_user_is_merchant_member/manager/owner` deriva membership de `auth.uid()`.
- `current_user_courier_id()` deriva courier do `auth.uid()` e profile ativo.
- `customer_cancel_order` e `submit_order_review` combinam `_order_id` com `customer_user_id=auth.uid()`.
- `merchant_transition_order`, `merchant_request_courier` e `merchant_reject_order` resolvem merchant a partir do order e exigem membership/admin.
- `courier_transition_delivery` e route/location RPCs exigem courier atual e job atribuído.
- `courier_confirm_courier_settlement` runtime nega courier B sobre settlement A, mas retry após confirmação ainda falha. Forward migration `20260905114500...` torna retry do mesmo courier idempotente sem remover ownership.
- `close_courier_settlements` só agrega jobs `delivered` e exige manager/admin; confirmação de pagamento é etapa separada.
- `admin_settle_payout` ainda existe historicamente e é admin-only; provider/payout legado continua fora do release atual.

## Casos de autorização obrigatórios

| Caso | Esperado | Evidência atual |
|---|---|---|
| USER A → profile/wallet de USER B | DENY | static/RLS test pendente |
| PASSENGER A → ride de PASSENGER B | DENY | static ownership; E2E pendente |
| DRIVER A → ride/document/wallet de DRIVER B | DENY | static/RPC/storage; E2E pendente |
| MERCHANT A → order/private data de MERCHANT B | DENY | static RPC/membership; E2E pendente |
| COURIER A → delivery/settlement de COURIER B | DENY | static RPC; E2E pendente |
| NON-ADMIN → `admin_*` | DENY | runtime SECURITY DEFINER inspection; E2E pendente |
| replay settlement do mesmo courier | IDEMPOTENT | **CODE FIXED in forward migration; runtime old** |

## Regra de evidência

- **CODE FIXED** não significa **BUILD VALIDATED**.
- **BUILD VALIDATED** não significa **RUNTIME DEPLOYED**.
- **RUNTIME DEPLOYED** não significa **E2E VALIDATED**.
- Um endpoint `LEGACY_DISABLED` que continua publicamente alcançável pode continuar sendo **release blocker**.
