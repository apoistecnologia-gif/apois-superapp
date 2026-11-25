-- Exact selected function bodies read from production catalog. Disposable fixture only.
CREATE OR REPLACE FUNCTION public.apois_enforce_passenger_operational_status_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_user public.users%rowtype;
begin
  select * into v_user from public.users where id=new.passenger_id;
  if not found then raise exception 'passenger_not_found' using errcode='P0002'; end if;
  if v_user.deleted_at is not null then raise exception 'passenger_account_deleted' using errcode='42501'; end if;
  if v_user.blocked_at is not null then raise exception 'passenger_account_blocked' using errcode='42501'; end if;
  if v_user.suspended_at is not null and (v_user.suspended_until is null or v_user.suspended_until>now()) then
    raise exception 'passenger_account_suspended' using errcode='42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apois_enforce_passenger_ride_financial_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.apois_lock_passenger_ride_financial_gate(new.passenger_id);

  if exists (
    select 1
    from public.cancellation_fees cf
    where cf.passenger_id = new.passenger_id
      and cf.is_paid is not true
      and cf.paid_at is null
      and lower(coalesce(cf.status, 'pending')) not in (
        'paid', 'pago', 'cancelled', 'canceled', 'cancelada',
        'waived', 'forgiven', 'perdoada'
      )
  ) then
    raise exception 'passenger_cancellation_fee_pending' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apois_lock_passenger_ride_financial_gate(_passenger_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if _passenger_id is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('apois:ride-financial-gate:' || _passenger_id::text, 0));
end;
$function$;

