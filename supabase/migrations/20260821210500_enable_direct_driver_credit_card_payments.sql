-- CORRIDAS: PIX continua digital via Mercado Pago.
-- Dinheiro e cartão de crédito são recebidos diretamente pelo motorista.
-- APOIS não processa nem retém comissão sobre esses pagamentos diretos.

update public.payment_methods
set is_active = true,
    name = 'Cartão de crédito',
    description = 'Pague diretamente ao motorista com cartão de crédito'
where code = 'credit';

update public.payment_methods
set description = 'Pague diretamente ao motorista ao final da corrida'
where code = 'cash';

create or replace function public.get_passenger_payment_methods()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  icon text,
  requires_balance boolean,
  is_active boolean,
  sort_order integer,
  enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pm.id,
    pm.code,
    pm.name,
    pm.description,
    pm.icon,
    pm.requires_balance,
    pm.is_active,
    pm.sort_order,
    case
      when pm.code in ('cash','credit') then true
      when pm.code = 'pix' then public.is_passenger_ride_pix_enabled()
      else false
    end as enabled
  from public.payment_methods pm
  where pm.is_active = true
    and auth.role() in ('authenticated', 'service_role')
  order by pm.sort_order asc;
$$;

revoke all on function public.get_passenger_payment_methods() from public, anon;
grant execute on function public.get_passenger_payment_methods() to authenticated, service_role;
