#!/usr/bin/env bash
# Disposable PostgreSQL 17 fixture; never connects to any Supabase instance.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo '[FAIL] Docker required for isolated PostgreSQL fixture'; exit 1; }
node scripts/qa/verify-corridas-public-rpc-acl-v1.mjs
node scripts/qa/verify-driver-monthly-release-hold-v1.mjs
node scripts/qa/verify-forward-schema-preflights-v1.mjs
node scripts/qa/test-partner-static-assets-v1.mjs
node scripts/qa/test-client-static-assets-v1.mjs
node scripts/qa/test-js-module-asset-integrity-v1.mjs
node scripts/qa/test-android-apk-web-assets-gate-v1.mjs
node scripts/qa/test-codemagic-android-version-v1.mjs
node scripts/qa/test-android-apk-badging-v1.mjs
node scripts/qa/test-client-qa-signing-fail-closed-v1.mjs
node scripts/qa/test-photon-reverse-retry-v1.mjs
node scripts/qa/test-partner-qa-debug-signing-v1.mjs
node scripts/qa/verify-corridas-monthly-table-acl-v1.mjs
node scripts/qa/verify-corridas-wallet-cancellation-acl-v1.mjs
node scripts/qa/verify-corridas-payment-settlement-acl-v1.mjs
node scripts/qa/verify-entregas-subscription-table-acl-v1.mjs
node scripts/qa/verify-entregas-finance-truncate-acl-v1.mjs
node scripts/qa/verify-entregas-finance-least-privilege-v1.mjs
node scripts/qa/verify-corridas-sensitive-rpc-acl-v1.mjs
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
# SAFETY GATE: run the full, UNMODIFIED staged Corridas operational migration
# in its own empty disposable DB and REQUIRE its deliberate SQLSTATE 55000
# BEFORE it can touch any production-equivalent function. This protects against
# accidentally deploying a monthly-fee bypass as a successful migration.
# New R$59.90 contract only for future signups, no repricing existing R$49.90 contracts.
# Full staged SQL executed only against disposable PostgreSQL 17.
docker exec "$name" createdb -U postgres driver_new_price_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_new_price_qa < scripts/qa/corridas-driver-new-price-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_new_price_qa < supabase/corridas-forward-migrations/20261104121500_driver_5990_new_memberships_preserve_legacy_STAGE_ONLY.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d driver_new_price_qa < scripts/qa/corridas-driver-new-price-assertions-v1.sql
docker exec "$name" createdb -U postgres driver_billing_release_hold_qa
if billing_gate_log=$(docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U postgres -d driver_billing_release_hold_qa < supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql 2>&1); then
 echo '[FAIL] Corridas operational migration unexpectedly succeeded without paid monthly membership'
 exit 1
fi
if ! printf '%s\n' "$billing_gate_log" | grep -Fq 'APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED' ||
   ! printf '%s\n' "$billing_gate_log" | grep -Fq '55000'; then
 echo '[FAIL] Corridas operational migration failed for a different reason instead of monthly billing HOLD'
 printf '%s\n' "$billing_gate_log" >&2
 exit 1
fi
if ! docker exec "$name" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d driver_billing_release_hold_qa -c "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('apois_rpc_private','private') AND p.proname IN ('driver_set_presence','driver_finish_ride')" | grep -qx '0'; then
 echo '[FAIL] Corridas membership release HOLD allowed operational RPC writes'
 exit 1
fi
echo '[PASS] Full staged Corridas migration fails SQLSTATE 55000 before replacing any driver RPC without verified paid monthly membership'
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
# Run two genuinely concurrent SQL sessions against one cash ride. The losing
# driver must block on a PG row lock and then fail without partial mutations.
bash scripts/qa/test-ride-acceptance-race-v1.sh "$name"
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
# Dedicated disposable PG17 DB for production-derived membership RLS and ACL.
# Run the exact staged migration and test real PostgreSQL permissions as anon/auth.
docker exec "$name" createdb -U postgres corridas_membership_acl_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-driver-monthly-table-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < supabase/corridas-forward-migrations/20261104043000_restrict_driver_membership_financial_table_acl.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-driver-monthly-table-acl-assertions-v1.sql
# Extend the existing isolated Corridas ACL database with wallets/cancellation.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-wallet-cancellation-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < supabase/corridas-forward-migrations/20261104050000_restrict_wallet_cancellation_financial_table_acl.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-wallet-cancellation-acl-assertions-v1.sql
# Additional synthetic P0 finance grants, policies, and read-only settlement gates.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-payment-settlement-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < supabase/corridas-forward-migrations/20261104051000_restrict_payout_payment_settlement_table_acl.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_membership_acl_qa < scripts/qa/corridas-payment-settlement-acl-assertions-v1.sql
# Entregas: standalone monthly merchant subscription/events security check
# against disposable PG17 with production-derived own/admin SELECT policies.
docker exec "$name" createdb -U postgres entregas_subscription_acl_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-merchant-subscription-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < supabase/entregas-forward-migrations/20261104044500_restrict_merchant_subscription_financial_table_acl.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-merchant-subscription-acl-assertions-v1.sql
# Close RLS-unprotected TRUNCATE without changing other Entregas client grants.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-finance-truncate-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < supabase/entregas-forward-migrations/20261104062000_restrict_entregas_financial_truncate_acl_NOT_DEPLOYED.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-finance-truncate-acl-assertions-v1.sql
# Full finance grant review: backend-only nine tables; owner payout_accounts writes preserved.
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-finance-least-privilege-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < supabase/entregas-forward-migrations/20261104063000_restrict_financial_table_crud_acl_NOT_DEPLOYED.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_subscription_acl_qa < scripts/qa/entregas-finance-least-privilege-assertions-v1.sql
# Critical Entregas financial/admin RPCs: anonymous EXECUTE is unnecessary.
# Apply the exact staged ACL on dummy functions with the real signatures.
# No payouts, no financial data and no Supabase production connection.
node scripts/qa/verify-entregas-admin-finance-rpc-acl-v1.mjs
docker exec "$name" createdb -U postgres entregas_admin_finance_acl_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_admin_finance_acl_qa < scripts/qa/entregas-admin-finance-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_admin_finance_acl_qa < supabase/entregas-forward-migrations/20261104060000_restrict_critical_admin_finance_rpc_acl_NOT_DEPLOYED.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d entregas_admin_finance_acl_qa < scripts/qa/entregas-admin-finance-acl-assertions-v1.sql
# Additional fully isolated database for elevated public RPC ACL hardening:
# no real users, no finance, no JWT and no production SQL writes.
docker exec "$name" createdb -U postgres corridas_sensitive_acl_qa
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_sensitive_acl_qa < scripts/qa/corridas-sensitive-rpc-acl-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_sensitive_acl_qa < supabase/corridas-forward-migrations/20261104031000_restrict_sensitive_admin_and_pix_public_rpc_acl.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d corridas_sensitive_acl_qa < scripts/qa/corridas-sensitive-rpc-acl-assertions-v1.sql
echo '[PASS] Real PostgreSQL 17 synthetic cash RLS, driver registration, ride acceptance and queued-ride completion. Production untouched.'
