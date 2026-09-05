-- Forward-only hardening for APOIS Corridas.
-- Not applied automatically. Production application requires an explicit release step.
--
-- Identity contract:
--   auth.uid()            = AUTH USER ID
--   public.users.id       = DOMAIN USER ID
--   public.drivers.id     = DRIVER RECORD ID
-- driver_wallets.driver_id and driver_wallet_transactions.driver_id store DRIVER RECORD ID.

begin;

-- Refuse to hide historical duplicate fees. The unique index below is the database
-- idempotency boundary used by cancel-ride retries.
do $preflight$
declare
  duplicate_ride uuid;
begin
  if to_regclass('public.cancellation_fees') is null then
    raise exception 'cancellation idempotency migration blocked: public.cancellation_fees is missing';
  end if;
  if to_regclass('public.driver_wallets') is null then
    raise exception 'driver wallet identity migration blocked: public.driver_wallets is missing';
  end if;
  if to_regclass('public.driver_wallet_transactions') is null then
    raise exception 'driver wallet identity migration blocked: public.driver_wallet_transactions is missing';
  end if;

  select cf.ride_id
    into duplicate_ride
  from public.cancellation_fees cf
  where cf.ride_id is not null
  group by cf.ride_id
  having count(*) > 1
  limit 1;

  if duplicate_ride is not null then
    raise exception 'cancellation idempotency migration blocked: duplicate cancellation_fees for ride %', duplicate_ride;
  end if;
end
$preflight$;

create unique index if not exists cancellation_fees_one_per_ride_uidx
  on public.cancellation_fees (ride_id)
  where ride_id is not null;

alter table public.driver_wallets enable row level security;
alter table public.driver_wallet_transactions enable row level security;

drop policy if exists "driver_reads_own_wallet" on public.driver_wallets;
create policy "driver_reads_own_wallet"
  on public.driver_wallets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      join public.users u on u.id = d.user_id
      where d.id = driver_wallets.driver_id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists "driver_reads_own_wallet_transactions" on public.driver_wallet_transactions;
create policy "driver_reads_own_wallet_transactions"
  on public.driver_wallet_transactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      join public.users u on u.id = d.user_id
      where d.id = driver_wallet_transactions.driver_id
        and u.auth_user_id = auth.uid()
    )
  );

-- Wallet mutation remains server-side only.
revoke insert, update, delete on public.driver_wallets from anon, authenticated;
revoke insert, update, delete on public.driver_wallet_transactions from anon, authenticated;
grant select on public.driver_wallets to authenticated;
grant select on public.driver_wallet_transactions to authenticated;

do $verify$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'cancellation_fees'
      and indexname = 'cancellation_fees_one_per_ride_uidx'
  ) then
    raise exception 'cancellation idempotency migration incomplete: unique index missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'driver_wallets'
      and policyname = 'driver_reads_own_wallet'
      and qual like '%auth_user_id%auth.uid()%'
  ) then
    raise exception 'driver wallet identity migration incomplete: wallet policy not AUTH -> DOMAIN -> DRIVER aware';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'driver_wallet_transactions'
      and policyname = 'driver_reads_own_wallet_transactions'
      and qual like '%auth_user_id%auth.uid()%'
  ) then
    raise exception 'driver wallet identity migration incomplete: transaction policy not AUTH -> DOMAIN -> DRIVER aware';
  end if;
end
$verify$;

commit;
