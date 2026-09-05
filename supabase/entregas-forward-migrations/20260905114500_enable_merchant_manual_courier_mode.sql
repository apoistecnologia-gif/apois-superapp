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
end;
$$;

insert into public.platform_settings(key, value)
values ('courier_payout_mode', '"merchant_manual"'::jsonb)
on conflict (key) do update
set value = excluded.value;

commit;
