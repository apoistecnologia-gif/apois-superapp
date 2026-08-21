create or replace function public.enforce_delivery_financial_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := 'marketplace_direct_pending';
begin
  if new.fulfillment_type = 'delivery' then
    select coalesce(nullif(trim(both '"' from ps.value::text), ''), v_mode)
      into v_mode
    from public.platform_settings ps
    where ps.key = 'courier_payout_mode';

    v_mode := coalesce(v_mode, 'marketplace_direct_pending');

    if v_mode <> 'marketplace_direct_live' then
      raise exception 'delivery is unavailable: courier marketplace payout not live';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_require_delivery_financial_readiness on public.orders;
create trigger orders_require_delivery_financial_readiness
before insert on public.orders
for each row
execute function public.enforce_delivery_financial_readiness();

revoke all on function public.enforce_delivery_financial_readiness() from public;
revoke all on function public.enforce_delivery_financial_readiness() from anon;
revoke all on function public.enforce_delivery_financial_readiness() from authenticated;
grant execute on function public.enforce_delivery_financial_readiness() to service_role;
