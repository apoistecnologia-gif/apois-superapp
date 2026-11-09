# INV-018 — Corridas: inventário de funções SECURITY DEFINER com EXECUTE para anon

Fonte: consulta somente de metadados a `pg_proc` no Supabase Corridas `tbbzkrfupmqdywnzgnms` após migração de ACL em 08/11/2026. Nomes e assinaturas não constituem prova de exploração.

## Correção aplicada

- Contagem antes: **84** funções `public SECURITY DEFINER` executáveis por `anon`.
- Migração `apois_corridas_inv018_restrict_admin_pix_financial_rpc_execute_20261108`: revogou acesso anônimo de **12 ações `admin_*`** (exceto `admin_is_authorized`, preservada por compatibilidade) e revogou acesso `anon`/`authenticated` de **3 RPCs Pix/financeiro** que já exigiam `auth.role()='service_role'` no próprio corpo.
- Três RPCs financeiras restritas: `activate_prepaid_pix_ride`, `claim_prepaid_pix_initial_dispatch` e `reverse_refunded_ride_payment`. Não foram chamadas nem tiveram suas regras de negócio modificadas.
- ACL testada primeiramente em `BEGIN/ROLLBACK`: 15 funções protegidas, 0 com `anon`, 12 com `authenticated` e 15 com `service_role`. Migração aplicada pelo conector Supabase e as mesmas contagens confirmadas em nova consulta. Histórico de migração conferido.
- Contagem posterior: **69** funções ainda executáveis anonimamente. Destas **15** são triggers e **54** são funções não-trigger. Todas precisam ser classificadas por efeito e chamadores, sem revogação cega.

## Funções restantes por assinatura

