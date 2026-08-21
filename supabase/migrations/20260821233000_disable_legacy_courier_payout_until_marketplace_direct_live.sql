insert into public.platform_settings(key,value,description,updated_at)
values (
  'courier_payout_mode',
  '"marketplace_direct_pending"'::jsonb,
  'Repasse do entregador será feito por fluxo direto de marketplace; saques legados ficam bloqueados até homologação do provedor.',
  now()
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

revoke execute on function public.request_payout(uuid,numeric,text) from authenticated;
revoke execute on function public.request_payout(uuid,numeric,text) from anon;
revoke execute on function public.request_payout(uuid,numeric,text) from public;
grant execute on function public.request_payout(uuid,numeric,text) to service_role;

create or replace function public.get_courier_payout_readiness()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_courier_id uuid;
  v_mode text := 'marketplace_direct_pending';
begin
  if not public.current_user_is_active() then
    raise exception 'active account required';
  end if;

  select c.id
    into v_courier_id
  from public.couriers c
  where c.user_id = (select auth.uid())
    and c.status = 'approved'
    and c.is_active = true
  limit 1;

  if v_courier_id is null then
    raise exception 'eligible courier required';
  end if;

  select coalesce(nullif(trim(both '"' from ps.value::text), ''), v_mode)
    into v_mode
  from public.platform_settings ps
  where ps.key = 'courier_payout_mode';

  v_mode := coalesce(v_mode, 'marketplace_direct_pending');

  return jsonb_build_object(
    'mode', v_mode,
    'can_request_payout', v_mode = 'wallet_payout_live',
    'direct_marketplace_live', v_mode = 'marketplace_direct_live',
    'message', case
      when v_mode = 'marketplace_direct_live' then 'Os ganhos são destinados diretamente ao entregador pelo provedor financeiro.'
      when v_mode = 'wallet_payout_live' then 'Saques da carteira estão liberados.'
      else 'O recebimento direto do entregador está em homologação. Seus ganhos continuam registrados, mas o app não permite solicitar saque.'
    end
  );
end;
$$;

revoke all on function public.get_courier_payout_readiness() from public;
revoke all on function public.get_courier_payout_readiness() from anon;
grant execute on function public.get_courier_payout_readiness() to authenticated;
grant execute on function public.get_courier_payout_readiness() to service_role;
