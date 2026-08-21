insert into public.platform_settings(key,value,description,updated_at)
values
  ('mercadopago_marketplace_oauth_enabled','true'::jsonb,'OAuth Marketplace dos estabelecimentos habilitado. Sellers devem conectar a aplicação APOIS ENTREGAS antes de receber pagamentos compatíveis.',now()),
  ('mercadopago_split_1n_mode','"commercial_enablement_pending"'::jsonb,'Split Mercado Pago 1:N depende de habilitação comercial/carteira assessorada. Não criar implementação simulada nem fazer a APOIS custodiar o total do pedido.',now())
on conflict (key) do update
set value=excluded.value,description=excluded.description,updated_at=now();
