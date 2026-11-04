-- APOIS Entregas: read-only derived production function admission rehearsal.
-- PostgreSQL 17 disposable database. All identities/orders are synthetic.
-- Does NOT enable general cash checkout or bypass subscription payment in production.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA private;
CREATE TABLE public.merchants(
 id uuid PRIMARY KEY,
 name text NOT NULL,
 is_active boolean NOT NULL,
 approval_status text NOT NULL
);
CREATE TABLE private.apois_test_cash_access(
 merchant_id uuid NOT NULL,
 customer_user_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '3 days')
);
CREATE TABLE public.merchant_subscriptions(
 merchant_id uuid NOT NULL,
 current_period_end timestamptz,
 last_payment_status text,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.platform_settings(
 key text PRIMARY KEY,
 value jsonb NOT NULL
);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 customer_user_id uuid NOT NULL,
 payment_method text NOT NULL,
 payment_status text NOT NULL,
 status text NOT NULL DEFAULT 'confirmed'
);
-- Exact core of current production private.apois_test_cash_authorized.
CREATE OR REPLACE FUNCTION private.apois_test_cash_authorized(
 _merchant_id uuid, _customer_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM private.apois_test_cash_access a
  JOIN public.merchants m ON m.id=a.merchant_id
  WHERE a.merchant_id=_merchant_id
   AND a.customer_user_id=_customer_id
   AND a.enabled=true AND a.expires_at>now()
   AND m.name ILIKE 'APOIS TESTE%'
   AND m.is_active=true AND m.approval_status='approved'
 );
$function$;
-- Verbatim business logic observed from production via pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.merchant_subscription_in_good_standing(
 _merchant_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT CASE
  WHEN NOT EXISTS(
   SELECT 1 FROM public.merchants m
   WHERE m.id=_merchant_id AND m.approval_status='approved' AND m.is_active=true
  ) THEN true
  WHEN EXISTS(
   SELECT 1 FROM private.apois_test_cash_access t
   JOIN public.merchants m ON m.id=t.merchant_id
   WHERE t.merchant_id=_merchant_id
    AND t.enabled=true AND t.expires_at>now()
    AND m.name ILIKE 'APOIS TESTE%'
    AND m.is_active=true AND m.approval_status='approved'
  ) THEN true
  ELSE EXISTS(
   SELECT 1 FROM public.merchant_subscriptions ms
   JOIN public.platform_settings ps ON ps.key='mercado_pago_environment'
   WHERE ms.merchant_id=_merchant_id
    AND ms.current_period_end IS NOT NULL AND ms.current_period_end>now()
    AND COALESCE(ms.metadata->>'environment','')=COALESCE(ps.value #>> '{}','')
    AND COALESCE(ms.last_payment_status,'')='approved'
  )
 END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_supported_order_payment_method()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
 IF NEW.payment_method='pix' THEN RETURN NEW; END IF;
 IF NEW.payment_method='cash'
    AND NEW.payment_status='pending'
    AND private.apois_test_cash_authorized(NEW.merchant_id,NEW.customer_user_id)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'payment method is not enabled in production';
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_merchant_subscription_on_order()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.merchant_subscription_in_good_standing(NEW.merchant_id) THEN
  RAISE EXCEPTION 'merchant subscription inactive';
 END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER orders_supported_payment_method_guard
 BEFORE INSERT OR UPDATE OF payment_method ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.enforce_supported_order_payment_method();
CREATE TRIGGER trg_enforce_merchant_subscription_on_order
 BEFORE INSERT ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_subscription_on_order();

-- Merchant A: authorized TEST environment, merchant B: approved without payment,
-- merchant C: "approved" Mercado Pago legacy subscription (electronic).
INSERT INTO public.merchants(id,name,is_active,approval_status) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','APOIS TESTE HOMOLOGACAO',true,'approved'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Merchant normal no subscription',true,'approved'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Merchant legacy paid',true,'approved');
INSERT INTO private.apois_test_cash_access(merchant_id,customer_user_id,enabled,expires_at) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true,now()+interval '1 day');
INSERT INTO public.platform_settings(key,value)
VALUES('mercado_pago_environment','"production"'::jsonb);
INSERT INTO public.merchant_subscriptions(merchant_id,current_period_end,last_payment_status,metadata)
VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',now()+interval '30 days','approved','{"environment":"production"}'::jsonb);

-- Positive: authorized QA cash is accepted without an electronic subscription.
INSERT INTO public.orders(merchant_id,customer_user_id,payment_method,payment_status)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','cash','pending');

DO $t$
DECLARE case_name text; merchant uuid; customer uuid; method text; pay_status text;
 observed text; expected text; denied boolean;
BEGIN
 FOR case_name,merchant,customer,method,pay_status,expected IN
  SELECT * FROM (VALUES
    ('normal_cash_no_subscription',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
     'cash','pending','payment method is not enabled in production'),
    ('normal_cash_legacy_subscriber',
     'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
     'cash','pending','payment method is not enabled in production'),
    ('qa_cash_unauthorized_customer',
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
     'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
     'cash','pending','payment method is not enabled in production'),
    ('qa_cash_fabricated_paid',
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
     'cash','paid','payment method is not enabled in production'),
    ('unsupported_credit',
     'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
     'credit','pending','payment method is not enabled in production'),
    ('pix_normal_unpaid_subscription',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
     'pix','pending','merchant subscription inactive')
  ) v(name,mer,usr,pay_method,pay_st,expected_msg)
 LOOP
  denied:=false;
  BEGIN
   INSERT INTO public.orders(merchant_id,customer_user_id,payment_method,payment_status)
   VALUES(merchant,customer,method,pay_status);
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION '% returned % expected %',case_name,observed,expected;
   END IF;
   denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION '% wrongly admitted',case_name; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Normal merchant cash blocked even with legacy subscription; unapproved QA cash, fabricated paid and unsupported payment rejected';
END;
$t$;

-- Positive: legacy-paid merchant can create Pix (unchanged behaviour).
INSERT INTO public.orders(merchant_id,customer_user_id,payment_method,payment_status)
VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','pix','pending');
DO $t$
DECLARE denied boolean:=false; observed text;
BEGIN
 -- Expired QA authorization must not become a permanent general-cash grant.
 UPDATE private.apois_test_cash_access SET expires_at=now()-interval '1 day'
 WHERE merchant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN
  INSERT INTO public.orders(merchant_id,customer_user_id,payment_method,payment_status)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','cash','pending');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
  IF observed<>'payment method is not enabled in production' THEN RAISE; END IF;
  denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Expired QA access admitted cash'; END IF;
 IF (SELECT count(*) FROM public.orders) <> 2 THEN
  RAISE EXCEPTION 'Rejected payment methods left unexpected synthetic orders';
 END IF;
 IF (SELECT count(*) FROM public.orders WHERE payment_method='cash' AND payment_status='pending') <> 1
 OR (SELECT count(*) FROM public.orders WHERE payment_method='pix' AND payment_status='pending') <> 1 THEN
  RAISE EXCEPTION 'Allowed cash test / legacy Pix states changed';
 END IF;
 RAISE NOTICE '[PASS] QA cash explicitly authorized, expired authorization denied and paid legacy Pix preserved';
END;
$t$;
