-- Synthetic data only, real observed rides columns and selected triggers.
insert into apois_nav_lab.catalog values
 ('00000000-0000-4000-8000-000000000021',1,'node',1,repeat('a',64),'Embarque',-9.4,-40.5,true),
 ('00000000-0000-4000-8000-000000000022',1,'node',2,repeat('a',64),'Destino',-9.42,-40.51,true);
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000011'; u uuid:='00000000-0000-4000-8000-000000000001';
 b uuid:='00000000-0000-4000-8000-000000000012'; d uuid:='00000000-0000-4000-8000-000000000071';
 k uuid:='00000000-0000-4000-8000-000000000031';
 p uuid:='00000000-0000-4000-8000-000000000021'; q uuid:='00000000-0000-4000-8000-000000000022';
 s uuid; r uuid; response jsonb; payload jsonb;
begin
 if has_function_privilege('authenticated','apois_nav_lab.create_passenger_ride_v21(uuid,uuid,uuid,jsonb)','execute') then raise exception 'client grant'; end if;
 s:=(apois_nav_lab.confirm_selection(a,k,p,1,q,1)->>'selectionId')::uuid;
 payload:='{"origin":{"lat":-9.4,"lng":-40.5},"destination":{"lat":-9.42,"lng":-40.51},"category":"carros","intermediates":[],"payment_method":"cash","estimated_price":12.34,"distance_km":2.10,"duration_min":8,"expected_price_cents":1234}';
 if apois_nav_lab.create_passenger_ride_v21(b,s,k,payload) is not null then raise exception 'wrong owner accepted'; end if;
 begin
   perform apois_nav_lab.create_passenger_ride_v21(a,s,k,payload||'{"payment_method":"pix"}');
   raise exception 'pix accepted';
 exception when raise_exception then if sqlerrm<>'unsupported_v21_experimental_payload' then raise; end if; end;
 begin
   perform apois_nav_lab.create_passenger_ride_v21(a,s,k,payload||'{"destination":{"lat":-9.43,"lng":-40.51}}');
   raise exception 'mismatched coordinates accepted';
 exception when raise_exception then if sqlerrm<>'confirmed_points_differ_from_fare_inputs' then raise; end if; end;
 insert into public.cancellation_fees values(u,false,null,'pending');
 begin
   perform apois_nav_lab.create_passenger_ride_v21(a,s,k,payload);
   raise exception 'debt gate bypass';
 exception when raise_exception then if sqlerrm<>'passenger_cancellation_fee_pending' then raise; end if; end;
 delete from public.cancellation_fees where passenger_id=u;
 if exists(select 1 from public.rides where request_key=k) or exists(select 1 from apois_nav_lab.selection where id=s and prepared_xid is not null) then raise exception 'partial ride'; end if;
 update public.users set suspended_at=clock_timestamp() where id=u;
 if apois_nav_lab.create_passenger_ride_v21(a,s,k,payload) is not null then raise exception 'suspended accepted'; end if;
 update public.users set suspended_at=null where id=u;
 response:=apois_nav_lab.create_passenger_ride_v21(a,s,k,payload);
 r:=(response->>'rideId')::uuid;
 if r is null or response->>'reused'<>'false' or response->>'fare_amount_cents'<>'1234' then raise exception 'creation failed %',response; end if;
 if not exists(select 1 from public.rides where id=r and payment_method='cash' and payment_status='pending' and estimated_price=12.34 and processing_fee_cents=0 and passenger_charge_cents=1234 and origin=payload->'origin' and destination=payload->'destination' and pickup_source='osm_lab' and encoded_polyline is null) then raise exception 'payload lost'; end if;
 response:=apois_nav_lab.create_passenger_ride_v21(a,s,k,payload||'{"estimated_price":99.99,"payment_method":"credit"}');
 if response->>'rideId'<>r::text or response->>'reused'<>'true' or response->>'fare_amount_cents'<>'1234' then raise exception 'retry mutated'; end if;
 -- Real state-machine transition constraints: no direct jump to trip.
 begin
   update public.rides set status='em_viagem' where id=r;
   raise exception 'invalid transition accepted';
 exception when check_violation then null; end;
 update public.rides set status='motorista_a_caminho',driver_id=d,accepted_driver_id=d,accepted_at=clock_timestamp() where id=r;
 if apois_nav_lab.read_driver_proof('00000000-0000-4000-8000-000000000061',r,'PICKUP') is null then raise exception 'driver proof missing'; end if;
 update public.rides set status='motorista_chegou',driver_arrived_at=clock_timestamp() where id=r;
 update public.rides set status='em_viagem',started_at=clock_timestamp() where id=r;
 if apois_nav_lab.read_driver_proof('00000000-0000-4000-8000-000000000061',r,'TRIP') is null then raise exception 'trip proof missing'; end if;
 update public.rides set status='finalizada',completed_at=clock_timestamp() where id=r;
end $$;
select 'APOIS_OBSERVED_V21_CONTRACT_OK';
