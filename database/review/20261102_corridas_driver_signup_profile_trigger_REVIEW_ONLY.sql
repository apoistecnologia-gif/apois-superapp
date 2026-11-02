-- APOIS Corridas | REVIEW ONLY — NOT APPLIED TO PRODUCTION
-- Purpose: create public.users for NEW authenticated driver sign-ups before
-- driver_complete_registration_v3; do not affect passengers, admins, or prior users.
-- Requires independent approval, review, QA and explicit migration authorization.
-- Observed on 2026-11-02: public.handle_new_user() exists; no user-defined
-- trigger found on auth.users. The RPC aborts with profile_missing if the
-- internal identity is absent.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth' AND c.relname='users'
      AND t.tgname='apois_driver_auth_signup_profile'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER apois_driver_auth_signup_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN ((NEW.raw_user_meta_data ->> 'role') = 'driver')
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;
COMMIT;

-- Review after explicit deployment:
-- SELECT tgname FROM pg_trigger WHERE tgname='apois_driver_auth_signup_profile';
-- SELECT count(*) FROM auth.users a LEFT JOIN public.users u ON u.auth_user_id=a.id
--   WHERE a.raw_user_meta_data->>'role'='driver' AND u.id IS NULL;
-- No existing users are backfilled by this trigger.
-- Rollback (requires approval): DROP TRIGGER IF EXISTS apois_driver_auth_signup_profile ON auth.users;
