-- Reproduce read-only inspected Corridas production EXECUTE boundaries
-- (2026-11-03): private SECURITY DEFINER RPCs are service_role-only;
-- public SECURITY DEFINER wrappers expose authenticated/anon/service_role.
-- Synthetic isolated PostgreSQL only; JWT signature validation is NOT tested.
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA apois_rpc_private TO service_role;
DO $bootstrap$
BEGIN
 IF to_regprocedure('apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric)
    FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric)
    TO service_role;
  EXECUTE $sql$CREATE OR REPLACE FUNCTION public.driver_set_presence(
      _online boolean, _lat numeric DEFAULT NULL::numeric,
      _lng numeric DEFAULT NULL::numeric,
      _heading numeric DEFAULT NULL::numeric,
      _speed numeric DEFAULT NULL::numeric)
    RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
    AS $body$ SELECT apois_rpc_private.driver_set_presence($1,$2,$3,$4,$5); $body$;$sql$;
  REVOKE ALL ON FUNCTION public.driver_set_presence(boolean,numeric,numeric,numeric,numeric) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.driver_set_presence(boolean,numeric,numeric,numeric,numeric)
    TO anon, authenticated, service_role;
 END IF;
 IF to_regprocedure('apois_rpc_private.driver_accept_ride(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION apois_rpc_private.driver_accept_ride(uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION apois_rpc_private.driver_accept_ride(uuid) TO service_role;
  EXECUTE $sql$CREATE OR REPLACE FUNCTION public.driver_accept_ride(_ride_id uuid)
    RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
    AS $body$ SELECT apois_rpc_private.driver_accept_ride($1); $body$;$sql$;
  REVOKE ALL ON FUNCTION public.driver_accept_ride(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.driver_accept_ride(uuid) TO anon, authenticated, service_role;
 END IF;
 IF to_regprocedure('apois_rpc_private.driver_accept_ride_candidate_legacy(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION apois_rpc_private.driver_accept_ride_candidate_legacy(uuid)
    FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION apois_rpc_private.driver_accept_ride_candidate_legacy(uuid)
    TO service_role;
 END IF;
 IF to_regprocedure('apois_rpc_private.driver_finish_ride(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION apois_rpc_private.driver_finish_ride(uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION apois_rpc_private.driver_finish_ride(uuid) TO service_role;
  EXECUTE $sql$CREATE OR REPLACE FUNCTION public.driver_finish_ride(_ride_id uuid)
    RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
    AS $body$ SELECT apois_rpc_private.driver_finish_ride($1); $body$;$sql$;
  REVOKE ALL ON FUNCTION public.driver_finish_ride(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.driver_finish_ride(uuid) TO anon, authenticated, service_role;
 END IF;
 IF to_regprocedure('private.enforce_driver_operational_stage_transition()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION private.enforce_driver_operational_stage_transition()
    FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION private.enforce_driver_operational_stage_transition()
    TO service_role;
 END IF;
 REVOKE ALL ON FUNCTION private.driver_kyc_is_ready(uuid) FROM PUBLIC, anon, authenticated;
 GRANT EXECUTE ON FUNCTION private.driver_kyc_is_ready(uuid) TO service_role;
END;
$bootstrap$;
