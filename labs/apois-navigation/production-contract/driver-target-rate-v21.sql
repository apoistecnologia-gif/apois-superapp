-- Candidate only; never install on a hosted project automatically.
-- Local routing reads need no external broker or routing capability issuer.
-- Durable per-pilot admission shared across Edge instances; no GPS or tokens.
create table apois_nav_lab.driver_target_rate_v21(
 auth_user_id uuid primary key,
 window_started_at timestamptz not null,
 hits integer not null check(hits between 1 and 30)
);
alter table apois_nav_lab.driver_target_rate_v21 enable row level security;
revoke all on apois_nav_lab.driver_target_rate_v21 from public,anon,authenticated;
grant select,insert,update on apois_nav_lab.driver_target_rate_v21 to service_role;
create function apois_nav_lab.driver_target_limited_v21(p_auth_user uuid,p_ride uuid,p_phase text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_hits integer;
begin
 if p_auth_user is null or p_ride is null or p_phase is null or p_phase not in ('PICKUP','TRIP') then
  return jsonb_build_object('limited',false,'proof',null);
 end if;
 insert into apois_nav_lab.driver_target_rate_v21 as q(auth_user_id,window_started_at,hits)
 values(p_auth_user,v_now,1)
 on conflict(auth_user_id) do update set
  window_started_at=case when excluded.window_started_at>=q.window_started_at+interval '60 seconds' then excluded.window_started_at else q.window_started_at end,
  hits=case when excluded.window_started_at>=q.window_started_at+interval '60 seconds' then 1 else q.hits+1 end
 where excluded.window_started_at>=q.window_started_at and
 (excluded.window_started_at>=q.window_started_at+interval '60 seconds' or q.hits<30)
 returning hits into v_hits;
 if not found then return jsonb_build_object('limited',true,'proof',null); end if;
 return jsonb_build_object('limited',false,'proof',apois_nav_lab.read_driver_proof_v21(p_auth_user,p_ride,p_phase));
end $$;
create function public.apois_nav_lab_driver_target_limited_v21(p_auth_user uuid,p_ride uuid,p_phase text)
returns jsonb language sql security invoker set search_path='' as $$
 select apois_nav_lab.driver_target_limited_v21(p_auth_user,p_ride,p_phase)
$$;
revoke all on function apois_nav_lab.driver_target_limited_v21(uuid,uuid,text),public.apois_nav_lab_driver_target_limited_v21(uuid,uuid,text) from public,anon,authenticated;
grant execute on function apois_nav_lab.driver_target_limited_v21(uuid,uuid,text),public.apois_nav_lab_driver_target_limited_v21(uuid,uuid,text) to service_role;
