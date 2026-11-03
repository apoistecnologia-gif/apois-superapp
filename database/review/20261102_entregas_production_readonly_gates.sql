-- APOIS ENTREGAS / READ-ONLY QA — project ptgkwyyolrdgnqketkjj.
-- SELECT-only evidence. No identities/PII/UUIDs, no payments, no grants changed.
-- Database grants must be verified separately from GitHub WEB build checks.
SELECT p.proname,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executable,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executable,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_executable,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'dispatch_delivery_job_offers','ensure_cancelled_paid_order_refund',
    'reserve_paid_order_merchant_net','reverse_paid_order_merchant_reserve'
  ) ORDER BY p.proname;

-- Potential historical refund reconciliation: must compare provider independently before any refund action.
SELECT o.payment_method,p.provider,p.status AS payment_status,
       count(*) AS cancelled_paid_without_refund,
       round(sum(p.amount)::numeric,2) AS amount_registered_brl
FROM public.orders o
JOIN public.payments p ON p.order_id=o.id
WHERE o.status='cancelled' AND o.payment_status='paid' AND p.status='paid'
  AND NOT EXISTS (SELECT 1 FROM public.refunds r WHERE r.payment_id=p.id)
GROUP BY o.payment_method,p.provider,p.status;

-- Paid orders whose delivery attempt ended without completed fulfillment; may be historical test data.
SELECT o.status AS order_status,dj.status AS job_status,count(*) AS unresolved_count,
       min(o.created_at)::date AS oldest_order_day
FROM public.orders o JOIN public.delivery_jobs dj ON dj.order_id=o.id
WHERE o.payment_status='paid'
  AND o.status IN ('ready','confirmed','accepted','preparing','searching_driver')
  AND dj.status='cancelled'
GROUP BY o.status,dj.status;

-- Courier cannot activate online until Android push token registered.
SELECT count(*) AS approved_active_without_android_push
FROM public.couriers c
WHERE c.status='approved' AND c.is_active
  AND NOT EXISTS (SELECT 1 FROM public.push_devices d
    WHERE d.user_id=c.user_id AND d.platform='android' AND d.is_active);
