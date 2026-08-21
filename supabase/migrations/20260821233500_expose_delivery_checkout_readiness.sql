create or replace function public.get_delivery_checkout_readiness()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := 'marketplace_direct_pending';
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select coalesce(nullif(trim(both '"' from ps.value::text), ''), v_mode)
    into v_mode
  from public.platform_settings ps
  where ps.key = 'courier_payout_mode';

  v_mode := coalesce(v_mode, 'marketplace_direct_pending');

  return jsonb_build_object(
    'delivery_available', v_mode = 'marketplace_direct_live',
    'mode', v_mode,
    'message', case
      when v_mode = 'marketplace_direct_live'
        then 'Entrega disponível.'
      else 'A entrega está temporariamente indisponível enquanto o recebimento direto dos entregadores é finalizado. Você ainda pode escolher retirada quando o estabelecimento oferecer essa opção.'
    end
  );
end;
$$;

revoke all on function public.get_delivery_checkout_readiness() from public;
revoke all on function public.get_delivery_checkout_readiness() from anon;
grant execute on function public.get_delivery_checkout_readiness() to authenticated;
grant execute on function public.get_delivery_checkout_readiness() to service_role;
