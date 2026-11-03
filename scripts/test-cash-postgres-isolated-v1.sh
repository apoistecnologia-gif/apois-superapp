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
ready=false
for _ in $(seq 1 35); do
 if docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=true;break;fi
 sleep 1
done
test "$ready" = true || { echo '[FAIL] Disposable PostgreSQL did not become ready'; exit 1; }
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/cash-postgres-fixture-v1.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/qa/cash-postgres-assertions-v1.sql
echo '[PASS] Real PostgreSQL 17 synthetic RLS / merchant cash cancellation checks. Production untouched.'
