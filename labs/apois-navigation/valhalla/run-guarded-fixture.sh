#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$BASE/../passenger-provenance-snapshot"
OUT="$1"
docker run -d --name apois-provenance-fixture --network none -e POSTGRES_PASSWORD=synthetic_ci_only -e POSTGRES_DB=apois_navigation_fixture postgres:17
trap 'docker rm -f apois-provenance-fixture >/dev/null 2>&1 || true' EXIT
ready=0
for n in $(seq 1 60); do
  if docker exec apois-provenance-fixture pg_isready -h 127.0.0.1 -U postgres -d apois_navigation_fixture; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
for file in fixture.sql schema.sql; do
  docker exec -i apois-provenance-fixture psql -X -U postgres -d apois_navigation_fixture -v ON_ERROR_STOP=1 < "$ROOT/experimental/apois-navigation/$file"
done
docker exec -i apois-provenance-fixture psql -X -U postgres -d apois_navigation_fixture -v ON_ERROR_STOP=1 < "$ROOT/revocation-fixture.sql"
node "$BASE/guarded-regional-smoke.mjs" "$OUT"
