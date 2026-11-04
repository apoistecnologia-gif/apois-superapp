-- PostgreSQL 17 synthetic Entregas subscriptions:
-- role grants reproduce broad production privileges; RLS policies mirror the
-- actual read-own/admin contract but NOT the full Supabase Auth lifecycle.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.admin_users(user_id uuid PRIMARY KEY);
CREATE FUNCTION public.current_user_is_active() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p
                      WHERE p.id=(SELECT auth.uid()) AND p.is_active) $$;
CREATE FUNCTION public.current_user_is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.admin_users a
                      WHERE a.user_id=(SELECT auth.uid())) $$;
CREATE TABLE public.merchant_members(merchant_id uuid NOT NULL,user_id uuid NOT NULL,status text NOT NULL);
CREATE TABLE public.merchant_subscriptions(
 id uuid PRIMARY KEY, merchant_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'mercadopago',
 provider_status text NOT NULL DEFAULT 'pending', amount numeric(10,2) NOT NULL
);
CREATE TABLE public.merchant_subscription_payments(
 id uuid PRIMARY KEY,merchant_subscription_id uuid NOT NULL REFERENCES public.merchant_subscriptions(id),
 amount numeric(10,2) NOT NULL,status text NOT NULL
);
CREATE TABLE public.merchant_subscription_events(
 id uuid PRIMARY KEY,merchant_subscription_id uuid REFERENCES public.merchant_subscriptions(id),
 event_type text NOT NULL
);
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read merchant subscriptions"
 ON public.merchant_subscriptions FOR SELECT TO authenticated
 USING(public.current_user_is_admin());
CREATE POLICY "Merchant members read own subscription"
 ON public.merchant_subscriptions FOR SELECT TO authenticated
 USING(public.current_user_is_active() AND EXISTS(
  SELECT 1 FROM public.merchant_members mm
  WHERE mm.merchant_id=merchant_subscriptions.merchant_id
   AND mm.user_id=(SELECT auth.uid()) AND mm.status='active'
 ));
CREATE POLICY "Admins read merchant subscription payments"
 ON public.merchant_subscription_payments FOR SELECT TO authenticated
 USING(public.current_user_is_admin());
CREATE POLICY "Merchant members read own subscription payments"
 ON public.merchant_subscription_payments FOR SELECT TO authenticated
 USING(public.current_user_is_active() AND EXISTS(
  SELECT 1 FROM public.merchant_subscriptions ms
  JOIN public.merchant_members mm ON mm.merchant_id=ms.merchant_id
  WHERE ms.id=merchant_subscription_payments.merchant_subscription_id
   AND mm.user_id=(SELECT auth.uid()) AND mm.status='active'
 ));
CREATE POLICY "Admins read merchant subscription events"
 ON public.merchant_subscription_events FOR SELECT TO authenticated
 USING(public.current_user_is_admin());
CREATE POLICY "Merchant members read own subscription events"
 ON public.merchant_subscription_events FOR SELECT TO authenticated
 USING(public.current_user_is_active() AND EXISTS(
  SELECT 1 FROM public.merchant_subscriptions ms
  JOIN public.merchant_members mm ON mm.merchant_id=ms.merchant_id
  WHERE ms.id=merchant_subscription_events.merchant_subscription_id
   AND mm.user_id=(SELECT auth.uid()) AND mm.status='active'
 ));
INSERT INTO public.profiles VALUES
 ('10000000-0000-4000-8000-000000000001',true),
 ('10000000-0000-4000-8000-000000000002',true),
 ('10000000-0000-4000-8000-000000000003',true);
INSERT INTO public.admin_users VALUES ('10000000-0000-4000-8000-000000000003');
INSERT INTO public.merchant_members VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','active'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','active');
INSERT INTO public.merchant_subscriptions VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','mercadopago','pending',69.90),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','mercadopago','pending',69.90);
INSERT INTO public.merchant_subscription_payments VALUES
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',69.90,'pending'),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',69.90,'pending');
INSERT INTO public.merchant_subscription_events VALUES
 ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','payment_pending'),
 ('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','payment_pending');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT SELECT ON public.merchant_members TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),public.current_user_is_active(),public.current_user_is_admin() TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.merchant_subscriptions,public.merchant_subscription_payments,public.merchant_subscription_events
 TO PUBLIC,anon,authenticated,service_role;
DO $t$
DECLARE name text;
BEGIN
 FOR name IN SELECT unnest(ARRAY[
  'merchant_subscriptions','merchant_subscription_payments','merchant_subscription_events'
 ]) LOOP
  IF NOT has_table_privilege('anon','public.'||name,'TRUNCATE')
    OR NOT has_table_privilege('authenticated','public.'||name,'TRUNCATE')
  THEN RAISE EXCEPTION 'Unable to reproduce broad entitlement: %',name; END IF;
 END LOOP;
 RAISE NOTICE '[PASS] Reproduced broad anonymous/authenticated merchant billing table TRUNCATE grants';
END;
$t$;
