# APOIS — Backend Authorization Matrix

Checkpoint de segurança do Superapp. Esta matriz documenta **quem autoriza o chamador no backend** antes de operações privilegiadas. Ela não substitui testes E2E/RLS multiusuário.

## Legenda

- **PUBLIC_RESOURCE**: leitura pública deliberada, sem recurso privado do usuário.
- **WEBHOOK**: entrada máquina-a-máquina autenticada por segredo/assinatura.
- **INTERNAL**: chamada interna autenticada por segredo de serviço.
- **AUTH_USER**: usuário Supabase autenticado; ownership deve ser derivado da sessão.
- **DRIVER**: AUTH → `public.users.auth_user_id` → DOMAIN USER → `public.drivers.user_id` → DRIVER RECORD.
- **COURIER**: usuário autenticado resolvido pelo helper/RPC de courier; recursos devem pertencer ao courier atual.
- **MERCHANT**: usuário autenticado + `current_user_is_merchant_member(merchant_id)`.
- **ADMIN**: usuário autenticado + `current_user_is_admin()`.
- **LEGACY_DISABLED**: permanece no histórico/source, mas não pode ser alcançado pela jornada release atual.

## Entregas — Edge Functions ativas na jornada atual

| Endpoint | Actor | Auth method | Resource ownership | service_role? | Idempotency / replay | Risco / observação |
|---|---|---|---|---|---|---|
| `create-order` | AUTH_USER | Bearer JWT + `auth.getUser(token)` | `customer_id` é derivado de `userData.user.id`; não é aceito `user_id` arbitrário do body | Sim, **somente após autenticação** para leitura/escrita privilegiada necessária à criação | contrato de criação/RPC deve continuar protegendo duplicação; E2E concorrente pendente | Source pin ainda contém fluxo histórico Pix; hardener de integração restringe release atual a cash/pending. |
| `customer-orders` | AUTH_USER | Bearer JWT + `auth.getUser(token)` | list/detail filtram `customer_id = user.id`; cancel/review usam client autenticado/RPC | Sim, apenas para leitura hidratada já escopada ao customer | cancel/review dependem de idempotência dos RPCs | `order_id` sozinho nunca autoriza acesso. |
| `customer-favorites` | AUTH_USER | JWT | favoritos escopados por `customer_id = user.id` | Não | add/remove por par customer/merchant | Não aceita `customer_id` do body como autoridade. |
| `customer-notifications` | AUTH_USER | JWT | list/update exigem `user_id = user.id` | Não | updates naturalmente limitados ao recurso do usuário | IDOR mitigado por filtro explícito. |
| `customer-support` | AUTH_USER | JWT | operações passam por RPCs `customer_*`; ownership deve ser validado no banco | Não | depende dos RPCs | Exige regressão RLS/E2E para ticket de outro customer. |
| `google-maps-address` | AUTH_USER | JWT + `auth.getUser(token)` | quota cobrada do usuário autenticado | Não | quota RPC | Chave Google nunca autoriza acesso ao recurso do usuário. |
| `account-deletion` | AUTH_USER / PUBLIC | JWT para conta autenticada; fluxo externo usa e-mail normalizado e resposta genérica | usuário autenticado só solicita exclusão própria; solicitação externa não retorna existência de conta | Sim no fluxo externo, **após validação de input** | upsert/dedup por e-mail | Requer rate limiting externo/operacional para abuso de formulário, mas não há IDOR de conta no contrato revisado. |
| `dispatch-push-outbox` | INTERNAL | bearer `SUPABASE_SERVICE_ROLE_KEY` com comparação constante antes do client privilegiado | outbox interno | Sim | processamento/outbox | Não expor como endpoint autenticado por usuário comum. |
| `privacy-policy` | PUBLIC_RESOURCE | público | sem dado privado | Não necessário | N/A | Conteúdo público deliberado. |

## Entregas — RPCs / SECURITY DEFINER relevantes

