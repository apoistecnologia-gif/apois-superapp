-- Safe2Pay Marketplace mapping for APOIS Corridas.
-- Forward-only. Does not activate provider or migrate historical provider credentials.

create table if not exists public.driver_safe2pay_accounts (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  safe2pay_receiver_id bigint unique,
  status text not null default 'pending'
    check (status in ('pending','provisioning','active','blocked','rejected','disabled','reconciliation_required')),
  request_fingerprint text,
  provisioning_started_at timestamptz,
  provider_created_at timestamptz,
  environment text not null default 'sandbox'
    check (environment in ('sandbox','production')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_safe2pay_accounts enable row level security;
revoke all on table public.driver_safe2pay_accounts from anon, authenticated;
grant select, insert, update, delete on table public.driver_safe2pay_accounts to service_role;

create table if not exists public.safe2pay_ride_transactions (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  reference text not null unique,
  provider_transaction_id bigint unique,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','processing','authorized','expired','refunded','chargeback','failed')),
  receiver_id bigint,
  environment text not null default 'sandbox'
    check (environment in ('sandbox','production')),
  authorized_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_safe2pay_ride_transaction_ride_active
  on public.safe2pay_ride_transactions(ride_id)
  where status in ('pending','processing','authorized');

alter table public.safe2pay_ride_transactions enable row level security;
revoke all on table public.safe2pay_ride_transactions from anon, authenticated;
grant select, insert, update, delete on table public.safe2pay_ride_transactions to service_role;

create table if not exists public.safe2pay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_transaction_id bigint not null,
  transaction_status_code text not null,
  event_key text generated always as (provider_transaction_id::text || ':' || transaction_status_code) stored,
  payload_hash text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(event_key)
);

alter table public.safe2pay_webhook_events enable row level security;
revoke all on table public.safe2pay_webhook_events from anon, authenticated;
grant select, insert, update, delete on table public.safe2pay_webhook_events to service_role;

comment on table public.driver_safe2pay_accounts is
  'Server-only mapping from canonical driver record to Safe2Pay Marketplace receiver.';
comment on table public.safe2pay_ride_transactions is
  'Provider reconciliation state. The provider webhook, not a client, authorizes electronic payment.';
comment on table public.safe2pay_webhook_events is
  'Idempotency ledger for Safe2Pay transaction status callbacks; raw secrets are not stored.';
