alter table public.merchant_mercadopago_accounts
  alter column encrypted_access_token drop not null,
  alter column token_iv drop not null;

comment on column public.merchant_mercadopago_accounts.encrypted_access_token is
  'Mercado Pago access token encrypted with server-side AES-GCM. Null after disconnect/revocation.';
comment on column public.merchant_mercadopago_accounts.token_iv is
  'AES-GCM IV for encrypted_access_token. Null after disconnect/revocation.';
