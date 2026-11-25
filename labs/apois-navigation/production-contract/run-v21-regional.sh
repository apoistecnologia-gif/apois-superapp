#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="$ROOT/.."
OUT="$1"
mkdir -p "$OUT"
CACHE="$BASE/valhalla/.regional-cache"
WORK="$(mktemp -d)"
NAME="apois-v21-valhalla-$$"
cleanup(){
  local code=$?
  trap - EXIT
  docker logs "$NAME" >"$OUT/valhalla.log" 2>&1 || true
  docker rm -f "$NAME" apois-provenance-fixture >/dev/null 2>&1 || true
  if [[ -n "${TLS:-}" && "$TLS" == /tmp/tmp.* && -d "$TLS" ]]; then rm -rf "$TLS"; fi
  if [[ "$WORK" == /tmp/tmp.* && -d "$WORK" && ! -L "$WORK" ]]; then rm -rf "$WORK" 2>/dev/null || sudo rm -rf "$WORK"; fi
  exit "$code"
}
trap cleanup EXIT
(cd "$CACHE" && sha256sum -c extract.sha256)
osmium fileinfo "$CACHE/vale.osm.pbf" > "$OUT/extract-info.txt"
cp "$CACHE/vale.osm.pbf" "$WORK/vale.osm.pbf"
cp "$CACHE/extract.sha256" "$OUT/"
python3 "$BASE/passenger-provenance-snapshot/experimental/apois-navigation/import_catalog.py" --extract "$CACHE/vale.osm.pbf" --expected-sha256 "$(cut -d' ' -f1 "$CACHE/extract.sha256")" --version 1 --out "$OUT/catalog.json"
chmod 777 "$WORK"
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
docker run -d --name "$NAME" --memory=512m --memory-swap=512m --cpus=1 -p 127.0.0.1:8002:8002 -v "$WORK:/custom_files" -e server_threads=1 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
docker run -d --name apois-provenance-fixture --network none -e POSTGRES_PASSWORD=synthetic_ci_only -e POSTGRES_DB=apois_navigation_fixture postgres:17
ready=0
for n in $(seq 1 60); do
 if docker exec apois-provenance-fixture pg_isready -h 127.0.0.1 -U postgres -d apois_navigation_fixture; then ready=1; break; fi
 sleep 1
done
test "$ready" = 1
run_sql(){ docker exec -i apois-provenance-fixture psql -X -U postgres -d apois_navigation_fixture -v ON_ERROR_STOP=1; }
run_sql < "$ROOT/fixture-v21.sql"
run_sql < "$BASE/passenger-provenance-snapshot/experimental/apois-navigation/schema.sql"
run_sql < "$ROOT/observed-gates.sql"
run_sql < "$ROOT/create-passenger-ride-v21.sql"
run_sql < "$BASE/passenger-provenance-snapshot/revocation-fixture.sql"
run_sql < "$ROOT/authority-v21.sql"
run_sql < "$ROOT/service-rpc-v21.sql"
run_sql < "$ROOT/recovery-v21.sql"
run_sql < "$ROOT/confirmation-v21.sql"
run_sql < "$ROOT/catalog-v21.sql"
ready=0
for i in $(seq 1 180); do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/status.json"; then ready=1; break; fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 3
done
test "$ready" = 1
TLS="$(mktemp -d)"
# Local CA accepted only in the test process; never disable TLS verification.
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS/key.pem" -out "$TLS/cert.pem" -days 1 -subj /CN=localhost -addext subjectAltName=DNS:localhost >/dev/null 2>&1
NODE_EXTRA_CA_CERTS="$TLS/cert.pem" APOIS_LAB_CERT="$TLS/cert.pem" APOIS_LAB_CERT_KEY="$TLS/key.pem" node "$ROOT/v21-regional-smoke.mjs" "$OUT"
rm -rf "$TLS"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
