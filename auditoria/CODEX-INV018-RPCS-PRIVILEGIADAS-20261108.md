# INV-018 — Inventário de RPCs privilegiadas executáveis anonimamente

Consulta SQL somente leitura a `pg_proc`/`pg_namespace` no Supabase Entregas `ptgkwyyolrdgnqketkjj` em 08/11/2026. Os registros abaixo são assinaturas e metadados, sem dados pessoais, valores de credenciais ou execução de funções de negócio.

## Balanço após correções autorizadas

- **113** funções `public SECURITY DEFINER` inicialmente executáveis por `anon` (superfície de revisão, não 113 explorações).
- **26** dessas tiveram privilégios restritos em duas migrações versionadas: 20 `admin_*` e 6 RPCs internas de push/enfileiramento/segredos; ACL verificada após aplicações.
- Restam **87**, sendo **20** funções com retorno `trigger` (não normalmente invocáveis por PostgREST) e **67** RPCs não-trigger.
- **6** RPCs não-trigger não contêm referência sintática direta de identidade; nem a presença nem a ausência de texto de guarda prova segurança. É necessária revisão por chamador, privilégio e execução.

## Análise dos seis casos sem referência sintática direta

- `delivery_zone_contains_point`, `merchant_accepting_orders`, `merchant_subscription_in_good_standing` e `get_order_payment_provider`: consultam estado/limites operacionais e podem ser necessários a clientes antes de autenticação. Validar intenção pública antes de revogar.
- `reject_order`: wrapper legado de `merchant_reject_order`; a verificação de permissão ocorre na função delegada; testar negação a usuários não autorizados.
- `resolve_delivery_quote`: cotação operacional com restrição específica ao estabelecimento QA; analisar entrada e vazamento potencial em teste autenticado.
- `courier_dispute_courier_settlement` não entra nesses seis porque usa a guarda indireta `current_user_courier_id()`; a checagem de titularidade foi observada no corpo, mas ainda falta E2E A/B.

## Catálogo — EXECUTE atual de anon

