-- Corridas / staged ACL only. Do not apply to production without staging QA.
-- Production pg_catalog 2026-11-04: both tables have RLS/only own-SELECT policy
-- but anon/authenticated were granted ALL, including TRUNCATE (RLS bypass).
-- Preserve authenticated read-own policy; mutations belong to service_role.
-- No monthly status, fee, provider, schema, API or payment record changes.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
 public.driver_memberships, public.driver_membership_charges
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
 public.driver_memberships, public.driver_membership_charges
TO authenticated;
GRANT ALL PRIVILEGES ON TABLE
 public.driver_memberships, public.driver_membership_charges
TO service_role;
COMMIT;
