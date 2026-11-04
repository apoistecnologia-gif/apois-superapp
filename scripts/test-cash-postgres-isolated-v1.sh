#!/usr/bin/env bash
# Disposable PostgreSQL 17 fixture; never connects to any Supabase instance.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo '[FAIL] Docker required for isolated PostgreSQL fixture'; exit 1; }
node scripts/qa/verify-corridas-public-rpc-acl-v1.mjs
node scripts/qa/verify-forward-schema-preflights-v1.mjs
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
# Separate disposable database using production-derived cash admission and legacy
# merchant-subscription functions. Confirm general rollout is still BLOCKED.
docker exec "$name" createdb -U postgres entregas_payment_admission_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < scripts/qa/entregas-payment-admission-qa-v1.sql
# Verify the unapplied fix inside the sixth synthetic database.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < supabase/entregas-forward-migrations/20261104010000_guard_merchant_subscription_fail_closed.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < scripts/qa/entregas-subscription-approved-assertions-v1.sql
# Backend-only RPCs: recover the missing PUBLIC revoke in synthetic PG17.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < scripts/qa/entregas-checkout-rpc-acl-qa-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < supabase/entregas-forward-migrations/20261104011000_checkout_rpc_service_role_only.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_payment_admission_qa < scripts/qa/entregas-checkout-rpc-acl-assertions-v1.sql
# Read-only verified production trigger is rehearsed after standard cash tests.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/entregas-payment-stage-trigger-qa-v1.sql
# Cash terminal reconciliation is verified with synthetic gateway/refund anomalies.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/entregas-cash-terminal-reconciliation-v1.sql
# Production-derived cash-test triggers and authorization on real staged cancel RPC.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/entregas-cash-qa-triggers-v1.sql
# Prevent the temporary QA merchant's absence from blocking unrelated Pix.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/entregas-forward-migrations/20261104012000_qa_missing_merchant_guard.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/entregas-qa-null-merchant-assertions-v1.sql
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
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-rpc-privileges-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-rpc-privileges-assertions-v1.sql
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa -c   'CREATE TRIGGER qa_enforce_driver_stage BEFORE UPDATE OF status, driver_id ON public.rides FOR EACH ROW EXECUTE FUNCTION private.enforce_driver_operational_stage_transition()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-presence-assertions-v1.sql
# Post-approval KYC revocation: clear cached online state, keep active GPS tracking.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-presence-kyc-revocation-v1.sql
# Suspended, blocked and disapproved cached-online drivers must also clear
# availability. Active-trip GPS remains possible while not eligible.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_operations_qa < scripts/qa/driver-presence-ineligibility-revocation-v1.sql
# Fourth isolated QA database: execute both actual staged acceptance RPCs
# to prove Safe2Pay is disabled and legitimate direct cash still works.
docker exec "$name" createdb -U postgres ride_acceptance_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/driver-presence-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/ride-acceptance-fixture-v1.sql
node scripts/qa/extract-corridas-acceptance-sql-v1.mjs | docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa -c   'CREATE TRIGGER qa_enforce_driver_stage BEFORE UPDATE OF status, driver_id ON public.rides FOR EACH ROW EXECUTE FUNCTION private.enforce_driver_operational_stage_transition()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/driver-rpc-privileges-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/driver-rpc-privileges-assertions-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_acceptance_qa < scripts/qa/ride-acceptance-assertions-v1.sql
# Seventh disposable database: actual staged trigger for opportunistic
# offers to already busy drivers. Rehearse GPS range/time/eligibility filters.
docker exec "$name" createdb -U postgres ride_busy_candidates_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_busy_candidates_qa < scripts/qa/driver-presence-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_busy_candidates_qa < scripts/qa/ride-acceptance-fixture-v1.sql
node scripts/qa/extract-corridas-busy-candidates-sql-v1.mjs | docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_busy_candidates_qa
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_busy_candidates_qa -c 'CREATE TRIGGER qa_busy_candidates BEFORE UPDATE OF candidate_driver_ids ON public.rides FOR EACH ROW EXECUTE FUNCTION public.append_nearby_busy_driver_candidates()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_busy_candidates_qa < scripts/qa/corridas-busy-driver-candidates-v1.sql
# Fifth fully isolated PostgreSQL database: cash ride completion + queued-ride
# promotion/release. Same migration SQL, synthetic identities and no money.
docker exec "$name" createdb -U postgres ride_finish_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/driver-presence-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/ride-acceptance-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/ride-finish-fixture-v1.sql
node scripts/qa/extract-corridas-finish-sql-v1.mjs | docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa -c   'CREATE TRIGGER qa_enforce_driver_stage BEFORE UPDATE OF status, driver_id ON public.rides FOR EACH ROW EXECUTE FUNCTION private.enforce_driver_operational_stage_transition()'
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/driver-rpc-privileges-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/driver-rpc-privileges-assertions-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d ride_finish_qa < scripts/qa/ride-finish-assertions-v1.sql
echo '[PASS] Real PostgreSQL 17 synthetic cash RLS, driver registration, ride acceptance and queued-ride completion. Production untouched.'
