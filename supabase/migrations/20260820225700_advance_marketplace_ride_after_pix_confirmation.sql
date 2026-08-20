create or replace function private.advance_marketplace_ride_after_pix_confirmation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'aguardando_pagamento'
     and new.payment_status = 'paid'
     and new.driver_id is not null
     and lower(coalesce(new.payment_method,'')) = 'pix'
     and (
       lower(coalesce(new.payment_provider,'')) = 'mercadopago'
       or coalesce(new.service_details->>'payment_flow','') = 'mercadopago_marketplace'
     ) then
    new.status := 'motorista_a_caminho';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_advance_marketplace_ride_after_pix_confirmation on public.rides;
create trigger trg_advance_marketplace_ride_after_pix_confirmation
before insert or update of payment_status,status,driver_id,payment_provider on public.rides
for each row execute function private.advance_marketplace_ride_after_pix_confirmation();
