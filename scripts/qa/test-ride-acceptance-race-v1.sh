#!/usr/bin/env bash
# Real two-session PostgreSQL contention, isolated to the no-network PG17
# container that test-cash-postgres-isolated-v1.sh already owns.
set -euo pipefail
test "$#" -eq 1 || { echo '[FAIL] QA container argument required'; exit 1; }
container="$1"
database=ride_acceptance_qa
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" < scripts/qa/ride-acceptance-race-fixture-v1.sql

tmp="$(mktemp -d)"
cleanup(){
  rm -f "$tmp/first.log" "$tmp/second.log"
  rmdir "$tmp"
}
trap cleanup EXIT
dump_logs(){
  echo '[QA] First contender:' >&2
  cat "$tmp/first.log" >&2
  echo '[QA] Second contender:' >&2
  if test -f "$tmp/second.log"; then cat "$tmp/second.log" >&2; fi
}
fail(){
  echo "[FAIL] $1" >&2
  dump_logs
  exit 1
}

# First driver accepts but keeps the row lock during a short open transaction.
# The second must actually wait for that lock, then fail after first commits.
(
 timeout 25s docker exec -i "$container" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d "$database" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',true);
SELECT public.driver_accept_ride('30000000-0000-4000-8000-000000000122');
\echo QA_FIRST_ACCEPTED
SELECT pg_sleep(8);
COMMIT;
SQL
) > "$tmp/first.log" 2>&1 &
first_pid="$!"

first_started=false
for _ in $(seq 1 80); do
 if grep -q 'QA_FIRST_ACCEPTED' "$tmp/first.log"; then first_started=true; break; fi
 if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
 sleep 0.1
done
test "$first_started" = true || fail 'First driver did not reach accepted state'
kill -0 "$first_pid" 2>/dev/null || fail 'First driver released lock prematurely'

(
 timeout 25s docker exec -i "$container" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d "$database" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',true);
SELECT public.driver_accept_ride('30000000-0000-4000-8000-000000000122');
COMMIT;
SQL
) > "$tmp/second.log" 2>&1 &
second_pid="$!"

# Query pg_stat_activity inside the same disposable database so this proves
# a real PostgreSQL lock conflict instead of two unrelated sequential calls.
contention_seen=false
for _ in $(seq 1 55); do
 locks="$(docker exec "$container" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d "$database" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='$database' AND wait_event_type='Lock' AND query ILIKE '%driver_accept_ride(%'")"
 if test "$locks" -ge 1; then contention_seen=true; break; fi
 if ! kill -0 "$second_pid" 2>/dev/null; then break; fi
 sleep 0.1
done
test "$contention_seen" = true || fail 'Concurrent ride accept did not contend on PostgreSQL row lock'

if ! wait "$first_pid"; then fail 'First ride acceptance failed'; fi
if wait "$second_pid"; then fail 'Second driver incorrectly accepted the same ride'; fi
grep -q 'ride_offer_unavailable' "$tmp/second.log" ||
 fail 'Second driver failed for an unrelated reason, not consumed offer'

docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" < scripts/qa/ride-acceptance-race-assertions-v1.sql
echo '[PASS] PostgreSQL 17 parallel driver acceptance: lock contention observed, one winner and one rejected loser'
