create or replace function private.enforce_ride_electronic_payment_homologation_gate()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
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