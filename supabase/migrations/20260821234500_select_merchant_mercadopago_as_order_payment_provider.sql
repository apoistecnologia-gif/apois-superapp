insert into public.platform_settings(key,value,description,updated_at)
values (
  'order_payment_provider',
  '"mercadopago_merchant"'::jsonb,
  'Pedidos do APOIS Entregas usam PIX criado diretamente na conta Mercado Pago OAuth do estabelecimento. Fluxos OpenPix/Asaas legados não devem criar novas cobranças de pedido.',
  now()
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();
