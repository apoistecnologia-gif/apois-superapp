-- APOIS Superapp / Entregas production hardening.
-- Keep admin RPCs callable by authenticated admin sessions, but never anonymously.
-- The function bodies already enforce current_user_is_admin(); these grants add
-- defense in depth at the API privilege layer.

revoke execute on function public.admin_create_merchant(
  uuid, uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean
) from public, anon;
grant execute on function public.admin_create_merchant(
  uuid, uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean
) to authenticated, service_role;

revoke execute on function public.admin_delete_merchant(uuid) from public, anon;
grant execute on function public.admin_delete_merchant(uuid) to authenticated, service_role;

revoke execute on function public.admin_suspend_merchant(uuid, boolean, text) from public, anon;
grant execute on function public.admin_suspend_merchant(uuid, boolean, text) to authenticated, service_role;

-- Trigger helper is not an API endpoint. Pin its lookup path to remove mutable
-- search_path behavior without changing its delivery-location guard logic.
alter function public.guard_merchant_delivery_location() set search_path = '';
