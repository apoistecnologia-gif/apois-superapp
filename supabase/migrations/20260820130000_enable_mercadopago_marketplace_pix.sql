alter table public.ride_pix_payments
  drop constraint if exists ride_pix_payments_provider_check;

alter table public.ride_pix_payments
  add constraint ride_pix_payments_provider_check
  check (provider = any (array['asaas'::text, 'woovi'::text, 'pagbank'::text, 'mercadopago'::text]));

alter table public.ride_pix_payments
  add column if not exists provider_seller_id text,
  add column if not exists provider_status_detail text,
  add column if not exists application_fee_cents bigint not null default 0;

alter table public.ride_pix_payments
  drop constraint if exists ride_pix_payments_application_fee_cents_check;

alter table public.ride_pix_payments
  add constraint ride_pix_payments_application_fee_cents_check
  check (application_fee_cents >= 0);

comment on column public.ride_pix_payments.provider_seller_id is
  'Mercado Pago seller/user id (or equivalent provider receiver id) used for this charge.';

comment on column public.ride_pix_payments.application_fee_cents is
  'Marketplace commission captured in the provider transaction. APOIS Corridas uses zero.';
