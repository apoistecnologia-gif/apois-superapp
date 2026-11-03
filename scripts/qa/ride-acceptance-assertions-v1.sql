-- Execute both staged acceptance RPCs directly on a disposable PG17 server.
-- no Supabase credentials, external APIs, payments or production mutations.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
-- JWT subject is the Auth ID; mobility_user_id maps it to the domain user.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);

DO $t$
DECLARE n integer; test_id uuid; expected text; observed text; rejected boolean;
BEGIN
 FOR n,expected IN SELECT * FROM (VALUES
 (102,'retired_payment_flow_not_supported'),
 (103,'retired_payment_flow_not_supported'),
 (104,'retired_payment_flow_not_supported'),
 (105,'electronic_payment_not_configured'),
 (106,'ride_offer_unavailable'),
 (107,'ride_offer_unavailable'),
 (108,'ride_offer_unavailable'),
 (115,'retired_payment_flow_not_supported'),
 (116,'retired_payment_flow_not_supported')
 ) c(n,expected) LOOP
  test_id:=format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid;
  rejected:=false;
  BEGIN
   PERFORM apois_rpc_private.driver_accept_ride(test_id);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed<>expected THEN
    RAISE EXCEPTION 'offer % returned %, expected %',n,observed,expected;
   END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'invalid offer % was accepted',n; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Outer acceptance blocks Safe2Pay, legacy gateways, Pix and unauthorized/expired offers';
END;
$t$;

DO $t$
DECLARE n integer; test_id uuid; observed text; rejected boolean;
BEGIN
 FOR n IN SELECT * FROM (VALUES(102),(103),(115)) c(n) LOOP
  test_id:=format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid;
  rejected:=false;
  BEGIN
   PERFORM apois_rpc_private.driver_accept_ride_candidate_legacy(test_id);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed<>'electronic_payment_not_configured' THEN
    RAISE EXCEPTION 'legacy offer % returned %',n,observed;
   END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'legacy accepted Safe2Pay %',n; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Legacy acceptance also rejects Safe2Pay by direct call';
END;
$t$;

DO $t$
DECLARE n integer; test_id uuid; observed text; rejected boolean; expected text;
BEGIN
 FOR n,expected IN SELECT * FROM (VALUES
 (109,'driver_kyc_incomplete'),(110,'driver_offline'),
 (111,'driver_suspended'),(112,'driver_blocked'),(113,'driver_not_approved')
 ) c(n,expected) LOOP
  test_id:=format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid;
  PERFORM set_config('request.jwt.claim.sub',
   format('00000000-0000-4000-8000-%s',lpad(
    (CASE n WHEN 109 THEN 8 WHEN 110 THEN 2 WHEN 111 THEN 3 WHEN 112 THEN 4 ELSE 5 END)::text,12,'0')),true);
  rejected:=false;
  BEGIN
   PERFORM apois_rpc_private.driver_accept_ride(test_id);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed<>expected THEN RAISE EXCEPTION 'driver case %: got %, wanted %',n,observed,expected; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'ineligible driver accepted ride %',n; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
 RAISE NOTICE '[PASS] Acceptance requires approved, online, not blocked/suspended, and KYC';
END;
$t$;

-- Stale/missing/out-of-bounds/future GPS is rejected even if the
-- driver still has is_online=true and valid synthetic KYC/approval.
DO $t$
DECLARE n integer; msg text; rejected boolean; ride uuid; driver_n integer;
BEGIN
 FOR n IN 118..121 LOOP
  ride:=format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid;
  driver_n:=n-109;
  PERFORM set_config('request.jwt.claim.sub',
   format('00000000-0000-4000-8000-%s',lpad(driver_n::text,12,'0')),true);
  rejected:=false;
  BEGIN
   PERFORM apois_rpc_private.driver_accept_ride(ride);
  EXCEPTION WHEN SQLSTATE '42501' THEN
   GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
   IF msg<>'driver_location_stale' THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'GPS-invalid driver % accepted an offer',driver_n; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
 RAISE NOTICE '[PASS] Four invalid/missing/stale/future GPS offers rejected without active gateway';
END;
$t$;

DO $t$
DECLARE result jsonb;
BEGIN
 SELECT apois_rpc_private.driver_accept_ride(
 '30000000-0000-4000-8000-000000000117') INTO result;
 IF result->>'status'<>'motorista_a_caminho'
 OR result->>'payment_method'<>'cash'
 OR (result->>'driver_id')::uuid IS DISTINCT FROM '20000000-0000-4000-8000-000000000007'::uuid
 THEN RAISE EXCEPTION 'cash direct offer not accepted: %',result; END IF;
 RAISE NOTICE '[PASS] Direct cash flow accepted by eligible driver without electronic gateway';
END;
$t$;

-- A second offered ride cannot be accepted while driver has an active arrival.
DO $t$
DECLARE rejected boolean:=false; observed text;
BEGIN
 BEGIN
  PERFORM apois_rpc_private.driver_accept_ride('30000000-0000-4000-8000-000000000101');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
  IF observed<>'driver_busy' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'busy driver accepted another active ride'; END IF;
 RAISE NOTICE '[PASS] Busy driver cannot accept a second active ride';
END;
$t$;

-- End authenticated transaction before asserting persisted state as fixture owner;
-- an actual client should NOT get arbitrary SELECT on rides for testing.
COMMIT;

DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.rides WHERE driver_id='20000000-0000-4000-8000-000000000007'::uuid
   AND status='motorista_a_caminho';
 IF n<>1 THEN RAISE EXCEPTION 'unexpected accepted ride count %',n; END IF;
 SELECT count(*) INTO n FROM public.rides WHERE id IN(
  '30000000-0000-4000-8000-000000000102',
  '30000000-0000-4000-8000-000000000103',
  '30000000-0000-4000-8000-000000000104',
  '30000000-0000-4000-8000-000000000105',
  '30000000-0000-4000-8000-000000000115',
  '30000000-0000-4000-8000-000000000116'
 ) AND status='procurar_motorista' AND driver_id IS NULL;
 IF n<>6 THEN RAISE EXCEPTION 'provider-blocked offers were mutated'; END IF;
 RAISE NOTICE '[PASS] Blocked payment flows caused no acceptance side effects';
END;
$t$;
