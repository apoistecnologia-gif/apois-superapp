-- APOIS Motorista, Pix R$ 99,90 — PHASE 2 / STAGING ONLY; DO NOT APPLY.
-- APPLY ONLY AFTER phase 1 fee/provider migration (also STAGE_ONLY), sandbox
-- provider/webhooks tests, security review and explicit production approval.
-- Adds backend-only authorization for becoming ONLINE and accepting NEW rides
-- while subscription is overdue. Existing active rides may finish normally.
-- No Entregas, fare, ledger, split or settlement changes are made.
BEGIN;

CREATE OR REPLACE FUNCTION private.apois_driver_membership_valid_for_new_ride(_driver_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=''
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.driver_memberships m
  JOIN public.drivers d ON d.id=m.driver_id
  WHERE m.driver_id=_driver_id
    AND m.status='active'
    -- Existing paid 49.90/59.90 contracts retain access for their paid period.
    -- Only NEW memberships and NEW charges must use R$ 99,90.
    AND m.paid_through > now()
    AND d.approval_status='aprovado'
    AND d.blocked_at IS NULL
    AND d.suspended_at IS NULL
    AND private.driver_kyc_is_ready(d.id)
 );
$function$;
REVOKE ALL ON FUNCTION private.apois_driver_membership_valid_for_new_ride(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apois_driver_membership_valid_for_new_ride(uuid) FROM anon,authenticated;

-- During staged integration, payment flag FALSE: existing QA must stay usable.
-- Enabling is a separate deliberate transaction AFTER bank/webhook validation.
CREATE OR REPLACE FUNCTION private.apois_guard_driver_online_membership_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE enabled boolean;
BEGIN
 SELECT COALESCE(s.value='true'::jsonb,false) INTO enabled
 FROM public.app_settings s WHERE s.key='finance.driver_membership_pix_enabled';
 IF COALESCE(enabled,false) AND NEW.is_online IS TRUE AND OLD.is_online IS DISTINCT FROM TRUE
    AND NOT private.apois_driver_membership_valid_for_new_ride(NEW.id) THEN
  RAISE EXCEPTION 'driver_subscription_expired_or_missing' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS apois_guard_driver_online_membership_v2 ON public.drivers;
CREATE TRIGGER apois_guard_driver_online_membership_v2
 BEFORE UPDATE OF is_online ON public.drivers
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_driver_online_membership_v2();
REVOKE ALL ON FUNCTION private.apois_guard_driver_online_membership_v2() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.apois_guard_new_ride_accept_membership_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE enabled boolean;
BEGIN
 SELECT COALESCE(s.value='true'::jsonb,false) INTO enabled FROM public.app_settings s
 WHERE s.key='finance.driver_membership_pix_enabled';
 IF COALESCE(enabled,false)
 AND NEW.status='motorista_a_caminho'
 AND OLD.status IS DISTINCT FROM 'motorista_a_caminho'
 AND NEW.driver_id IS NOT NULL
 AND NOT private.apois_driver_membership_valid_for_new_ride(NEW.driver_id) THEN
  RAISE EXCEPTION 'driver_subscription_expired_or_missing' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS apois_guard_new_ride_accept_membership_v2 ON public.rides;
CREATE TRIGGER apois_guard_new_ride_accept_membership_v2
 BEFORE UPDATE OF status,driver_id ON public.rides
 FOR EACH ROW EXECUTE FUNCTION private.apois_guard_new_ride_accept_membership_v2();
REVOKE ALL ON FUNCTION private.apois_guard_new_ride_accept_membership_v2() FROM PUBLIC;

-- IMPORTANT: checked against the live (read-only) driver_membership_charges_status_check:
-- allowed states are pending, confirmed, received, overdue, refunded, cancelled, failed.
-- Never use paid/processing as charge statuses; those values would cause CHECK violations.

-- Service-role-only atomic settlement. Must be called ONLY by authenticated
-- bank-verified Edge webhook handler using the result of GET provider payment.
-- Never trust the incoming notification amount or driver id alone.
CREATE OR REPLACE FUNCTION private.apois_apply_verified_driver_membership_pix_v2(
  _charge_id uuid,
  _provider text,
  _payment_id text,
  _external_reference text,
  _verified_amount_cents bigint,
  _bank_status text,
  _event_key text,
  _bank_confirmed_at timestamptz
)
RETURNS TABLE(driver_id uuid,paid_through timestamptz,was_duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE c public.driver_membership_charges%ROWTYPE;
DECLARE m public.driver_memberships%ROWTYPE;
DECLARE target_due timestamptz;
DECLARE event_name text;
BEGIN
 IF _provider NOT IN ('asaas','mercadopago') OR
    _bank_status <> 'confirmed' OR
    _verified_amount_cents<>9990 OR
    _external_reference IS DISTINCT FROM _charge_id::text OR
    _bank_confirmed_at IS NULL OR
    _bank_confirmed_at > now() + INTERVAL '5 minutes' OR
    _payment_id IS NULL OR length(_payment_id) < 3 OR
    _event_key IS NULL OR length(_event_key) < 4 THEN
   RAISE EXCEPTION 'unverified_bank_payment_contract' USING ERRCODE='42501';
 END IF;
 SELECT * INTO c FROM public.driver_membership_charges
 WHERE id=_charge_id FOR UPDATE;
 IF NOT FOUND OR c.provider IS DISTINCT FROM _provider
    OR c.provider_payment_id IS DISTINCT FROM _payment_id
    OR c.amount_cents IS DISTINCT FROM 9990 THEN
  RAISE EXCEPTION 'bank_payment_does_not_match_charge' USING ERRCODE='42501';
 END IF;
 SELECT * INTO m FROM public.driver_memberships
 WHERE driver_memberships.driver_id=c.driver_id FOR UPDATE;
 IF NOT FOUND OR m.monthly_fee_cents<>9990 OR m.provider<>_provider THEN
  RAISE EXCEPTION 'bank_payment_does_not_match_driver_contract' USING ERRCODE='42501';
 END IF;
 IF c.status='received' THEN
    driver_id:=c.driver_id;paid_through:=m.paid_through;was_duplicate:=true;RETURN NEXT;
    RETURN;
 END IF;
 IF c.status NOT IN ('pending','confirmed') THEN
  RAISE EXCEPTION 'charge_cancelled_or_reversed' USING ERRCODE='42501';
 END IF;
 event_name := _provider||':membership:'||_event_key;
 INSERT INTO public.payment_webhook_receipts(provider,event_key,status,raw_payload,processed_at)
 VALUES(_provider,event_name,'processed','{}'::jsonb,now())
 ON CONFLICT(event_key) DO NOTHING;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'payment_event_replayed_for_another_charge' USING ERRCODE='42501';
 END IF;
 target_due:=GREATEST(COALESCE(m.paid_through,'epoch'::timestamptz),_bank_confirmed_at)
           + INTERVAL '1 month';
 UPDATE public.driver_membership_charges
 SET status='received',paid_at=_bank_confirmed_at,updated_at=now()
 WHERE id=c.id AND status IN ('pending','confirmed');
 IF NOT FOUND THEN RAISE EXCEPTION 'concurrent_charge_update' USING ERRCODE='40001'; END IF;
 UPDATE public.driver_memberships
 SET status='active',paid_through=target_due,next_due_date=(target_due AT TIME ZONE 'America/Recife')::date,
     last_payment_status='paid',last_payment_at=_bank_confirmed_at,
     current_payment_id=_payment_id,updated_at=now()
 WHERE driver_id=c.driver_id;
 UPDATE public.drivers SET subscription_status='active' WHERE id=c.driver_id;
 driver_id:=c.driver_id;paid_through:=target_due;was_duplicate:=false;RETURN NEXT;
END
$function$;
REVOKE ALL ON FUNCTION private.apois_apply_verified_driver_membership_pix_v2(uuid,text,text,text,bigint,text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apois_apply_verified_driver_membership_pix_v2(uuid,text,text,text,bigint,text,text,timestamptz) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION private.apois_apply_verified_driver_membership_pix_v2(uuid,text,text,text,bigint,text,text,timestamptz) TO service_role;

-- Separate refund/reversal requires confirmed provider inquiry and manual
-- policy for partial-month access; never blindly undo later confirmed renewals.
-- Signature and event dedupe reside in the private webhook handler.

DO $verify$
BEGIN
 IF (SELECT value FROM public.app_settings
     WHERE key='finance.driver_membership_pix_enabled') IS DISTINCT FROM 'false'::jsonb THEN
  RAISE EXCEPTION 'DO_NOT_ENABLE_MEMBERSHIP_PIX_BEFORE_E2E' USING ERRCODE='55000';
 END IF;
END
$verify$;
COMMIT;
