-- Mercado Pago marketplace reserves the driver before the passenger pays.
-- Capture the generated PIN while the ride is waiting for Pix, but keep it
-- out of the realtime-readable rides row. The protected passenger RPC only
-- reveals it after payment, during motorista_a_caminho/motorista_chegou.
create or replace function public.apois_capture_ride_security_code()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.security_code is null or btrim(new.security_code) = '' then
    new.security_code := null;
    return new;
  end if;

  if new.security_code !~ '^[0-9]{4}$' then
    raise exception 'invalid_security_code_format' using errcode = '22023';
  end if;

  if new.status in ('aguardando_pagamento', 'motorista_a_caminho', 'motorista_chegou') then
    insert into public.ride_security_secrets(ride_id, security_code, created_at, updated_at)
    values (new.id, new.security_code, now(), now())
    on conflict (ride_id) do update
      set security_code = excluded.security_code,
          updated_at = now();
  end if;

  new.security_code := null;
  return new;
end;
$function$;
