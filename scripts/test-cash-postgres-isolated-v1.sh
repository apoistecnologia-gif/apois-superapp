#!/usr/bin/env bash
# Disposable PostgreSQL 17 fixture; never connects to any Supabase instance.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo '[FAIL] Docker required for isolated PostgreSQL fixture'; exit 1; }
name="apois-cash-pg-qa-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# No host ports and no container network: no external DB/API access at test time.
docker run --detach --rm --network none --name "$name" \
  -e POSTGRES_PASSWORD=disposable-local-only \
  postgres:17.6-alpine >/dev/null
# Official Postgres entrypoint starts a temporary init server and restarts it.
# pg_isready can return success during the temporary phase: wait for initialization
# completion, then prove a SQL roundtrip against the final server.
ready=false
for _ in $(seq 1 60); do
 if docker logs "$name" 2>&1 | grep -Fq 'PostgreSQL init process complete'; then
  if docker exec "$name" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'select 1' 2>/dev/null | grep -qx '1'; then
   ready=true
   break
  fi
 fi
 sleep 1
done
test "$ready" = true || { echo '[FAIL] Disposable PostgreSQL did not finish initialization'; docker logs "$name" >&2; exit 1; }
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/cash-postgres-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/cash-postgres-assertions-v1.sql
# Independent empty database for the Motorista approved-status protection.
docker exec "$name" createdb -U postgres driver_guard_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_guard_qa < scripts/qa/driver-registration-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_guard_qa < database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_guard_qa < scripts/qa/driver-registration-assertions-v1.sql
# Verify the ACTUAL staged Corridas online/stage-transition functions as SQL
# in a third synthetic, isolated database. No production migration is applied.
docker exec "$name" createdb -U postgres driver_operations_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-presence-fixture-v1.sql
node scripts/qa/extract-corridas-operational-sql-v1.mjs | docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa -c   'GRANT EXECUTE ON FUNCTION apois_rpc_private.driver_set_presence(boolean,numeric,numeric,numeric,numeric) TO authenticated'
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa -c   'CREATE TRIGGER qa_enforce_driver_stage BEFORE UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION private.enforce_driver_operational_stage_transition()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-presence-assertions-v1.sql
# Fourth isolated QA database: execute both actual staged acceptance RPCs
# to prove Safe2Pay is disabled and legitimate direct cash still works.
docker exec "$name" createdb -U postgres ride_acceptance_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/driver-presence-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/ride-acceptance-fixture-v1.sql
node scripts/qa/extract-corridas-acceptance-sql-v1.mjs | docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa -c   'CREATE TRIGGER qa_enforce_driver_stage BEFORE UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION private.enforce_driver_operational_stage_transition()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/ride-acceptance-assertions-v1.sql
echo '[PASS] Real PostgreSQL 17 synthetic cash RLS, driver registration, presence and cash-ride acceptance. Production untouched.'
