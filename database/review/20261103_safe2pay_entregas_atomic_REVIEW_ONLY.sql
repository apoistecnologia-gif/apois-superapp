-- REVIEW ONLY; NOT APPLIED. APOIS Entregas: atomic Safe2Pay webhook reconciliation.
-- Transaction/ride-or-order/event are committed together in one Postgres RPC call.
-- The Edge Function MUST validate the Safe2Pay shared secret before calling this RPC.
-- Do not activate before a separate isolated PG rollback/integration test and authorized release.
-- Requires the existing tables and constraints verified on 02/11/2026.
-- Manual rollback after deployment: restore pre-release function definition or DROP only this new RPC after disabling the dependent Edge.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('public.safe2pay_order_transactions') IS NULL OR to_regclass('public.orders') IS NULL
    OR to_regclass('public.safe2pay_webhook_events') IS NULL THEN
   RAISE EXCEPTION 'apois_safe2pay_atomic_prerequisite_missing';
 END IF;
 IF to_regprocedure('public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)') IS NOT NULL THEN
   RAISE EXCEPTION 'apois_safe2pay_atomic_rpc_already_exists_review_before_replacing';
 END IF;
END;
$preflight$;
CREATE FUNCTION public.apois_safe2pay_apply_event_atomic(
 _provider_transaction_id bigint, _status_code text, _reference text,
 _amount numeric, _payload_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_tx public.safe2pay_order_transactions%ROWTYPE;
 v_order public.orders%ROWTYPE;
 v_event_key text := 'safe2pay:orders:' || _provider_transaction_id::text || ':' || _status_code;
 v_target text;
 v_current_rank int;
 v_next_rank int;
 v_current text;
 v_mapped text;
 v_ignored boolean := false;
BEGIN
 IF _provider_transaction_id IS NULL OR _provider_transaction_id <= 0
    OR _status_code IS NULL OR _reference IS NULL
    OR _amount IS NULL OR _amount < 0 OR _payload_hash IS NULL OR length(_payload_hash) <> 64
    OR length(_reference) > 256 OR length(_status_code) > 20 THEN
    RAISE EXCEPTION 'invalid_safe2pay_event' USING ERRCODE='22023';
 END IF;
 IF left(_reference,length('apois-order-')) <> 'apois-order-' THEN
    RAISE EXCEPTION 'safe2pay_product_reference_mismatch' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_tx FROM public.safe2pay_order_transactions
 WHERE provider_transaction_id = _provider_transaction_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'safe2pay_transaction_not_found' USING ERRCODE='P0002'; END IF;
 IF v_tx.reference IS DISTINCT FROM _reference
    OR round(v_tx.amount,2) IS DISTINCT FROM round(_amount,2) THEN
    RAISE EXCEPTION 'safe2pay_transaction_reference_or_amount_mismatch' USING ERRCODE='23514';
 END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=v_tx.order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'safe2pay_order_not_found' USING ERRCODE='P0002'; END IF;
 IF v_order.payment_method IS DISTINCT FROM 'pix' THEN
    RAISE EXCEPTION 'safe2pay_payment_method_mismatch' USING ERRCODE='23514';
 END IF;
 v_mapped := CASE _status_code
   WHEN '1' THEN 'pending' WHEN '2' THEN 'processing'
   WHEN '3' THEN 'authorized' WHEN '6' THEN 'refunded'
   WHEN '13' THEN 'chargeback' ELSE NULL END;
 IF v_mapped IS NULL THEN
   INSERT INTO public.safe2pay_webhook_events
   (provider_transaction_id,transaction_status_code,event_key,payload_hash,processed_at,processing_error)
   VALUES (_provider_transaction_id,_status_code,v_event_key,_payload_hash,now(),'unsupported_status:'||_status_code)
   ON CONFLICT(event_key) DO UPDATE SET processed_at=excluded.processed_at,
      processing_error=excluded.processing_error;
   RETURN jsonb_build_object('ok',true,'ignored',true,'reason','unsupported_status');
 END IF;
 v_current := v_tx.status;
 -- A late successful charge after a locally terminal failed/expired transaction
 -- cannot be discarded as a stale status. Record unresolved work for authorized review.
 IF v_current IN ('failed','expired') AND v_mapped='authorized' THEN
   INSERT INTO public.safe2pay_webhook_events
   (provider_transaction_id,transaction_status_code,event_key,payload_hash,processed_at,processing_error)
   VALUES (_provider_transaction_id,_status_code,v_event_key,_payload_hash,NULL,'authorized_after_failed_or_expired_manual_review')
   ON CONFLICT(event_key) DO UPDATE SET processed_at=NULL,
      processing_error=excluded.processing_error;
   RETURN jsonb_build_object('ok',false,'manual_review',true,'reason','authorized_after_terminal');
 END IF;
 v_current_rank := CASE v_current WHEN 'pending' THEN 10 WHEN 'processing' THEN 20
   WHEN 'authorized' THEN 30 WHEN 'expired' THEN 40 WHEN 'failed' THEN 40
   WHEN 'refunded' THEN 50 WHEN 'chargeback' THEN 60 ELSE 0 END;
 v_next_rank := CASE v_mapped WHEN 'pending' THEN 10 WHEN 'processing' THEN 20
   WHEN 'authorized' THEN 30 WHEN 'refunded' THEN 50 WHEN 'chargeback' THEN 60 ELSE 0 END;
 IF v_current IN ('refunded','chargeback') OR v_current_rank > v_next_rank THEN
   v_target := v_current;
   v_ignored := (v_target IS DISTINCT FROM v_mapped);
 ELSE
   v_target := v_mapped;
 END IF;
 IF v_target = 'chargeback' THEN
   -- Do not fabricate a refund, reverse any ledger or silently acknowledge a chargeback.
   INSERT INTO public.safe2pay_webhook_events
   (provider_transaction_id,transaction_status_code,event_key,payload_hash,processed_at,processing_error)
   VALUES (_provider_transaction_id,_status_code,v_event_key,_payload_hash,NULL,'manual_chargeback_reconciliation_required')
   ON CONFLICT(event_key) DO UPDATE SET processed_at=NULL,
     processing_error=excluded.processing_error;
   RETURN jsonb_build_object('ok',false,'manual_review',true,'reason','chargeback');
 END IF;

  
 IF v_target='authorized' THEN
   IF v_order.status IN ('cancelled','refunded') OR v_order.payment_status='refunded' THEN
     RAISE EXCEPTION 'safe2pay_order_terminal_requires_review' USING ERRCODE='23514';
   END IF;
   IF v_order.payment_status='paid' AND (v_current NOT IN ('authorized','refunded')
      OR EXISTS (SELECT 1 FROM public.payments p
         WHERE p.order_id=v_order.id AND p.status='paid'
         AND p.provider IS DISTINCT FROM 'safe2pay')) THEN
     RAISE EXCEPTION 'safe2pay_order_already_paid_requires_review' USING ERRCODE='23514';
   END IF;
 ELSIF v_target='refunded' THEN
   IF v_order.payment_status='paid' AND EXISTS (SELECT 1 FROM public.payments p
       WHERE p.order_id=v_order.id AND p.status='paid'
       AND p.provider IS DISTINCT FROM 'safe2pay') THEN
     RAISE EXCEPTION 'safe2pay_order_refund_provider_conflict' USING ERRCODE='23514';
   END IF;
 END IF;

 -- All writes below are in ONE PostgreSQL transaction; trigger failures roll back all.
 IF v_target IS DISTINCT FROM v_current THEN
   UPDATE public.safe2pay_order_transactions SET status=v_target,updated_at=now(),
      authorized_at=CASE WHEN v_target='authorized' THEN coalesce(authorized_at,now()) ELSE authorized_at END,
      refunded_at=CASE WHEN v_target='refunded' THEN coalesce(refunded_at,now()) ELSE refunded_at END
   WHERE id=v_tx.id;
 END IF;
 
 IF v_target='authorized' AND v_order.payment_status IS DISTINCT FROM 'paid' THEN
   UPDATE public.orders SET payment_status='paid' WHERE id=v_order.id;
 ELSIF v_target='refunded' AND v_order.payment_status IS DISTINCT FROM 'refunded' THEN
   UPDATE public.orders SET payment_status='refunded' WHERE id=v_order.id;
 END IF;
 
 INSERT INTO public.safe2pay_webhook_events
 (provider_transaction_id,transaction_status_code,event_key,payload_hash,processed_at,processing_error)
 VALUES (_provider_transaction_id,_status_code,v_event_key,_payload_hash,now(),NULL)
 ON CONFLICT (event_key) DO UPDATE SET processed_at=excluded.processed_at,
    processing_error=NULL;
 RETURN jsonb_build_object('ok',true,'ignored',v_ignored,'status',v_target,
   'transactionId',_provider_transaction_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)
 TO service_role;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.apois_safe2pay_apply_event_atomic(bigint,text,text,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION 'apois_safe2pay_atomic_rpc_bad_grants'; END IF;
END;
$acl$;
COMMIT;
