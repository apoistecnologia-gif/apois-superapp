create or replace function public.handle_completed_ride_settlement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_method text;
  v_amount numeric(12,2);
begin
  if new.status::text = 'finalizada'
     and old.status::text is distinct from 'finalizada' then
    perform public.ensure_ride_settlement(new.id);

    v_method := lower(trim(coalesce(new.payment_method, '')));
    v_amount := round(coalesce(new.final_price, new.estimated_price), 2);

    -- Dinheiro e cartão de crédito são recebidos diretamente pelo motorista.
    -- Ao finalizar a corrida, o registro financeiro fica encerrado sem criar
    -- crédito na carteira APOIS e sem receita/comissão da plataforma.
    if v_method in ('cash', 'dinheiro', 'money', 'credit', 'credit_card', 'cartao_credito') then
      if v_amount is null or v_amount <= 0 then
        raise exception 'invalid_completed_ride_amount';
      end if;

      update public.ride_settlements
      set driver_id = new.driver_id,
          gross_amount = v_amount,
          passenger_charge = v_amount,
          platform_fee = 0,
          driver_earning = v_amount,
          payment_provider_fee = 0,
          cash_amount = case when v_method in ('cash','dinheiro','money') then v_amount else 0 end,
          wallet_amount = 0,
          refunded_amount = coalesce(refunded_amount, 0),
          payment_method = case when v_method in ('cash','dinheiro','money') then 'cash' else 'credit' end,
          payment_provider = null,
          provider_payment_id = null,
          payment_status = 'confirmed',
          status = 'settled',
          settled_at = coalesce(settled_at, now()),
          updated_at = now()
      where ride_id = new.id;

      update public.rides
      set payment_status = 'paid',
          payment_confirmed_at = coalesce(payment_confirmed_at, now()),
          updated_at = now()
      where id = new.id
        and payment_status is distinct from 'paid';

      insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values(
        auth.uid(),
        'ride.direct_driver_payment_settled',
        'ride',
        new.id::text,
        jsonb_build_object(
          'driver_id', new.driver_id,
          'amount', v_amount,
          'payment_method', case when v_method in ('cash','dinheiro','money') then 'cash' else 'credit' end,
          'platform_fee', 0,
          'wallet_credit_created', false
        )
      );
    end if;
  end if;
  return new;
end;
$$;
