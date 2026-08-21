alter table public.cancellation_fees
  add column if not exists beneficiary_driver_id uuid null references public.drivers(id) on delete set null,
  add column if not exists provider_seller_id text null,
  add column if not exists application_fee_cents integer not null default 0;

alter table public.cancellation_fees
  drop constraint if exists cancellation_fees_application_fee_cents_check;

alter table public.cancellation_fees
  add constraint cancellation_fees_application_fee_cents_check check (application_fee_cents >= 0);

create index if not exists idx_cancellation_fees_beneficiary_driver_id
  on public.cancellation_fees(beneficiary_driver_id);

update public.cancellation_fees cf
set beneficiary_driver_id = coalesce(r.accepted_driver_id, r.driver_id),
    provider_seller_id = coalesce(cf.provider_seller_id, dma.mercadopago_user_id),
    application_fee_cents = 0,
    updated_at = now()
from public.rides r
left join public.driver_mercadopago_accounts dma
  on dma.driver_id = coalesce(r.accepted_driver_id, r.driver_id)
where cf.ride_id = r.id
  and cf.beneficiary_driver_id is null;
