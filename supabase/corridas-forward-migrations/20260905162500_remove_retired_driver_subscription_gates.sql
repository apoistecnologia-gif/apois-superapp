-- Forward-only release migration. DO NOT rewrite historical migrations.
-- Current APOIS policy has no contracted electronic membership/payment provider.
-- Driver operational eligibility remains backend-authoritative and continues to
-- require a valid domain identity, driver profile, approval, no administrative
-- suspension/block, KYC when entering operation, online state and fresh GPS.
-- subscription_status remains historical data only and MUST NOT gate rides.

create or replace function apois_rpc_private.driver_set_presence(
  _online boolean,
  _lat numeric,
  _lng numeric,
  _heading numeric,
  _speed numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile_id uuid;
  v_driver public.drivers%rowtype;
  v_active_in_trip boolean := false;
  v_operationally_eligible boolean := false;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;

  v_profile_id := public.mobility_user_id();
  if v_profile_id is null then raise exception 'profile_missing'; end if;

  select * into v_driver
  from public.drivers
  where user_id = v_profile_id
  for update;
  if not found then raise exception 'driver_profile_missing'; end if;

  select exists(
    select 1 from public.rides r
    where r.driver_id = v_driver.id and r.status = 'em_viagem'
  ) into v_active_in_trip;

  v_operationally_eligible :=
    v_driver.approval_status = 'aprovado'
    and v_driver.suspended_at is null
    and v_driver.blocked_at is null;

  if coalesce(_online,false) then
    if not v_operationally_eligible and not v_active_in_trip then
      if v_driver.approval_status <> 'aprovado' then raise exception 'driver_not_approved'; end if;
      if v_driver.suspended_at is not null then raise exception 'driver_suspended'; end if;
      if v_driver.blocked_at is not null then raise exception 'driver_blocked'; end if;
      raise exception 'driver_not_eligible';
    end if;

    if v_operationally_eligible
       and not coalesce(v_driver.is_online,false)
       and not private.driver_kyc_is_ready(v_driver.id) then
      raise exception 'driver_kyc_incomplete' using errcode='42501';
    end if;

    if _lat is null or _lng is null
       or _lat::text = 'NaN' or _lng::text = 'NaN'
       or _lat < -34 or _lat > 6
       or _lng < -74 or _lng > -32 then
      raise exception 'invalid_location';
    end if;
    if _heading is not null and (_heading::text='NaN' or _heading < 0 or _heading >= 360) then
      raise exception 'invalid_heading';
    end if;
    if _speed is not null and (_speed::text='NaN' or _speed < 0) then
      raise exception 'invalid_speed';
    end if;
  end if;

  update public.drivers
  set is_online = case when coalesce(_online,false) and v_operationally_eligible then true else false end,
      current_lat = case when coalesce(_online,false) then _lat else current_lat end,
      current_lng = case when coalesce(_online,false) then _lng else current_lng end,
      current_heading = case when coalesce(_online,false) then _heading else current_heading end,
      current_speed = case when coalesce(_online,false) then _speed else current_speed end,
      last_location_at = case when coalesce(_online,false) then now() else last_location_at end,
      updated_at = now()
  where id = v_driver.id
  returning * into v_driver;

  return to_jsonb(v_driver) || jsonb_build_object(
    'tracking_active_ride', v_active_in_trip,
    'operationally_eligible', v_operationally_eligible
  );
end;
$function$;

create or replace function apois_rpc_private.driver_accept_ride(_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, apois_rpc_private
as $function$
declare
  v_profile_id uuid;
  v_method text;
  v_flow text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  v_profile_id := public.mobility_user_id();
  if v_profile_id is null then raise exception 'driver_profile_missing' using errcode='42501'; end if;

  select lower(btrim(coalesce(r.payment_method,''))), coalesce(r.service_details->>'payment_flow','')
    into v_method, v_flow
  from public.rides r
  where r.id = _ride_id
    and r.status = 'procurar_motorista'
    and r.driver_id is null
    and r.accepted_driver_id is null
    and v_profile_id = any(coalesce(r.offered_driver_ids,'{}'::uuid[]))
    and not (v_profile_id = any(coalesce(r.rejected_driver_ids,'{}'::uuid[])))
    and (r.request_expires_at is null or r.request_expires_at > now());
  if not found then raise exception 'ride_offer_unavailable'; end if;

  if v_method not in ('cash','dinheiro','money','credit','credit_card','cartao_credito') then
    raise exception 'electronic_payment_not_configured' using errcode='55000';
  end if;
  if v_flow in ('mercadopago_marketplace','asaas','pagbank','openpix') then
    raise exception 'retired_payment_flow_not_supported' using errcode='55000';
  end if;

  update public.rides
  set candidate_driver_ids = case
    when v_profile_id = any(coalesce(candidate_driver_ids,'{}'::uuid[])) then candidate_driver_ids
    else array_append(coalesce(candidate_driver_ids,'{}'::uuid[]),v_profile_id)
  end
  where id = _ride_id;

  v_result := apois_rpc_private.driver_accept_ride_candidate_legacy(_ride_id);
  return v_result;
end;
$function$;

create or replace function apois_rpc_private.driver_accept_ride_candidate_legacy(_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_profile_id uuid;
  v_driver public.drivers%rowtype;
  v_ride public.rides%rowtype;
  v_current public.rides%rowtype;
  v_radius_km numeric := 5;
  v_distance_km numeric;
  v_public_driver_name text;
  v_method text;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  v_profile_id := public.mobility_user_id();
  if v_profile_id is null then raise exception 'driver_profile_missing' using errcode='42501'; end if;

  select * into v_driver from public.drivers where user_id=v_profile_id for update;
  if not found then raise exception 'driver_profile_missing'; end if;
  if v_driver.approval_status <> 'aprovado' then raise exception 'driver_not_approved'; end if;
  if v_driver.suspended_at is not null then raise exception 'driver_suspended'; end if;
  if v_driver.blocked_at is not null then raise exception 'driver_blocked'; end if;
  if not v_driver.is_online then raise exception 'driver_offline'; end if;
  if not private.driver_kyc_is_ready(v_driver.id) then raise exception 'driver_kyc_incomplete' using errcode='42501'; end if;

  v_public_driver_name := nullif(split_part(trim(coalesce(v_driver.name,'')),' ',1),'');

  select * into v_ride from public.rides where id=_ride_id for update;
  if not found
     or v_ride.status <> 'procurar_motorista'
     or v_ride.driver_id is not null
     or not (v_profile_id=any(coalesce(v_ride.candidate_driver_ids,'{}'::uuid[])))
     or (v_profile_id=any(coalesce(v_ride.rejected_driver_ids,'{}'::uuid[])))
     or (v_ride.request_expires_at is not null and v_ride.request_expires_at<=now()) then
    raise exception 'ride_offer_unavailable';
  end if;

  v_method := lower(btrim(coalesce(v_ride.payment_method,'')));
  if v_method not in ('cash','dinheiro','money','credit','credit_card','cartao_credito')
     or coalesce(v_ride.service_details->>'payment_flow','') in ('mercadopago_marketplace','asaas','pagbank','openpix') then
    raise exception 'electronic_payment_not_configured' using errcode='55000';
  end if;

  select * into v_current
  from public.rides
  where driver_id=v_driver.id
    and status in ('motorista_a_caminho','motorista_chegou','em_viagem')
    and id<>_ride_id
  order by created_at desc
  limit 1
  for update;

  if found and v_current.status in ('motorista_a_caminho','motorista_chegou') then
    raise exception 'driver_busy';
  end if;

  if found and v_current.status='em_viagem' then
    if exists(select 1 from public.rides q where q.driver_id=v_driver.id and q.status='procurar_motorista' and q.queued_after_ride_id is not null and q.id<>_ride_id) then
      raise exception 'next_ride_already_reserved';
    end if;
    if v_current.destination_lat is null or v_current.destination_lng is null or v_ride.origin_lat is null or v_ride.origin_lng is null then
      raise exception 'next_ride_location_unavailable';
    end if;
    begin
      select coalesce((value #>> '{}')::numeric,5) into v_radius_km
      from public.app_settings where key='ride.next_offer_max_distance_km';
    exception when others then v_radius_km:=5;
    end;
    v_radius_km:=greatest(0.5,least(coalesce(v_radius_km,5),20));
    v_distance_km:=6371*acos(least(1,greatest(-1,
      cos(radians(v_ride.origin_lat::double precision))*cos(radians(v_current.destination_lat::double precision))*
      cos(radians(v_current.destination_lng::double precision)-radians(v_ride.origin_lng::double precision))+
      sin(radians(v_ride.origin_lat::double precision))*sin(radians(v_current.destination_lat::double precision)))));
    if v_distance_km>v_radius_km then raise exception 'next_ride_not_nearby'; end if;

    update public.rides
    set driver_id=v_driver.id,accepted_driver_id=v_driver.id,queued_after_ride_id=v_current.id,queued_at=now(),
        request_expires_at=null,search_expires_at=null,current_offer_driver_id=null,
        driver_name=v_public_driver_name,driver_photo=v_driver.photo_url,driver_phone=v_driver.phone,
        driver_vehicle_model=v_driver.vehicle_model,driver_vehicle_color=v_driver.vehicle_color,
        driver_vehicle_plate=v_driver.vehicle_plate,driver_rating=v_driver.rating,
        cancellation_reason=null,cancelled_by=null,cancelled_at=null,updated_at=now()
    where id=_ride_id and status='procurar_motorista' and driver_id is null
    returning * into v_ride;
    if not found then raise exception 'ride_offer_unavailable'; end if;
    return to_jsonb(v_ride);
  end if;

  update public.rides
  set status='motorista_a_caminho',driver_id=v_driver.id,accepted_driver_id=v_driver.id,accepted_at=now(),
      current_offer_driver_id=null,request_expires_at=null,search_expires_at=null,
      security_code=coalesce(security_code,lpad((floor(random()*10000))::int::text,4,'0')),
      driver_name=v_public_driver_name,driver_photo=v_driver.photo_url,driver_phone=v_driver.phone,
      driver_vehicle_model=v_driver.vehicle_model,driver_vehicle_color=v_driver.vehicle_color,
      driver_vehicle_plate=v_driver.vehicle_plate,driver_rating=v_driver.rating,
      driver_latitude=v_driver.current_lat,driver_longitude=v_driver.current_lng,driver_heading=v_driver.current_heading,
      cancellation_reason=null,cancelled_by=null,cancelled_at=null,updated_at=now()
  where id=_ride_id and status='procurar_motorista' and driver_id is null
  returning * into v_ride;
  if not found then raise exception 'ride_offer_unavailable'; end if;
  return to_jsonb(v_ride);
end;
$function$;

create or replace function private.enforce_driver_operational_stage_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_driver public.drivers%rowtype;
begin
  if new.status is not distinct from old.status or new.status not in ('motorista_a_caminho','motorista_chegou','em_viagem') then return new; end if;
  if new.driver_id is null then raise exception 'driver_required_for_ride_stage' using errcode='55000'; end if;
  select * into v_driver from public.drivers d where d.id=new.driver_id;
  if not found then raise exception 'driver_profile_missing' using errcode='55000'; end if;
  if v_driver.approval_status <> 'aprovado' then raise exception 'driver_not_approved' using errcode='55000'; end if;
  if v_driver.suspended_at is not null then raise exception 'driver_suspended' using errcode='55000'; end if;
  if v_driver.blocked_at is not null then raise exception 'driver_blocked' using errcode='55000'; end if;
  if not private.driver_kyc_is_ready(v_driver.id) then raise exception 'driver_kyc_incomplete' using errcode='55000'; end if;
  if v_driver.is_online is not true then raise exception 'driver_offline' using errcode='55000'; end if;
  return new;
end;
$function$;

create or replace function public.append_nearby_busy_driver_candidates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare v_radius_km numeric:=5; v_extra uuid[]:='{}'::uuid[];
begin
  if new.status<>'procurar_motorista' or new.driver_id is not null or new.origin_lat is null or new.origin_lng is null then return new; end if;
  begin
    select coalesce((value #>> '{}')::numeric,5) into v_radius_km from public.app_settings where key='ride.next_offer_max_distance_km';
  exception when others then v_radius_km:=5;
  end;
  v_radius_km:=greatest(0.5,least(coalesce(v_radius_km,5),20));

  select coalesce(array_agg(x.user_id),'{}'::uuid[]) into v_extra from (
    select d.user_id
    from public.drivers d
    where d.is_online=true
      and d.approval_status='aprovado'
      and d.suspended_at is null
      and d.blocked_at is null
      and private.driver_kyc_is_ready(d.id)
      and d.category=new.category
      and d.current_lat is not null and d.current_lng is not null
      and d.last_location_at is not null and d.last_location_at>=now()-interval '120 seconds'
      and not (d.user_id=any(coalesce(new.rejected_driver_ids,'{}'::uuid[])))
      and exists(select 1 from public.rides current_ride where current_ride.driver_id=d.id and current_ride.status='em_viagem')
      and not exists(select 1 from public.rides queued_ride where queued_ride.driver_id=d.id and queued_ride.status='procurar_motorista' and queued_ride.queued_after_ride_id is not null)
      and (6371*acos(least(1,greatest(-1,
        cos(radians(new.origin_lat::double precision))*cos(radians(d.current_lat::double precision))*
        cos(radians(d.current_lng::double precision)-radians(new.origin_lng::double precision))+
        sin(radians(new.origin_lat::double precision))*sin(radians(d.current_lat::double precision))))))<=v_radius_km
    order by (6371*acos(least(1,greatest(-1,
      cos(radians(new.origin_lat::double precision))*cos(radians(d.current_lat::double precision))*
      cos(radians(d.current_lng::double precision)-radians(new.origin_lng::double precision))+
      sin(radians(new.origin_lat::double precision))*sin(radians(d.current_lat::double precision)))))) asc
    limit 5
  ) x;

  if cardinality(v_extra)>0 then
    select coalesce(array_agg(distinct candidate_id),'{}'::uuid[]) into new.candidate_driver_ids
    from unnest(coalesce(new.candidate_driver_ids,'{}'::uuid[])||v_extra) candidate_id;
    select coalesce(array_agg(distinct offered_id),'{}'::uuid[]) into new.offered_driver_ids
    from unnest(coalesce(new.offered_driver_ids,'{}'::uuid[])||v_extra) offered_id;
  end if;
  return new;
end;
$function$;

create or replace function apois_rpc_private.driver_finish_ride(_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, apois_rpc_private
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_driver public.drivers%rowtype;
  v_ride public.rides%rowtype;
  v_next public.rides%rowtype;
  v_driver_eligible boolean := false;
  v_released_next_id uuid := null;
  v_promoted_next_id uuid := null;
begin
  if v_auth_user_id is null then raise exception 'unauthorized' using errcode='42501'; end if;
  v_profile_id := public.mobility_user_id();
  if v_profile_id is null then raise exception 'driver_profile_missing'; end if;
  select * into v_driver from public.drivers where user_id=v_profile_id for update;
  if not found then raise exception 'driver_profile_missing'; end if;

  update public.rides
  set status='finalizada', final_price=coalesce(final_price,estimated_price), completed_at=now(), updated_at=now()
  where id=_ride_id and driver_id=v_driver.id and status='em_viagem'
  returning * into v_ride;
  if not found then raise exception 'invalid_ride_transition'; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_auth_user_id,'ride.driver_finished','ride',v_ride.id::text,
    jsonb_build_object('driver_id',v_driver.id,'driver_domain_user_id',v_profile_id,'final_price',v_ride.final_price));

  select * into v_next from public.rides
  where driver_id=v_driver.id and accepted_driver_id=v_driver.id and queued_after_ride_id=_ride_id and status='procurar_motorista'
  order by queued_at asc nulls last,created_at asc limit 1 for update;

  if found then
    v_driver_eligible :=
      v_driver.approval_status='aprovado'
      and v_driver.suspended_at is null
      and v_driver.blocked_at is null
      and private.driver_kyc_is_ready(v_driver.id)
      and v_driver.is_online is true
      and v_driver.current_lat is not null and v_driver.current_lng is not null
      and v_driver.current_lat between -34 and 6
      and v_driver.current_lng between -74 and -32
      and v_driver.last_location_at is not null
      and v_driver.last_location_at >= now()-interval '120 seconds'
      and v_driver.last_location_at <= now()+interval '30 seconds';

    if v_driver_eligible then
      update public.rides
      set status='motorista_a_caminho',accepted_at=now(),queued_after_ride_id=null,queued_at=null,
          request_expires_at=null,search_expires_at=null,
          security_code=coalesce(security_code,lpad((floor(random()*10000))::int::text,4,'0')),
          driver_latitude=v_driver.current_lat,driver_longitude=v_driver.current_lng,driver_heading=v_driver.current_heading,updated_at=now()
      where id=v_next.id;
      v_promoted_next_id:=v_next.id;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_auth_user_id,'ride.queued_promoted','ride',v_next.id::text,
        jsonb_build_object('driver_id',v_driver.id,'driver_domain_user_id',v_profile_id,'previous_ride_id',_ride_id));
    else
      update public.rides
      set status='procurar_motorista',driver_id=null,accepted_driver_id=null,accepted_at=null,driver_arrived_at=null,started_at=null,
          current_offer_driver_id=null,driver_name=null,driver_photo=null,driver_phone=null,driver_vehicle_model=null,
          driver_vehicle_color=null,driver_vehicle_plate=null,driver_rating=null,driver_latitude=null,driver_longitude=null,
          driver_heading=null,security_code=null,security_code_failed_attempts=0,security_code_locked_until=null,
          security_code_last_failed_at=null,candidate_driver_ids=array_remove(coalesce(candidate_driver_ids,'{}'::uuid[]),v_profile_id),
          offered_driver_ids='{}'::uuid[],rejected_driver_ids=case when v_profile_id=any(coalesce(rejected_driver_ids,'{}'::uuid[]))
            then coalesce(rejected_driver_ids,'{}'::uuid[]) else array_append(coalesce(rejected_driver_ids,'{}'::uuid[]),v_profile_id) end,
          request_expires_at=null,search_expires_at=case when search_expires_at is null or search_expires_at<=now()
            then now()+interval '8 minutes' else search_expires_at end,queued_after_ride_id=null,queued_at=null,
          cancellation_reason=null,cancelled_by=null,cancelled_at=null,updated_at=now()
      where id=v_next.id;
      v_released_next_id:=v_next.id;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_auth_user_id,'ride.queued_released_ineligible_driver','ride',v_next.id::text,
        jsonb_build_object('driver_id',v_driver.id,'driver_domain_user_id',v_profile_id,'previous_ride_id',_ride_id,
          'approval_status',v_driver.approval_status,'suspended_at',v_driver.suspended_at,'blocked_at',v_driver.blocked_at,
          'is_online',v_driver.is_online,'last_location_at',v_driver.last_location_at));
    end if;
  end if;

  return to_jsonb(v_ride) || jsonb_build_object('released_queued_ride_id',v_released_next_id,'promoted_queued_ride_id',v_promoted_next_id);
end;
$function$;

-- Historical helper remains intact for audit/backward compatibility, but none of
-- the current operational functions above may call it after this migration.
comment on function private.driver_subscription_allows_rides(text) is
  'Historical electronic membership helper. Not part of current driver operational eligibility while provider policy is NOT_CONFIGURED.';
