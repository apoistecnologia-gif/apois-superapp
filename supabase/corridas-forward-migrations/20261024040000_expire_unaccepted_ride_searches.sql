-- APOIS Corridas: expirar buscas sem motorista, sem cancelar em nome do passageiro.
create extension if not exists pg_cron;
create or replace function private.expire_unaccepted_ride_searches()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  with expired as (
    update public.rides r
       set status = 'expired',
           cancelled_at = now(),
           cancelled_by = 'system',
           cancellation_reason = 'Nenhum motorista disponível no momento.',
           candidate_driver_ids = array[]::uuid[],
           offered_driver_ids = array[]::uuid[],
           current_offer_driver_id = null,
           request_expires_at = null
     where r.status = 'procurar_motorista'
       and r.driver_id is null
       and r.accepted_driver_id is null
       and r.queued_after_ride_id is null
       and r.search_expires_at is not null
       and r.search_expires_at <= now()
    returning r.id
  )
  select count(*) into v_count from expired;
  return v_count;
end; $$;
revoke all on function private.expire_unaccepted_ride_searches() from public, anon, authenticated;
select cron.schedule('apois-expire-unaccepted-rides', '* * * * *', 'select private.expire_unaccepted_ride_searches();');