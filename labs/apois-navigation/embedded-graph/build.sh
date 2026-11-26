#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "$1")"
mkdir -p "$OUT"
W="$(mktemp -d)"
NAME="apois-embedded-graph-$"
PID=""
cleanup(){ local code=$?;trap - EXIT; if [[ -n "$PID" ]];then kill "$PID" 2>/dev/null || true;fi;docker logs "$NAME" > "$OUT/valhalla.log" 2>&1 || true;docker rm -f "$NAME" >/dev/null 2>&1 || true;sudo rm -rf "$W";exit "$code"; }
trap cleanup EXIT
curl -fL --retry 2 --retry-all-errors --connect-timeout 20 --max-time 240 https://download.openstreetmap.fr/extracts/south-america/brazil/northeast/piaui-latest.osm.pbf -o "$W/piaui.osm.pbf"
sha256sum "$W/piaui.osm.pbf" > "$OUT/source.sha256"
mkdir "$W/custom"
osmium extract --strategy complete_ways --bbox=-41.85,-7.75,-41.15,-6.85 "$W/piaui.osm.pbf" -o "$W/custom/pilot.osm.pbf"
sha256sum "$W/custom/pilot.osm.pbf" > "$OUT/extract.sha256"
chmod 777 "$W/custom"
TAG='ghcr.io/valhalla/valhalla-scripted:3.6.3-amd64'
docker pull "$TAG"
IMAGE="$(docker image inspect --format '{{index .RepoDigests 0}}' "$TAG")"
[[ "$IMAGE" =~ ^ghcr.io/valhalla/valhalla-scripted@sha256:[a-f0-9]{64}$ ]]
printf '%s\n' "$IMAGE" > "$OUT/image-digest.txt"
docker run -d --name "$NAME" --memory=2g --memory-swap=2g --cpus=2 -p 127.0.0.1:8002:8002 -v "$W/custom:/custom_files" -e server_threads=2 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
for i in $(seq 1 180);do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/status.json";then break;fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 3
done
test -s "$OUT/status.json"
python - "$OUT/status.json" <<'PY'
import json,sys
v=json.load(open(sys.argv[1]))["version"]
assert v=="3.6.3", f"Unexpected routing engine version: {v}"
PY
export APOIS_FIELD_DYNAMIC_SECRET="$(openssl rand -hex 32)"
APOIS_FIELD_DYNAMIC_RUN=1 node "$BASE/../field-dynamic/gateway.mjs" > "$OUT/gateway.log" 2>&1 &
PID=$!
for i in $(seq 1 20);do if curl -fsS http://127.0.0.1:8003/healthz >/dev/null;then break;fi;sleep 1;done
python "$BASE/../field-dynamic/verify.py" "$OUT"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
cp "$W/custom/valhalla_tiles.tar" "$OUT/valhalla_tiles.tar"
python "$BASE/verify-graph.py" "$OUT"
printf '%s\n' '© OpenStreetMap contributors; ODbL https://www.openstreetmap.org/copyright' 'Source: https://download.openstreetmap.fr/extracts/south-america/brazil/northeast/piaui-latest.osm.pbf' 'Laboratory graph only, not approved for distribution.' > "$OUT/OSM-NOTICE.txt"