| Função | Retorno | Trigger | Referência sintática de identidade/delegação | Execução por authenticated |
|---|---|---|---|---|
| `admin_is_authorized()` | `boolean` | Não | Sim | Sim |
| `apois_capture_ride_security_code()` | `trigger` | Sim | Não | Sim |
| `apois_cleanup_ride_security_secret()` | `trigger` | Sim | Não | Sim |
| `apois_enforce_passenger_operational_status_gate()` | `trigger` | Sim | Não | Sim |
| `apois_enforce_passenger_ride_financial_gate()` | `trigger` | Sim | Não | Sim |
| `apois_ensure_ride_security_secret()` | `trigger` | Sim | Não | Sim |
| `apois_lock_cancellation_fee_change()` | `trigger` | Sim | Não | Sim |
| `append_nearby_busy_driver_candidates()` | `trigger` | Sim | Não | Sim |
| `cancel_own_ride(p_ride_id uuid)` | `TABLE(ok boolean, status text, cancellation_fee numeric, message text)` | Não | Sim | Sim |
| `clear_own_profile_photo()` | `jsonb` | Não | Sim | Sim |
| `create_driver_sos(_lat numeric, _lng numeric, _severity text, _message text)` | `jsonb` | Não | Sim | Sim |
| `create_passenger_share_token(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `create_passenger_sos(_ride_id uuid, _lat numeric, _lng numeric, _severity text, _message text)` | `jsonb` | Não | Sim | Sim |
| `credit_driver_cancellation_fee()` | `trigger` | Sim | Não | Sim |
| `deactivate_notification_token(_token text)` | `boolean` | Não | Sim | Sim |
| `disconnect_my_mercadopago_driver()` | `jsonb` | Não | Sim | Sim |
| `driver_accept_ride(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_add_emergency_contact(_name text, _phone text, _relation text)` | `jsonb` | Não | Sim | Sim |
| `driver_bootstrap_profile(_category text, _vehicle_model text, _vehicle_plate text, _vehicle_color text)` | `jsonb` | Não | Sim | Sim |
| `driver_cancel_ride(_ride_id uuid, _reason text)` | `jsonb` | Não | Sim | Sim |
| `driver_complete_registration(_name text, _phone text, _cpf text, _birth_date date, _city text, _state text, _category text, _vehicle_model text, _vehicle_plate text, _vehicle_color text, _vehicle_year integer, _selfie_path text, _cnh_path text, _cnh_back_path text, _vehicle_document_path text, _photo_path text)` | `jsonb` | Não | Sim | Sim |
| `driver_complete_registration_v2(_name text, _phone text, _cpf text, _birth_date date, _city text, _state text, _category text, _vehicle_model text, _vehicle_plate text, _vehicle_color text, _vehicle_year integer, _selfie_path text, _cnh_path text, _cnh_back_path text, _vehicle_document_path text, _vehicle_photo_path text, _photo_path text)` | `jsonb` | Não | Sim | Sim |
| `driver_complete_registration_v3(_name text, _phone text, _cpf text, _birth_date date, _city text, _state text, _address text, _address_number text, _address_complement text, _province text, _postal_code text, _declared_monthly_income numeric, _category text, _vehicle_model text, _vehicle_plate text, _vehicle_color text, _vehicle_year integer, _selfie_path text, _cnh_path text, _cnh_back_path text, _vehicle_document_path text, _vehicle_photo_path text, _photo_path text)` | `jsonb` | Não | Sim | Sim |
| `driver_confirm_cash_payment(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_delete_emergency_contact(_contact_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_finish_ride(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_get_profile()` | `jsonb` | Não | Sim | Sim |
| `driver_mark_arrived(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_rate_passenger(_ride_id uuid, _stars integer, _comment text)` | `jsonb` | Não | Sim | Sim |
| `driver_reject_ride(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_request_withdrawal(_amount_cents bigint, _idempotency_key uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_set_emergency_contact_primary(_contact_id uuid)` | `jsonb` | Não | Sim | Sim |
| `driver_set_payout_destination(_pix_key text, _pix_key_type text, _holder_name text)` | `jsonb` | Não | Sim | Sim |
| `driver_set_presence(_online boolean, _lat numeric, _lng numeric, _heading numeric, _speed numeric)` | `jsonb` | Não | Sim | Sim |
| `driver_start_ride(_ride_id uuid, _security_code text)` | `jsonb` | Não | Sim | Sim |
| `driver_update_document(_slot text, _storage_path text)` | `jsonb` | Não | Sim | Sim |
| `enforce_driver_feature_flags()` | `trigger` | Sim | Não | Sim |
| `enforce_ride_feature_flags()` | `trigger` | Sim | Não | Sim |
| `finish_disabled_driver_operation()` | `trigger` | Sim | Não | Sim |
| `get_driver_amenities_public(target_user_id uuid)` | `jsonb` | Não | Sim | Sim |
| `get_driver_financial_dashboard(_from timestamp with time zone, _to timestamp with time zone)` | `jsonb` | Não | Sim | Sim |
| `get_driver_public_profile(target_user_id uuid)` | `TABLE(user_id uuid, name text, photo_url text, city text, state text, ` | Não | Sim | Sim |
| `get_driver_ride_settlement(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `get_own_driver_amenities()` | `jsonb` | Não | Sim | Sim |
| `get_passenger_payment_methods()` | `TABLE(id uuid, code text, name text, description text, icon text, requ` | Não | Sim | Sim |
| `get_passenger_ride_receipt(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `get_passenger_ride_security_code(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `get_ride_cancellation_policy()` | `jsonb` | Não | Sim | Sim |
| `get_ride_feature_flags()` | `jsonb` | Não | Não | Sim |
| `get_shared_passenger_ride(_token uuid)` | `jsonb` | Não | Sim | Sim |
| `handle_completed_ride_settlement()` | `trigger` | Sim | Sim | Sim |
| `handle_new_user()` | `trigger` | Sim | Não | Sim |
| `is_passenger_ride_pix_enabled()` | `boolean` | Não | Sim | Sim |
| `mark_driver_withdrawal_failed(_withdrawal_id uuid, _reason text, _response jsonb)` | `void` | Não | Sim | Sim |
| `mark_driver_withdrawal_paid(_withdrawal_id uuid, _transfer_id text, _end_to_end_id text, _response jsonb)` | `void` | Não | Sim | Sim |
| `mark_driver_withdrawal_processing(_withdrawal_id uuid)` | `void` | Não | Sim | Sim |
| `mobility_user_id()` | `uuid` | Não | Sim | Sim |
| `rate_passenger_ride(_ride_id uuid, _rating integer, _comment text)` | `jsonb` | Não | Sim | Sim |
| `register_notification_token(_token text, _platform text, _device_id text, _permission_status text)` | `uuid` | Não | Sim | Sim |
| `request_own_account_deletion()` | `jsonb` | Não | Sim | Sim |
| `reset_driver_approach_distance_on_assignment()` | `trigger` | Sim | Não | Sim |
| `revoke_passenger_share_token(_ride_id uuid)` | `jsonb` | Não | Sim | Sim |
| `ride_feature_enabled(_category text)` | `boolean` | Não | Não | Sim |
| `set_own_driver_amenities(_charger boolean, _water boolean, _candy boolean, _music_on_demand boolean, _pet_friendly boolean, _large_luggage boolean, _air_conditioning boolean, _wifi boolean, _child_seat boolean, _quiet_ride boolean)` | `jsonb` | Não | Sim | Sim |
| `set_own_profile_photo(_storage_path text)` | `jsonb` | Não | Sim | Sim |
| `set_passenger_billing_cpf(_cpf text)` | `jsonb` | Não | Sim | Sim |
| `sync_driver_presence_to_active_rides()` | `trigger` | Sim | Não | Sim |
| `update_own_profile(_name text, _phone text, _cpf text, _birth_date date, _gender text, _city text)` | `jsonb` | Não | Sim | Sim |
| `validate_internal_scheduler_token(_name text, _token text)` | `boolean` | Não | Não | Sim |

## Pendências

- Testar 15 chamadas pelo papel `anon`, por usuário autenticado autorizado/não autorizado e por `service_role` quando pertinente, **sem executar efeitos financeiros reais**; os testes realizados até aqui foram de ACL em catálogo.
- Avaliar especificamente `validate_internal_scheduler_token` e demais RPCs que lidam com tokens/estado/ledger, identificando chamadores e contrato de acesso antes de mudar permissões.
- Não declarar que as 69 funções são vulnerabilidades; diversas podem ser helpers públicos necessários ao login, corrida, localização, cotação ou triggers.

## Continuação adicional: saques — três RPCs de status protegidas (08/11/2026)

- Funções reais revisadas no Supabase Corridas: mark_driver_withdrawal_failed(uuid,text,jsonb), mark_driver_withdrawal_paid(uuid,text,text,jsonb), mark_driver_withdrawal_processing(uuid). Todas declaradas SECURITY DEFINER, com guarda explícita auth.role() = service_role antes da mutação.
- Teste BEGIN/ROLLBACK reduziu EXECUTE nas três: anon=false, authenticated=false, service_role=true. Migração apois_corridas_inv018_withdrawal_state_service_only_20261108 aplicada e ACL reconsultada 3/3 com exatamente o mesmo resultado.
- Nenhuma RPC de saque chamada; nenhuma movimentação, estorno, pagamento, chave PIX ou saldo alterado.
- Com mais três revogações, total de funções SECURITY DEFINER anon-executáveis em Corridas deve cair de 69 para 66; confirmar no advisor antes de tomar como medição definitiva.
- validate_internal_scheduler_token permanece sob investigação de chamadores; não revogar sem identificar invocações internas para evitar quebra de tarefas programadas.

## Reclassificação de wrappers Corridas (09/11/2026)

- Dos 66 `public SECURITY DEFINER` ainda executáveis por `anon`, 15 são funções de trigger e 51 são invocáveis. Dez funções invocáveis incluem marcador textual direto de identidade/role, outras 41 não: a maioria é wrapper SQL fino que chama a implementação no schema `apois_rpc_private`, portanto classificador textual não prova vulnerabilidade.
- Foram inspecionados os pares public/private de `driver_get_profile`, `driver_complete_registration_v3`, `driver_finish_ride`, `driver_request_withdrawal`, `driver_set_payout_destination`, `get_driver_financial_dashboard` e `admin_is_authorized`. As implementações privadas sensíveis consultadas usam `auth.uid`/`mobility_user_id` ou `private.has_permission`, além de guardas transacionais onde aplicável. O `validate_internal_scheduler_token` compara hash de token com segredo privado; nenhum chamador compatível foi provado seguro para mudança de ACL neste ciclo.
- Nenhuma revogação em massa foi feita nesta passagem. Há gates de autenticação internos, porém continuam faltando testes de invocação com JWT falso, perfil B e verificação de chamador antes de qualquer restrição adicional; INV-018 permanece parcial.
