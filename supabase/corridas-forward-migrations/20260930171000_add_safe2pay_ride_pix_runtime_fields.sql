-- Runtime fields required by safe2pay-create-ride-pix.
-- Forward-only. Does not activate the provider.

alter table public.safe2pay_ride_transactions
  add column if not exists pix_copy_paste text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists expires_at timestamptz;

comment on column public.safe2pay_ride_transactions.pix_copy_paste is
  'Safe2Pay Pix copia-e-cola retornado ao passageiro autenticado.';
comment on column public.safe2pay_ride_transactions.pix_qr_code_base64 is
  'Representação base64 opcional do QR Code Pix Safe2Pay.';
comment on column public.safe2pay_ride_transactions.expires_at is
  'Expiração local da cobrança Pix usada para impedir reutilização de cobrança vencida.';
