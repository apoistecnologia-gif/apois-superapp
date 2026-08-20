alter table public.driver_memberships
  drop constraint if exists driver_memberships_provider_check;

alter table public.driver_memberships
  add constraint driver_memberships_provider_check
  check (provider = any (array['asaas'::text, 'mercadopago'::text]));
