-- APOIS Corridas - preparar liberacao do PIN logo apos aceite.
-- ATENCAO: VERSIONADO APENAS. NAO EXECUTAR AUTOMATICAMENTE EM PRODUCAO.
-- Escopo estrito: alterar somente o status permitido na consulta do passageiro.
-- Nao muda geracao do PIN, gatilhos, antifraude, roles, financeiro ou usuario.
-- A funcao atual permite apenas motorista_chegou. Esta permite tambem
-- motorista_a_caminho, momento em que o aceite ja criou o segredo privado.
-- Seguro: auth.uid() obrigatorio, perfil de dominio comparado ao passageiro
-- titular da corrida, segredo nunca exposto em public.rides ou ao motorista.

create or replace function apois_rpc_private.get_passenger_ride_security_code(_ride_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid := public.mobility_user_id();
  v_code text;
begin
  if auth.uid() is null or v_passenger_id is null then
    raise exception 'unauthorized' using errcode='42501';
  end if;

  select s.security_code into v_code
    from public.rides r
    join public.ride_security_secrets s on s.ride_id=r.id
   where r.id=_ride_id
     and r.passenger_id=v_passenger_id
     and r.status in ('motorista_a_caminho','motorista_chegou')
   limit 1;

  if v_code is null then
    return jsonb_build_object('ok',false,'code','security_code_unavailable');
  end if;

  return jsonb_build_object('ok',true,'security_code',v_code);
end;
$function$;
