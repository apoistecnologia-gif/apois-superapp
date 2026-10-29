-- Read-only readiness diagnostic: APOIS TESTE Entregas in existing production project.
-- Does not activate subscriptions, accept payments, create orders, or dispatch.
SELECT
  m.id AS test_merchant_id,
  m.name AS test_merchant_name,
  m.approval_status = 'approved' AND m.is_active AND m.delivery_enabled AND NOT m.temporarily_closed AS merchant_enabled,
  (m.latitude IS NOT NULL AND m.longitude IS NOT NULL) AS merchant_gps_configured,
  (m.city_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.cities city WHERE city.id=m.city_id AND city.is_active)) AS city_ready,
  public.merchant_accepting_orders(m.id,now()) AS merchant_can_receive_orders,
  (SELECT count(*) FROM public.products p WHERE p.merchant_id=m.id AND p.is_available) AS available_products,
  (SELECT count(*) FROM private.apois_test_cash_access acl WHERE acl.merchant_id=m.id AND acl.enabled AND acl.expires_at>now()) AS active_cash_test_permissions,
  (SELECT count(*) FROM public.customer_addresses a
   JOIN auth.users u ON u.id=a.user_id
   WHERE u.email='qa-cliente@apois-test.dev'
     AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL) AS customer_saved_gps_addresses,
  (SELECT count(*) FROM public.couriers c
   JOIN auth.users u ON u.id=c.user_id
   JOIN public.courier_availability av ON av.courier_id=c.id
   JOIN public.courier_locations loc ON loc.courier_id=c.id
   WHERE u.email='homolog-qa-2026@apois-test.dev'
     AND c.status='approved' AND c.is_active AND av.is_online
     AND loc.recorded_at > now()-interval '30 minutes'
     AND av.last_seen_at > now()-interval '30 minutes'
     AND loc.accuracy_meters IS NOT NULL AND loc.accuracy_meters BETWEEN 0 AND 100
     AND m.latitude IS NOT NULL AND m.longitude IS NOT NULL
     AND public.haversine_km(loc.latitude,loc.longitude,m.latitude,m.longitude) <=
       COALESCE((SELECT city.courier_dispatch_radius_km FROM public.cities city WHERE city.id=m.city_id),0)
   ) AS eligible_qa_couriers,
  (SELECT count(*) FROM private.apois_test_cash_orders t WHERE t.merchant_id=m.id) AS completed_or_pending_test_order_count,
  (SELECT count(*) FROM public.wallet_transactions wt WHERE wt.idempotency_key LIKE 'order-merchant:%'
     AND wt.reference_id IN (
        SELECT t.order_id::text FROM private.apois_test_cash_orders t WHERE t.merchant_id=m.id)
   ) AS unexpected_wallet_transactions
FROM public.merchants m
WHERE m.slug='apois-teste-entregas-homologacao-20261029';
