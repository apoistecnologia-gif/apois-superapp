-- Safe2Pay Marketplace mapping for APOIS Entregas.
-- Forward-only. Does not activate provider or alter historical payment rows.

create table if not exists public.merchant_safe2pay_accounts (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  safe2pay_receiver_id bigint unique,
  status text not null default 'pending'
    check (status in ('pending','provisioning','active','blocked','rejected','disabled','reconciliation_required')),
  request_fingerprint text,
  provisioning_started_at timestamptz,
  provider_created_at timestamptz,
  pix_copy_paste text,
  pix_qr_code_base64 text,
  environment text not null default 'sandbox'
    check (environment in ('sandbox','production')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safe2pay_order_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reference text not null unique,
  provider_transaction_id bigint unique,
  amount numeric(12,2) not null check (amount >= 0),
  merchant_amount numeric(12,2) not null check (merchant_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','processing','authorized','expired','refunded','chargeback','failed')),
  environment text not null default 'sandbox'
    check (environment in ('sandbox','production')),
  authorized_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (round(merchant_amount::numeric, 2) = round(amount::numeric, 2))
);

create unique index if not exists ux_safe2pay_order_transaction_order_active
  on public.safe2pay_order_transactions(order_id)
  where status in ('pending','processing','authorized');

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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'merchant_safe2pay_accounts',
    'safe2pay_order_transactions',
    'safe2pay_webhook_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

comment on table public.merchant_safe2pay_accounts is
  'Server-only mapping from merchant to Safe2Pay Marketplace receiver.';
comment on table public.safe2pay_order_transactions is
  'Order payment reconciliation. Merchant receives the order charge; courier payout remains merchant_manual.';
comment on table public.safe2pay_webhook_events is
  'Idempotency ledger for Safe2Pay transaction status callbacks; raw secrets are not stored.';
