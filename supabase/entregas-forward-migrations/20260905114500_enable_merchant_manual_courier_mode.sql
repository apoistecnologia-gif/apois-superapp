-- Forward-only product switch for the already-versioned manual courier settlement model.
-- DO NOT apply automatically from the Superapp build.
-- This intentionally enables delivery WITHOUT a payment gateway: the merchant pays
-- each courier directly outside APOIS and the platform only tracks settlement status.

begin;

do $$
begin
  if to_regclass('public.courier_settlements') is null then
    raise exception 'courier_settlements migration must be applied before merchant_manual mode';
  end if;
  if to_regprocedure('public.get_delivery_checkout_readiness()') is null then
    raise exception 'delivery checkout readiness function missing';
  end if;
  if to_regprocedure('public.close_courier_settlements(uuid)') is null then
    raise exception 'manual courier settlement functions missing';
  end if;
  if to_regprocedure('public.courier_confirm_courier_settlement(uuid)') is null then
    raise exception 'courier settlement confirmation function missing';
  end if;
end;
$$;

-- The pinned base migration already derives the courier from auth and verifies
-- settlement ownership. This forward replacement preserves that contract and makes
-- a retry by the same courier idempotent: a network retry after a successful confirm
-- returns the already-confirmed row instead of surfacing a false failure.
create or replace function public.courier_confirm_courier_settlement(_settlement_id uuid)
returns public.courier_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement public.courier_settlements;
  v_courier_id uuid := public.current_user_courier_id();
begin
  if v_courier_id is null then
    raise exception 'eligible courier required';
  end if;

  select * into v_settlement
  from public.courier_settlements s
  where s.id = _settlement_id
  for update;

  if not found then
    raise exception 'settlement not found';
  end if;
  if v_settlement.courier_id <> v_courier_id then
    raise exception 'settlement does not belong to courier';
  end if;

  -- Safe retry after the same actor has already confirmed this settlement.
  if v_settlement.status = 'confirmed' then
    return v_settlement;
  end if;

  if v_settlement.status <> 'merchant_marked_paid' then
    raise exception 'settlement is not awaiting courier confirmation';
  end if;

  update public.courier_settlements
  set status = 'confirmed',
      courier_confirmed_at = coalesce(courier_confirmed_at, now()),
      updated_at = now()
  where id = _settlement_id
    and courier_id = v_courier_id
    and status = 'merchant_marked_paid'
  returning * into v_settlement;

  if not found then
    raise exception 'settlement changed concurrently';
  end if;

  return v_settlement;
end;
$$;

revoke all on function public.courier_confirm_courier_settlement(uuid) from public, anon;
grant execute on function public.courier_confirm_courier_settlement(uuid) to authenticated, service_role;

insert into public.platform_settings(key, value)
values ('courier_payout_mode', '"merchant_manual"'::jsonb)
on conflict (key) do update
set value = excluded.value;

commit;