CREATE OR REPLACE FUNCTION private.calculate_electronic_processing_fee_cents(_fare_cents bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
declare
  v_fee bigint;
begin
  if _fare_cents <= 0 then
    raise exception 'invalid_fare_cents' using errcode='22023';
  end if;

  -- The passenger processing fee grosses up an 0.80% provider cost so the
  -- ride fare itself remains whole for the driver: fee = fare / 124.
  v_fee := ceil(_fare_cents::numeric / 124)::bigint;
  return greatest(50::bigint, least(500::bigint, v_fee));
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_prepaid_pix_dispatch_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_marketplace boolean := coalesce(new.service_details->>'payment_flow','')
    in ('safe2pay_marketplace','mercadopago_marketplace');
begin
  if lower(coalesce(new.payment_method,'')) = 'pix'
     and coalesce(new.payment_status,'') <> 'paid' then
    if v_marketplace then
      if new.status in ('motorista_a_caminho','motorista_chegou','em_viagem') then
        raise exception 'pix_payment_required_before_driver_departure' using errcode='23514';
      end if;
    elsif new.status in ('procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem') then
      raise exception 'pix_payment_required_before_dispatch' using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_prepaid_pix_provider_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_target text;
begin
  if lower(coalesce(new.payment_method,'')) <> 'pix' then
    return new;
  end if;

  select nullif(lower(btrim(coalesce(s.value #>> '{}',''))), '')
    into v_target
  from public.app_settings s
  where s.key = 'finance.target_electronic_payment_provider'
  limit 1;

  if v_target is null or v_target = 'disabled' then
    raise exception 'electronic_payment_provider_not_configured' using errcode='55000';
  end if;

  if tg_op = 'INSERT' then
    new.payment_provider := v_target;
    return new;
  end if;

  if nullif(lower(btrim(coalesce(new.payment_provider,''))), '') is distinct from v_target then
    raise exception 'electronic_payment_provider_mismatch' using errcode='23514';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_ride_electronic_payment_homologation_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  gate_enabled boolean := false;
  raw_gate jsonb;
begin
  -- Dinheiro e cartão são recebidos diretamente pelo motorista.
  -- Apenas PIX usa trilho eletrônico da APOIS e permanece atrás do gate.
  if lower(coalesce(new.payment_method, '')) <> 'pix' then
    return new;
  end if;

  select s.value
    into raw_gate
  from public.app_settings s
  where s.key = 'finance.ride_electronic_payments_enabled'
  limit 1;

  gate_enabled := case
    when raw_gate is null then false
    when jsonb_typeof(raw_gate) = 'boolean' then coalesce((raw_gate #>> '{}')::boolean, false)
    when jsonb_typeof(raw_gate) = 'string' then lower(coalesce(raw_gate #>> '{}', '')) in ('true', '1', 'yes', 'on')
    when jsonb_typeof(raw_gate) = 'number' then coalesce((raw_gate #>> '{}')::numeric, 0) <> 0
    else false
  end;

  if gate_enabled is not true then
    raise exception 'ride_electronic_payments_not_homologated'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_ride_state_machine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_allowed boolean := false;
  v_marketplace boolean := coalesce(new.service_details->>'payment_flow','')
    in ('safe2pay_marketplace','mercadopago_marketplace');
begin
  if tg_op = 'INSERT' then
    if new.status not in ('agendada', 'aguardando_pagamento', 'procurar_motorista') then
      raise exception 'invalid_initial_ride_status:%', new.status using errcode = '23514';
    end if;
  elsif new.status is distinct from old.status then
    if old.status in ('finalizada', 'cancelada_passageiro', 'cancelada_motorista', 'expired') then
      raise exception 'terminal_ride_cannot_transition:%->%', old.status, new.status using errcode = '23514';
    end if;

    v_allowed := case old.status
      when 'agendada' then new.status in ('procurar_motorista', 'cancelada_passageiro', 'expired')
      when 'aguardando_pagamento' then new.status in ('procurar_motorista', 'motorista_a_caminho', 'cancelada_passageiro', 'expired')
      when 'procurar_motorista' then new.status in ('aguardando_pagamento', 'motorista_a_caminho', 'cancelada_passageiro', 'expired')
      when 'motorista_a_caminho' then new.status in ('motorista_chegou', 'procurar_motorista', 'cancelada_passageiro')
      when 'motorista_chegou' then new.status in ('em_viagem', 'procurar_motorista', 'cancelada_motorista')
      when 'em_viagem' then new.status = 'finalizada'
      else false
    end;

    if not v_allowed then
      raise exception 'invalid_ride_transition:%->%', old.status, new.status using errcode = '23514';
    end if;
  end if;

  if new.status = 'agendada' then
    if new.driver_id is not null or new.accepted_driver_id is not null then
      raise exception 'ride_stage_forbids_driver:%', new.status using errcode = '23514';
    end if;
  elsif new.status = 'aguardando_pagamento' then
    if v_marketplace then
      if new.driver_id is null
         or new.accepted_driver_id is distinct from new.driver_id
         or new.accepted_at is null
         or new.queued_after_ride_id is not null then
        raise exception 'marketplace_payment_wait_driver_metadata_inconsistent' using errcode = '23514';
      end if;
    elsif new.driver_id is not null or new.accepted_driver_id is not null then
      raise exception 'ride_stage_forbids_driver:%', new.status using errcode = '23514';
    end if;
  elsif new.status = 'procurar_motorista' then
    if new.driver_id is null then
      if new.accepted_driver_id is not null or new.queued_after_ride_id is not null then
        raise exception 'searching_ride_driver_metadata_inconsistent' using errcode = '23514';
      end if;
    else
      if new.accepted_driver_id is distinct from new.driver_id
         or new.queued_after_ride_id is null then
        raise exception 'queued_ride_driver_metadata_inconsistent' using errcode = '23514';
      end if;
    end if;
  elsif new.status = 'motorista_a_caminho' then
    if new.driver_id is null
       or new.accepted_driver_id is distinct from new.driver_id
       or new.accepted_at is null
       or new.queued_after_ride_id is not null then
      raise exception 'accepted_ride_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'motorista_chegou' then
    if new.driver_id is null
       or new.accepted_driver_id is distinct from new.driver_id
       or new.accepted_at is null
       or new.driver_arrived_at is null then
      raise exception 'arrived_ride_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'em_viagem' then
    if new.driver_id is null
       or new.accepted_driver_id is distinct from new.driver_id
       or new.accepted_at is null
       or new.driver_arrived_at is null
       or new.started_at is null then
      raise exception 'in_progress_ride_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'finalizada' then
    if new.driver_id is null
       or new.accepted_driver_id is distinct from new.driver_id
       or new.started_at is null
       or new.completed_at is null then
      raise exception 'completed_ride_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'cancelada_passageiro' then
    if new.cancelled_at is null or new.cancelled_by <> 'passenger' then
      raise exception 'passenger_cancel_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'cancelada_motorista' then
    if new.cancelled_at is null or new.cancelled_by <> 'driver' then
      raise exception 'driver_cancel_metadata_inconsistent' using errcode = '23514';
    end if;
  elsif new.status = 'expired' then
    if new.cancelled_at is null or new.cancelled_by <> 'system' then
      raise exception 'expired_ride_metadata_inconsistent' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.stamp_ride_financial_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_fare_cents bigint;
  v_fee_cents bigint;
  v_provider text;
begin
  if new.estimated_price is null or new.estimated_price <= 0 then
    raise exception 'invalid_estimated_price' using errcode='22023';
  end if;

  v_fare_cents := round(new.estimated_price * 100)::bigint;
  if v_fare_cents <= 0 then
    raise exception 'invalid_fare_cents' using errcode='22023';
  end if;

  v_provider := lower(btrim(coalesce(new.payment_provider,'')));
  v_fee_cents := case
    when lower(coalesce(new.payment_method,'')) = 'pix' and v_provider <> 'mercadopago'
      then private.calculate_electronic_processing_fee_cents(v_fare_cents)
    else 0
  end;

  new.fare_amount_cents := v_fare_cents;
  new.processing_fee_cents := v_fee_cents;
  new.passenger_charge_cents := v_fare_cents + v_fee_cents;
  return new;
end;
$function$;
create trigger trg_apois_enforce_passenger_operational_status_gate before insert or update of passenger_id on public.rides for each row execute function public.apois_enforce_passenger_operational_status_gate();
create trigger trg_apois_enforce_passenger_ride_financial_gate before insert or update of passenger_id on public.rides for each row execute function public.apois_enforce_passenger_ride_financial_gate();
create trigger trg_enforce_prepaid_pix_dispatch_gate before insert or update of status, payment_method, payment_status on public.rides for each row execute function private.enforce_prepaid_pix_dispatch_gate();
create trigger trg_enforce_prepaid_pix_provider_target before insert or update of payment_method, payment_provider on public.rides for each row execute function private.enforce_prepaid_pix_provider_target();
create trigger trg_enforce_ride_electronic_payment_homologation_gate before insert or update of payment_method on public.rides for each row execute function private.enforce_ride_electronic_payment_homologation_gate();
create trigger trg_rides_state_machine before insert or update of status, driver_id, accepted_driver_id, queued_after_ride_id, accepted_at, driver_arrived_at, started_at, completed_at, cancelled_at, cancelled_by on public.rides for each row execute function private.enforce_ride_state_machine();
create trigger trg_stamp_ride_financial_snapshot before insert or update of estimated_price, payment_method on public.rides for each row execute function private.stamp_ride_financial_snapshot();