| Endpoint / família | Actor | Auth method | Resource ownership | service_role? | Idempotency | Risco / observação |
|---|---|---|---|---|---|---|
| `courier_confirm_courier_settlement(order_id)` | COURIER | `auth.uid()` → `current_courier_id()` | `orders.courier_id` precisa ser o courier atual; order deve estar `delivered`, modo `merchant_manual`, settlement pendente | Não | update condicional; retry retorna estado corrente | Confirma **recebimento manual já ocorrido**; não é disparado por aceitar/finalizar entrega. Registra timestamp e actor. |
| Merchant order accept/step/dispatch/cancel/reject | MERCHANT | sessão + helper | `current_user_is_merchant_member(order.merchant_id)` ou ADMIN | Não | transições condicionais/RPC | Merchant A não pode operar order de Merchant B. |
| `merchant_reject_order` (forward cash/pending) | MERCHANT / ADMIN | sessão + helper | membership sobre `v_order.merchant_id` | Não | lock `FOR UPDATE`; terminal retry retorna estado; refund só para payment realmente paid | Cash/pending não cria refund eletrônico. |
| leitura merchant de orders/items/history (forward cash/pending) | MERCHANT / ADMIN | RLS | membership sobre `merchant_id`; payment state operacional explícito | Não | N/A | Cash/pending fica visível sem fabricar `paid`. |
| `get_authorized_merchant_private_data` | MERCHANT / ADMIN | helpers SECURITY DEFINER | admin ou membership do merchant solicitado | Não | N/A | Evita exposição cross-merchant de dados privados. |
| `admin_review_merchant` | ADMIN | `current_user_is_admin()` no início | global admin | Não | audit log | RPC revoga PUBLIC/anon e concede `authenticated/service_role`; role é validada dentro da função. |
| `admin_review_courier` e família `admin_*` | ADMIN | `current_user_is_admin()` | global admin | Não | varia; ações críticas devem registrar audit | `SECURITY DEFINER` não substitui checagem de role. |

## Corridas — Edge Functions / mutações críticas

| Endpoint | Actor | Auth method | Resource ownership | service_role? | Idempotency | Risco / observação |
|---|---|---|---|---|---|---|
| `request-ride` | AUTH_USER / PASSENGER | JWT → DOMAIN USER | ride criada para passageiro derivado da sessão | Sim após autenticação | `request_key` + regra de corrida ativa; falha de dispatch faz rollback lógico condicional | Não deixa `procurar_motorista` significar matching ativo quando dispatch falha. |
| `cancel-ride` | AUTH_USER / PASSENGER | JWT → DOMAIN USER | apenas ride do passageiro atual | Sim após autenticação | fee por ride única + reconciliação de retry | `cancellation_fees.passenger_id` e wallet usam DOMAIN USER ID. |
| `driver-ride-action` | DRIVER | JWT → DOMAIN USER → DRIVER RECORD | ride deve estar atribuída ao DRIVER RECORD atual; CAS por estado | Sim após autenticação | aceite/transições condicionais; finish repetido não duplica crédito | `final_price` é server-side; body do motorista não autoriza preço. |
| `send-ride-push` / dispatch interno | INTERNAL | segredo/service role conforme função | somente eventos internos | Sim | outbox/efeito de push não deve duplicar efeito financeiro | Falha de push não autoriza alterar state machine. |
| Google/address helpers de Corridas | AUTH_USER | JWT | usuário autenticado/quota | conforme implementação | quota | Não usar chave Maps como autorização. |
| tracker público por token, quando habilitado | PUBLIC_RESOURCE | token não enumerável/escopado | somente ride vinculada ao token | Não | leitura | Token é capacidade; não aceitar `ride_id` arbitrário sem token válido. |

## Superfícies legadas financeiras

Mercado Pago, PagBank, Asaas e OpenPix podem permanecer no histórico protegido para rastreabilidade. Na política atual eles são **LEGACY_DISABLED**: o release não pode importar, chamar ou exibir CTA desses gateways. O pipeline de Motorista/Entregador e o payment boundary do Cliente/Merchant devem falhar caso os marcadores ativos retornem ao bundle.

## Casos de regressão de autorização obrigatórios

| Caso | Resultado esperado | Nível disponível agora |
|---|---|---|
| USER A → profile/wallet de USER B | DENY | static/RLS fixture a executar |
| DRIVER A → ride de DRIVER B | DENY | static fixture; E2E concorrente pendente |
| MERCHANT A → order de MERCHANT B | DENY | static/RLS fixture a executar |
| MERCHANT A → merchant B private data | DENY | static/RLS fixture a executar |
| COURIER A → delivery/settlement de COURIER B | DENY | static/RLS fixture a executar |
| usuário comum → admin action | DENY | static RPC contract; E2E pendente |
| DRIVER → admin action | DENY | static RPC contract; E2E pendente |
| MERCHANT → admin global action | DENY | static RPC contract; E2E pendente |

## Regra operacional

Nenhum resultado puramente estático nesta matriz deve ser chamado de **E2E PASS**. O fechamento de RLS exige PostgreSQL/Supabase descartável com pelo menos AUTH USER A/B, DOMAIN USER A/B, DRIVER A/B, MERCHANT A/B, COURIER A/B e ADMIN, aplicando pinned migrations + preparação histórica documentada + forward migrations. Nunca usar produção para esse teste.
