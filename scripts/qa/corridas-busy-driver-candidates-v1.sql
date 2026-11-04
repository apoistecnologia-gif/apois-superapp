-- Executes the REAL staged busy-driver trigger against a fully disposable
-- PostgreSQL 17 synthetic fixture. No Supabase, Auth or actual driver data.
\set ON_ERROR_STOP on
ALTER TABLE public.drivers ADD COLUMN category text;
ALTER TABLE public.rides ADD COLUMN category text;
UPDATE public.drivers SET category='car';
-- Driver 7: approved, online, KYC verified, GPS from the acceptance fixture.
INSERT INTO public.rides(id,status,driver_id,category)
VALUES('30000000-0000-4000-8000-000000000901','em_viagem',
 '20000000-0000-4000-8000-000000000007','car');

-- New search requests are appended by the real production trigger on UPDATE
-- OF candidate_driver_ids; category, origin and arrays are representative.
INSERT INTO public.rides(id,status,category,origin_lat,origin_lng,
 payment_method,service_details,candidate_driver_ids,offered_driver_ids)
SELECT format('30000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
 'procurar_motorista','car',-9.40,-40.50,'cash','{}'::jsonb,
 '{}'::uuid[],'{}'::uuid[]
FROM generate_series(902,915) AS n;

-- Positive: a real busy, approved, near driver with fresh GPS is offered.
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000902';
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.rides
  WHERE id='30000000-0000-4000-8000-000000000902'
  AND '10000000-0000-4000-8000-000000000007'=ANY(offered_driver_ids)
  AND '10000000-0000-4000-8000-000000000007'=ANY(candidate_driver_ids)) THEN
  RAISE EXCEPTION 'Valid busy driver was not added to nearby offer list';
 END IF;
 RAISE NOTICE '[PASS] Eligible busy driver receives one nearby cash request';
END;
$t$;

-- Cached online flag with future GPS must never be eligible even if the
-- driver/ride latitude and longitude are close.
UPDATE public.drivers SET last_location_at=now()+interval '10 minutes'
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000903';
DO $t$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rides WHERE id='30000000-0000-4000-8000-000000000903'
 AND cardinality(offered_driver_ids)>0) THEN
  RAISE EXCEPTION 'Future-dated driver GPS accepted in busy candidate generation';
 END IF;
 RAISE NOTICE '[PASS] Future-dated driver GPS rejected for busy-driver offers';
END;
$t$;
-- Small clock skew up to +30 seconds remains compatible with ordinary
-- driver acceptance and queued-ride promotion.
UPDATE public.drivers SET last_location_at=now()+interval '20 seconds'
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000904';
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.rides WHERE id='30000000-0000-4000-8000-000000000904'
 AND '10000000-0000-4000-8000-000000000007'=ANY(offered_driver_ids)) THEN
  RAISE EXCEPTION 'Permitted 20-second GPS clock skew was rejected';
 END IF;
 RAISE NOTICE '[PASS] Legitimate 20-second GPS clock skew accepted';
END;
$t$;

-- Geometric trigonometric coordinates repeat every 360°. Prior code could
-- therefore see out-of-bounds latitude 350.6 as near valid latitude -9.4.
UPDATE public.drivers SET current_lat=350.60,last_location_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000905';
DO $t$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rides WHERE id='30000000-0000-4000-8000-000000000905'
 AND cardinality(offered_driver_ids)>0) THEN
  RAISE EXCEPTION 'Out-of-bounds wrapped latitude accepted';
 END IF;
 RAISE NOTICE '[PASS] Wrapped 350.6 latitude excluded despite nearby trigonometric result';
END;
$t$;
UPDATE public.drivers SET current_lat=-9.40,current_lng=319.50,last_location_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000906';
DO $t$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rides WHERE id='30000000-0000-4000-8000-000000000906'
 AND cardinality(offered_driver_ids)>0) THEN
  RAISE EXCEPTION 'Out-of-bounds wrapped longitude accepted';
 END IF;
 RAISE NOTICE '[PASS] Wrapped 319.5 longitude excluded from busy-driver offers';
END;
$t$;

UPDATE public.drivers SET current_lat=-9.40,current_lng=-40.50,last_location_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
-- Origin coordinates can also be wrapped, and should not launch nearby
-- offers even if trig distance computes as zero.
UPDATE public.rides SET origin_lat=350.60,candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000907';
UPDATE public.rides SET origin_lng=319.50,candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000908';

-- Exclude stale driver GPS and explicitly disabled KYC.
UPDATE public.drivers SET last_location_at=now()-interval '10 minutes'
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000909';
UPDATE public.drivers SET last_location_at=now(),kyc_ready=false
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000910';
UPDATE public.drivers SET kyc_ready=true,suspended_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000911';
UPDATE public.drivers SET suspended_at=NULL,blocked_at=now()
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000912';
UPDATE public.drivers SET blocked_at=NULL,category='moto'
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000913';
UPDATE public.drivers SET category='car'
WHERE id='20000000-0000-4000-8000-000000000007';
UPDATE public.rides SET rejected_driver_ids=ARRAY[
 '10000000-0000-4000-8000-000000000007'::uuid],
 candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000914';
-- Driver 7 now has a reserved next ride: must never be offered a third.
INSERT INTO public.rides(id,status,driver_id,queued_after_ride_id,category)
VALUES('30000000-0000-4000-8000-000000000916','procurar_motorista',
 '20000000-0000-4000-8000-000000000007',
 '30000000-0000-4000-8000-000000000901','car');
UPDATE public.rides SET candidate_driver_ids='{}'::uuid[]
WHERE id='30000000-0000-4000-8000-000000000915';
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.rides
 WHERE id IN(
  '30000000-0000-4000-8000-000000000907',
  '30000000-0000-4000-8000-000000000908',
  '30000000-0000-4000-8000-000000000909',
  '30000000-0000-4000-8000-000000000910',
  '30000000-0000-4000-8000-000000000911',
  '30000000-0000-4000-8000-000000000912',
  '30000000-0000-4000-8000-000000000913',
  '30000000-0000-4000-8000-000000000914',
  '30000000-0000-4000-8000-000000000915'
 ) AND cardinality(offered_driver_ids)>0;
 IF n<>0 THEN RAISE EXCEPTION '% invalid busy-driver offer(s) persisted',n; END IF;
 RAISE NOTICE '[PASS] Wrapped origin, stale GPS, revoked KYC, blocked/suspended, category, rejected or already-queued drivers excluded';
END;
$t$;
