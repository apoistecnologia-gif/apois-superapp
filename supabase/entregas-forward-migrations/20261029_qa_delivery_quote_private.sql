-- Restrict QA pickup coordinate inference through public quote RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.resolve_delivery_quote(p_merchant_id uuid, p_delivery_address jsonb)
 RETURNS TABLE(eligible boolean, reason text, zone_id uuid, delivery_fee numeric, minimum_order numeric, distance_km numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_merchant public.merchants;
  v_city public.cities;
  v_zone public.delivery_zones;
  v_lat numeric;
  v_lon numeric;
  v_address_city text;
  v_address_state text;
  v_zone_count integer;
  v_distance numeric;
begin
  -- Test location security: a known QA merchant UUID must not reveal any
  -- pickup distance/zone to unauthorized users through this SECURITY DEFINER RPC.
  IF EXISTS(
    SELECT 1 FROM public.merchants m
    WHERE m.id=p_merchant_id AND m.slug='apois-teste-entregas-homologacao-20261029'
  ) AND COALESCE(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    AND NOT public.apois_qa_read_allowed(p_merchant_id)
  THEN
    RETURN QUERY SELECT false,'merchant_unavailable'::text,
      null::uuid,0::numeric,0::numeric,null::numeric;
    RETURN;
  END IF;

  if p_delivery_address is null or jsonb_typeof(p_delivery_address) <> 'object' then
    return query select false,'invalid_address'::text,null::uuid,0::numeric,0::numeric,null::numeric;
    return;
  end if;

  select * into v_merchant from public.merchants m where m.id = p_merchant_id;
  if not found or not v_merchant.is_active or v_merchant.approval_status <> 'approved' or not v_merchant.delivery_enabled then
    return query select false,'merchant_unavailable'::text,null::uuid,0::numeric,0::numeric,null::numeric;
    return;
  end if;

  if v_merchant.latitude is null or v_merchant.longitude is null then
    return query select false,'merchant_location_required'::text,null::uuid,0::numeric,v_merchant.minimum_order,null::numeric;
    return;
  end if;

  if v_merchant.city_id is not null then
    select * into v_city from public.cities c where c.id = v_merchant.city_id;
  else
    select * into v_city
    from public.cities c
    where lower(btrim(c.name)) = lower(btrim(coalesce(v_merchant.city,'')))
      and upper(btrim(c.state)) = upper(btrim(coalesce(v_merchant.state,'')))
    order by c.is_active desc,c.created_at
    limit 1;
  end if;

  if v_city.id is null or not v_city.is_active then
    return query select false,'city_unavailable'::text,null::uuid,0::numeric,v_merchant.minimum_order,null::numeric;
    return;
  end if;

  v_address_city := nullif(btrim(p_delivery_address->>'city'),'');
  v_address_state := nullif(upper(btrim(p_delivery_address->>'state')),'');
  if v_address_city is null or v_address_state is null
     or lower(v_address_city) <> lower(btrim(v_city.name))
     or v_address_state <> upper(btrim(v_city.state)) then
    return query select false,'outside_served_city'::text,null::uuid,0::numeric,v_merchant.minimum_order,null::numeric;
    return;
  end if;

  if coalesce(p_delivery_address->>'latitude','') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_lat := (p_delivery_address->>'latitude')::numeric;
  end if;
  if coalesce(p_delivery_address->>'longitude','') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_lon := (p_delivery_address->>'longitude')::numeric;
  end if;
  if v_lat is not null and (v_lat < -90 or v_lat > 90) then v_lat := null; end if;
  if v_lon is not null and (v_lon < -180 or v_lon > 180) then v_lon := null; end if;

  -- Coordinates are operationally required even when a city currently has no
  -- polygon/radius rule: dispatch, route distance and courier earnings depend on them.
  if v_lat is null or v_lon is null then
    return query select false,'coordinates_required'::text,null::uuid,0::numeric,v_merchant.minimum_order,null::numeric;
    return;
  end if;

  v_distance := public.haversine_km(v_merchant.latitude,v_merchant.longitude,v_lat,v_lon);

  select count(*) into v_zone_count
  from public.delivery_zones dz
  where dz.city_id = v_city.id and dz.is_active = true;

  if v_zone_count > 0 then
    select dz.* into v_zone
    from public.delivery_zones dz
    where dz.city_id = v_city.id
      and dz.is_active = true
      and public.delivery_zone_contains_point(dz.id,v_lat,v_lon)
    order by coalesce(dz.radius_km,999999::numeric),dz.created_at
    limit 1;

    if not found then
      return query select false,'outside_delivery_zone'::text,null::uuid,0::numeric,v_merchant.minimum_order,v_distance;
      return;
    end if;
  elsif v_city.default_delivery_radius_km is not null and v_distance > v_city.default_delivery_radius_km then
    return query select false,'outside_default_radius'::text,null::uuid,0::numeric,v_merchant.minimum_order,v_distance;
    return;
  end if;

  return query select
    true,
    'ok'::text,
    v_zone.id,
    coalesce(v_zone.delivery_fee,v_merchant.delivery_fee,0),
    greatest(coalesce(v_merchant.minimum_order,0),coalesce(v_zone.minimum_order,0)),
    v_distance;
end;
$function$
;
COMMIT;
