-- Safe2Pay Marketplace becomes the target provider for APOIS Entregas.
-- Activation stays false until sandbox split/webhook/E2E validation.

insert into public.platform_settings(key,value,description,updated_at)
values (
  'order_payment_provider',
  '"safe2pay_marketplace"'::jsonb,
  'Safe2Pay Marketplace é o provider alvo para novas cobranças eletrônicas de pedido.',
  now()
)
on conflict (key) do update
set value=excluded.value, description=excluded.description, updated_at=excluded.updated_at;

insert into public.platform_settings(key,value,description,updated_at)
values (
  'safe2pay_provider_enabled',
  'false'::jsonb,
  'Permanece false até subcontas, split 1:N, webhook e E2E Safe2Pay serem homologados.',
  now()
)
on conflict (key) do update
set value=excluded.value, description=excluded.description, updated_at=excluded.updated_at;
