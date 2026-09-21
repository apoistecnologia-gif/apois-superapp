-- Safe2Pay becomes the only target electronic provider for new APOIS Corridas Pix.
-- Provider remains disabled until sandbox split/webhook/E2E are complete.

insert into public.app_settings(key,value,description,updated_at)
values (
  'finance.target_electronic_payment_provider',
  '"safe2pay"'::jsonb,
  'Safe2Pay Marketplace é o único provider eletrônico alvo para novas cobranças de corrida.',
  now()
)
on conflict (key) do update
set value=excluded.value, description=excluded.description, updated_at=excluded.updated_at;

insert into public.app_settings(key,value,description,updated_at)
values (
  'finance.ride_electronic_payments_enabled',
  'false'::jsonb,
  'Permanece false até Safe2Pay sandbox split + webhook + E2E serem homologados.',
  now()
)
on conflict (key) do update
set value=excluded.value, description=excluded.description, updated_at=excluded.updated_at;

alter table public.ride_pix_payments
  drop constraint if exists ride_pix_payments_provider_check;

alter table public.ride_pix_payments
  add constraint ride_pix_payments_provider_check
  check (provider = any (array[
    'asaas'::text,
    'woovi'::text,
    'pagbank'::text,
    'mercadopago'::text,
    'safe2pay'::text
  ]));

create or replace function private.enforce_new_ride_payment_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and lower(coalesce(new.provider,'')) <> 'safe2pay' then
    raise exception 'retired_payment_provider';
  end if;

  if tg_op = 'UPDATE'
     and new.provider is distinct from old.provider
     and lower(coalesce(new.provider,'')) <> 'safe2pay' then
    raise exception 'retired_payment_provider';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_new_ride_payment_provider on public.ride_pix_payments;
create trigger trg_enforce_new_ride_payment_provider
before insert or update of provider on public.ride_pix_payments
for each row execute function private.enforce_new_ride_payment_provider();

comment on function private.enforce_new_ride_payment_provider() is
  'Preserva linhas históricas de providers antigos, mas proíbe novas cobranças fora da Safe2Pay.';
