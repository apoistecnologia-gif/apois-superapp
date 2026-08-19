-- APOIS Entregas production hardening.
-- Trigger functions do not need to be directly callable by app roles.
revoke execute on function public.guard_merchant_delivery_location() from public, anon, authenticated;
grant execute on function public.guard_merchant_delivery_location() to service_role;
