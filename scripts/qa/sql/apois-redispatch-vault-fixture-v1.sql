-- Ephemeral CI-only stand-ins for Supabase Vault and pgcrypto. Never production.
-- Tests run the REAL scheduler-auth migration, never real credentials.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;
CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(integer)
RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
CREATE OR REPLACE FUNCTION extensions.digest(text,text)
RETURNS bytea LANGUAGE sql AS $$ SELECT public.digest($1,$2) $$;
CREATE TABLE vault.secrets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  secret text NOT NULL,
  description text
);
CREATE VIEW vault.decrypted_secrets AS SELECT name, secret AS decrypted_secret FROM vault.secrets;
CREATE FUNCTION vault.create_secret(
  new_secret text,
  new_name text DEFAULT NULL,
  new_description text DEFAULT ''::text,
  new_key_id uuid DEFAULT NULL::uuid
)
RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE result uuid;
BEGIN
  INSERT INTO vault.secrets(name,secret,description)
  VALUES (new_name,new_secret,new_description) RETURNING id INTO result;
  RETURN result;
END
$fn$;
