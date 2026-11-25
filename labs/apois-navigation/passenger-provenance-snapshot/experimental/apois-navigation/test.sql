-- Only synthetic points and IDs. No actual OSM extraction is asserted here.
insert into apois_nav_lab.catalog values
('00000000-0000-4000-8000-000000000021',1,'node',1,repeat('a',64),'Ponto A',-9.4,-40.5,true),
('00000000-0000-4000-8000-000000000022',1,'node',2,repeat('a',64),'Ponto B',-9.42,-40.51,true),
('00000000-0000-4000-8000-000000000023',1,'node',3,repeat('a',64),'Ponto C',-9.43,-40.52,false);
do $$
begin
  if has_schema_privilege('authenticated','apois_nav_lab','USAGE') or
     has_table_privilege('anon','apois_nav_lab.selection','SELECT') or
     has_function_privilege('authenticated','apois_nav_lab.confirm_selection(uuid,uuid,uuid,integer,uuid,integer)','EXECUTE') then
    raise exception 'client privileges leaked';
  end if;
  begin
    update apois_nav_lab.catalog set lat=-9.41 where osm_id=1;
    raise exception 'immutable catalog failed';
  exception when raise_exception then
    if sqlerrm<>'catalog_version_immutable' then raise; end if;
  end;
end $$;
set role service_role;
do $$
declare
  a uuid:='00000000-0000-4000-8000-000000000011'; b uuid:='00000000-0000-4000-8000-000000000012';
  k uuid:='00000000-0000-4000-8000-000000000031'; p uuid:='00000000-0000-4000-8000-000000000021';
  d uuid:='00000000-0000-4000-8000-000000000022'; inactive uuid:='00000000-0000-4000-8000-000000000023';
  s jsonb; s2 jsonb;
begin
  if apois_nav_lab.confirm_selection(a,k,p,1,inactive,1) is not null then raise exception 'inactive accepted'; end if;
  s:=apois_nav_lab.confirm_selection(a,k,p,1,d,1);
  if s is null or (s->'origin'->>'lat')::float8<>-9.4 then raise exception 'selection failed'; end if;
  s2:=apois_nav_lab.confirm_selection(a,k,p,1,d,1);
  if s2 is distinct from s then raise exception 'retry changed selection'; end if;
  if apois_nav_lab.confirm_selection(a,k,d,1,p,1) is not null then raise exception 'key reused for other points'; end if;
  if apois_nav_lab.confirm_selection(null,k,p,1,d,1) is not null then raise exception 'anonymous accepted'; end if;
  if apois_nav_lab.bind_selection(b,(s->>'selectionId')::uuid,'00000000-0000-4000-8000-000000000041') then raise exception 'other owner accepted'; end if;
end $$;
reset role;
-- A prepare in an already committed transaction is not usable for binding.
set role service_role;
select apois_nav_lab.prepare_selection('00000000-0000-4000-8000-000000000011',id,request_key)
from apois_nav_lab.selection;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000011'; s uuid;
begin
  select id into strict s from apois_nav_lab.selection;
  if apois_nav_lab.bind_selection(a,s,'00000000-0000-4000-8000-000000000041') then raise exception 'cross transaction bind'; end if;
end $$;
-- All successful creation work must be in one transaction.
begin;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000011'; b uuid:='00000000-0000-4000-8000-000000000012';
  s uuid; k uuid; prepared jsonb; u uuid:='00000000-0000-4000-8000-000000000001';
  good uuid:='00000000-0000-4000-8000-000000000041';
begin
  select id,request_key into strict s,k from apois_nav_lab.selection;
  if apois_nav_lab.prepare_selection(b,s,k) is not null then raise exception 'other owner prepared'; end if;
  if apois_nav_lab.prepare_selection(a,s,good) is not null then raise exception 'wrong request key'; end if;
  prepared:=apois_nav_lab.prepare_selection(a,s,k);
  if prepared is null or (prepared->'origin'->>'lat')::float8<>-9.4 then raise exception 'prepare failed'; end if;
  insert into public.rides(id,passenger_id,request_key,created_at,category,status,origin_lat,origin_lng,destination_lat,destination_lng,waypoints)
  values
  (good,u,k,clock_timestamp(),'carros','procurar_motorista',-9.4,-40.5,-9.42,-40.51,'[]'),
  ('00000000-0000-4000-8000-000000000042',u,k,clock_timestamp()-interval '1 hour','carros','procurar_motorista',-9.4,-40.5,-9.42,-40.51,'[]'),
  ('00000000-0000-4000-8000-000000000043',u,k,clock_timestamp(),'carros','procurar_motorista',-9.4,-40.5,-9.43,-40.51,'[]'),
  ('00000000-0000-4000-8000-000000000044',u,k,clock_timestamp(),'carros','procurar_motorista',-9.4,-40.5,-9.42,-40.51,null);
  if apois_nav_lab.bind_selection(a,s,'00000000-0000-4000-8000-000000000042') then raise exception 'old ride relabelled'; end if;
  if apois_nav_lab.bind_selection(a,s,'00000000-0000-4000-8000-000000000043') then raise exception 'mismatched coordinates accepted'; end if;
  if apois_nav_lab.bind_selection(a,s,'00000000-0000-4000-8000-000000000044') then raise exception 'unknown stops accepted'; end if;
  if not apois_nav_lab.bind_selection(a,s,good) then raise exception 'bind failed'; end if;
  if apois_nav_lab.bind_selection(a,s,good) then raise exception 'binding replay accepted'; end if;
  if (select ride_id from apois_nav_lab.selection where id=s) is distinct from good then raise exception 'binding missing'; end if;
end $$;
commit;
reset role;
-- An existing ordinary ride must not be reclassified using a later prepare.
set role service_role;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000011';
  k uuid:='00000000-0000-4000-8000-000000000032';
  p uuid:='00000000-0000-4000-8000-000000000021';
  d uuid:='00000000-0000-4000-8000-000000000022';
  s jsonb;
begin
  s:=apois_nav_lab.confirm_selection(a,k,p,1,d,1);
  insert into public.rides(id,passenger_id,request_key,category,status,origin_lat,origin_lng,destination_lat,destination_lng,waypoints)
  values('00000000-0000-4000-8000-000000000045','00000000-0000-4000-8000-000000000001',k,'carros','procurar_motorista',-9.4,-40.5,-9.42,-40.51,'[]');
  if apois_nav_lab.prepare_selection(a,(s->>'selectionId')::uuid,k) is not null then raise exception 'existing ordinary ride prepared'; end if;
end $$;
reset role;
select 'APOIS_PROVENANCE_SQL_OK' as result;
