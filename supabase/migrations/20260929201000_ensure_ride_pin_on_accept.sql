-- Ensure every accepted/arrived ride has a protected 4-digit boarding PIN.
create or replace function public.apois_ensure_ride_security_secret()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
begin
  if new.status in ('motorista_a_caminho','motorista_chegou') then
    select security_code into v_code
    from public.ride_security_secrets
    where ride_id = new.id;

    if v_code is null then
      v_code := lpad((floor(random()*10000))::int::text,4,'0');
      insert into public.ride_security_secrets(ride_id,security_code,created_at,updated_at)
      values(new.id,v_code,now(),now())
      on conflict (ride_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_apois_ensure_ride_security_secret on public.rides;
create trigger trg_apois_ensure_ride_security_secret
after insert or update of status on public.rides
for each row
execute function public.apois_ensure_ride_security_secret();
