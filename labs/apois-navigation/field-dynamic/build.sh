#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "$1")"
mkdir -p "$OUT"
W="$(mktemp -d)"
NAME="apois-dynamic-$$"
PID=""
cleanup(){ local code=$?;trap - EXIT; if [[ -n "$PID" ]];then kill "$PID" 2>/dev/null || true;fi;docker logs "$NAME" > "$OUT/valhalla.log" 2>&1 || true;docker rm -f "$NAME" >/dev/null 2>&1 || true;sudo rm -rf "$W";exit "$code"; }
trap cleanup EXIT
curl -fL --retry 2 --retry-all-errors --connect-timeout 20 --max-time 240 https://download.openstreetmap.fr/extracts/south-america/brazil/northeast/piaui-latest.osm.pbf -o "$W/piaui.osm.pbf"
sha256sum "$W/piaui.osm.pbf" > "$OUT/source.sha256"
mkdir "$W/custom"
osmium extract --strategy complete_ways --bbox=-41.85,-7.75,-41.15,-6.85 "$W/piaui.osm.pbf" -o "$W/custom/pilot.osm.pbf"
sha256sum "$W/custom/pilot.osm.pbf" > "$OUT/extract.sha256"
chmod 777 "$W/custom"
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
docker pull "$IMAGE"
docker run -d --name "$NAME" --memory=2g --memory-swap=2g --cpus=2 -p 127.0.0.1:8002:8002 -v "$W/custom:/custom_files" -e server_threads=2 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
for i in $(seq 1 180);do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/status.json";then break;fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 3
done
test -s "$OUT/status.json"
export APOIS_FIELD_DYNAMIC_SECRET="$(openssl rand -hex 32)"
APOIS_FIELD_DYNAMIC_RUN=1 node "$BASE/gateway.mjs" > "$OUT/gateway.log" 2>&1 &
PID=$!
for i in $(seq 1 20);do if curl -fsS http://127.0.0.1:8003/healthz >/dev/null;then break;fi;sleep 1;done
python "$BASE/verify.py" "$OUT"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