| Função (identidade) | Retorno | Trigger | Referência a auth/guard | Authenticated |
|---|---|---|---|---|
| `accept_delivery_offer(_offer_id uuid)` | `uuid` | Não | Sim | Sim |
| `ack_courier_offer_seen(_offer_id uuid, _channel text)` | `boolean` | Não | Sim | Sim |
| `add_support_message(_ticket_id uuid, _message text, _attachment_paths jsonb, _is_internal boolean)` | `uuid` | Não | Sim | Sim |
| `bootstrap_courier_location(_latitude numeric, _longitude numeric, _accuracy_meters numeric, _heading numeric, _speed_mps numeric)` | `void` | Não | Sim | Sim |
| `close_courier_settlements(_merchant_id uuid)` | `SETOF courier_settlements` | Não | Sim | Sim |
| `complete_delivery_with_pin(_delivery_job_id uuid, _pin text)` | `boolean` | Não | Sim | Sim |
| `complete_pickup_with_pin(_order_id uuid, _pin text)` | `boolean` | Não | Sim | Sim |
| `confirm_merchant_mapped_address(_latitude numeric, _longitude numeric, _city text, _state text, _address_line text, _neighborhood text)` | `uuid` | Não | Sim | Sim |
| `consume_google_maps_lookup_quota()` | `boolean` | Não | Sim | Sim |
| `courier_dispute_courier_settlement(_settlement_id uuid, _reason text)` | `courier_settlements` | Não | Sim | Sim |
| `courier_transition_delivery(_delivery_job_id uuid, _new_status text)` | `void` | Não | Sim | Sim |
| `create_couple_invite()` | `TABLE(code text, expires_at timestamp with time zone)` | Não | Sim | Sim |
| `create_merchant_application(_category_id uuid, _name text, _legal_name text, _document text, _contact_phone text, _contact_email text, _address_line text, _neighborhood text, _city text, _state text, _latitude numeric, _longitude numeric)` | `uuid` | Não | Sim | Sim |
| `create_support_ticket(_category text, _subject text, _description text, _order_id uuid, _delivery_job_id uuid)` | `uuid` | Não | Sim | Sim |
| `current_user_courier_id()` | `uuid` | Não | Sim | Sim |
| `current_user_is_active()` | `boolean` | Não | Sim | Sim |
| `current_user_is_admin()` | `boolean` | Não | Sim | Sim |
| `current_user_is_assigned_courier(_order_id uuid)` | `boolean` | Não | Sim | Sim |
| `current_user_is_merchant_manager(_merchant_id uuid)` | `boolean` | Não | Sim | Sim |
| `current_user_is_merchant_member(_merchant_id uuid)` | `boolean` | Não | Sim | Sim |
| `current_user_is_merchant_owner(_merchant_id uuid)` | `boolean` | Não | Sim | Sim |
| `current_user_owns_wallet(_wallet_id uuid)` | `boolean` | Não | Sim | Sim |
| `customer_cancel_order(_order_id uuid, _reason text)` | `jsonb` | Não | Sim | Sim |
| `deactivate_own_account()` | `void` | Não | Sim | Sim |
| `delivery_zone_contains_point(p_zone_id uuid, p_lat numeric, p_lon numeric)` | `boolean` | Não | Não | Sim |
| `ensure_delivery_job(_order_id uuid)` | `uuid` | Não | Sim | Sim |
| `ensure_pickup_confirmation_secret(_order_id uuid)` | `text` | Não | Sim | Sim |
| `get_authorized_merchant_private_data(_merchant_id uuid)` | `TABLE(merchant_id uuid, owner_user_id uuid, legal_name text, document text, contact_p` | Não | Sim | Sim |
| `get_courier_incoming_offers()` | `jsonb` | Não | Sim | Sim |
| `get_courier_metrics(_timezone text)` | `jsonb` | Não | Sim | Sim |
| `get_courier_payout_readiness()` | `jsonb` | Não | Sim | Sim |
| `get_delivery_checkout_readiness()` | `jsonb` | Não | Sim | Sim |
| `get_my_notification_feed(_limit integer)` | `jsonb` | Não | Sim | Sim |
| `get_order_payment_provider()` | `text` | Não | Não | Sim |
| `manage_merchant_member(_merchant_id uuid, _user_id uuid, _role text, _status text)` | `void` | Não | Sim | Sim |
| `mark_notification_read(_notification_id uuid)` | `boolean` | Não | Sim | Sim |
| `merchant_accepting_orders(p_merchant_id uuid, p_at timestamp with time zone)` | `boolean` | Não | Não | Sim |
| `merchant_mark_courier_settlement_paid(_settlement_id uuid, _proof_storage_path text)` | `courier_settlements` | Não | Sim | Sim |
| `merchant_reject_order(_order_id uuid, _reason text)` | `jsonb` | Não | Sim | Sim |
| `merchant_request_courier(_order_id uuid)` | `uuid` | Não | Sim | Sim |
| `merchant_subscription_in_good_standing(_merchant_id uuid)` | `boolean` | Não | Não | Sim |
| `merchant_transition_order(_order_id uuid, _new_status text)` | `void` | Não | Sim | Sim |
| `preview_checkout_fee(p_merchant_id uuid)` | `numeric` | Não | Sim | Sim |
| `preview_coupon(p_merchant_id uuid, p_code text, p_subtotal numeric)` | `TABLE(coupon_id uuid, code text, discount_type text, discount_value numeric, discount` | Não | Sim | Sim |
| `preview_delivery_quote(p_merchant_id uuid, p_delivery_address jsonb)` | `TABLE(eligible boolean, reason text, zone_id uuid, delivery_fee numeric, minimum_orde` | Não | Sim | Sim |
| `read_all_my_notifications()` | `integer` | Não | Sim | Sim |
| `read_my_notification(_notification_id uuid)` | `void` | Não | Sim | Sim |
| `register_courier_push_device(_token text, _platform text)` | `uuid` | Não | Sim | Sim |
| `register_courier_push_device_v2(_token text, _platform text, _app_package text)` | `uuid` | Não | Sim | Sim |
| `register_customer_push_device(_token text, _platform text)` | `uuid` | Não | Sim | Sim |
| `register_superapp_customer_push_device(_token text, _platform text, _app_package text)` | `uuid` | Não | Sim | Sim |
| `reject_delivery_offer(_offer_id uuid)` | `void` | Não | Sim | Sim |
| `reject_order(_order_id uuid, _reason text)` | `void` | Não | Não | Sim |
| `remove_courier_push_devices()` | `void` | Não | Sim | Sim |
| `remove_customer_push_devices()` | `void` | Não | Sim | Sim |
| `remove_superapp_customer_push_devices(_app_package text)` | `void` | Não | Sim | Sim |
| `request_own_account_deletion()` | `uuid` | Não | Sim | Sim |
| `request_payout(_wallet_id uuid, _amount numeric, _idempotency_key text)` | `uuid` | Não | Sim | Sim |
| `resolve_delivery_quote(p_merchant_id uuid, p_delivery_address jsonb)` | `TABLE(eligible boolean, reason text, zone_id uuid, delivery_fee numeric, minimum_orde` | Não | Não | Sim |
| `resubmit_merchant_application(_merchant_id uuid)` | `void` | Não | Sim | Sim |
| `set_courier_online(_is_online boolean)` | `courier_availability` | Não | Sim | Sim |
| `set_default_customer_address(_address_id uuid)` | `void` | Não | Sim | Sim |
| `set_merchant_mapped_location(_latitude numeric, _longitude numeric)` | `uuid` | Não | Sim | Sim |
| `submit_courier_application(_payload jsonb)` | `uuid` | Não | Sim | Sim |
| `submit_order_review(_order_id uuid, _merchant_rating smallint, _courier_rating smallint, _comment text)` | `uuid` | Não | Sim | Sim |
| `update_courier_delivery_route_metrics(_delivery_job_id uuid, _distance_meters integer, _duration_seconds integer)` | `boolean` | Não | Sim | Sim |
| `update_courier_location(_latitude numeric, _longitude numeric, _accuracy_meters numeric, _heading numeric, _speed_mps numeric)` | `void` | Não | Sim | Sim |
| `activate_merchant_subscription_from_approved_payment()` | `trigger` | Sim | Não | Sim |
| `dispatch_new_delivery_job()` | `trigger` | Sim | Não | Sim |
| `enforce_active_order_customer()` | `trigger` | Sim | Não | Sim |
| `enforce_delivery_financial_readiness()` | `trigger` | Sim | Não | Sim |
| `enforce_order_payment_before_fulfillment()` | `trigger` | Sim | Não | Sim |
| `enqueue_native_push_for_notification()` | `trigger` | Sim | Não | Sim |
| `finalize_refund_state_atomically()` | `trigger` | Sim | Não | Sim |
| `handle_new_user()` | `trigger` | Sim | Não | Sim |
| `normalize_merchant_subscription_payment_entitlement()` | `trigger` | Sim | Não | Sim |
| `notify_delivery_offer()` | `trigger` | Sim | Não | Sim |
| `notify_order_change()` | `trigger` | Sim | Não | Sim |
| `notify_order_lifecycle()` | `trigger` | Sim | Não | Sim |
| `notify_support_critical()` | `trigger` | Sim | Não | Sim |
| `protect_approved_courier_identity()` | `trigger` | Sim | Sim | Sim |
| `protect_approved_merchant_identity()` | `trigger` | Sim | Sim | Sim |
| `recalculate_review_aggregates()` | `trigger` | Sim | Não | Sim |
| `request_native_push_dispatch()` | `trigger` | Sim | Não | Sim |
| `reverse_merchant_reserve_on_completed_refund()` | `trigger` | Sim | Não | Sim |
| `sync_completed_refund_order_state()` | `trigger` | Sim | Não | Sim |
| `validate_partner_document_storage_path()` | `trigger` | Sim | Não | Sim |

## Estado de validação

- Foi verificado que a Edge Function pinada `dispatch-push-outbox` usa `SUPABASE_SERVICE_ROLE_KEY` para as RPCs internas restringidas; outras funcionalidades não foram arbitrariamente revogadas.
- O alvo é reduzir privilégios indevidos com regressão por domínio; não revogar todas as 87 funções cegamente, pois isso pode interromper operações públicas autorizadas.
- Pendem testes autenticados com sessões reais, push real em Android, pagamentos/saldos em ambiente isolado, e reclassificação individual das 67 RPCs não-trigger.
