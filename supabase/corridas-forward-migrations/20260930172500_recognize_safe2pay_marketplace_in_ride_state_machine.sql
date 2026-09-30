-- Recognize Safe2Pay marketplace as the canonical prepaid Pix ride flow.
-- Forward-only. Keeps legacy Mercado Pago rows compatible without re-enabling it
-- as a target provider for new charges.

create or replace function private.enforce_prepaid_pix_dispatch_gate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function private.enforce_ride_state_machine()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function apois_rpc_private.driver_accept_ride(_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'apois_rpc_private'
as $function$
declare
  v_profile_id uuid;
  v_result jsonb;
  v_payment_flow text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_profile_id := public.mobility_user_id();

  if not exists (
    select 1
    from public.rides r
    where r.id = _ride_id
      and r.status = 'procurar_motorista'
      and r.driver_id is null
      and r.accepted_driver_id is null
      and v_profile_id = any(coalesce(r.offered_driver_ids, '{}'::uuid[]))
      and not (v_profile_id = any(coalesce(r.rejected_driver_ids, '{}'::uuid[])))
      and (r.request_expires_at is null or r.request_expires_at > now())
  ) then
    raise exception 'ride_offer_unavailable';
  end if;

  update public.rides
  set candidate_driver_ids = case
    when v_profile_id = any(coalesce(candidate_driver_ids, '{}'::uuid[]))
      then candidate_driver_ids
    else array_append(coalesce(candidate_driver_ids, '{}'::uuid[]), v_profile_id)
  end
  where id = _ride_id;

  select coalesce(r.service_details->>'payment_flow','')
    into v_payment_flow
  from public.rides r
  where r.id = _ride_id;

  v_result := apois_rpc_private.driver_accept_ride_candidate_legacy(_ride_id);

  if v_payment_flow in ('safe2pay_marketplace','mercadopago_marketplace') then
    update public.rides
    set payment_method = 'pix',
        payment_provider = case
          when v_payment_flow = 'safe2pay_marketplace' then 'safe2pay'
          else 'mercadopago'
        end,
        payment_status = case when payment_status = 'paid' then 'paid' else 'pending' end,
        updated_at = now()
    where id = _ride_id
    returning to_jsonb(rides.*) into v_result;
  end if;

  return v_result;
end;
$function$;
