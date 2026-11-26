#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
PBF="$(realpath "$1")"
OUT="$(realpath "$2")"
WORK="$(mktemp -d)"
NAME="apois-northeast-lab-$$"
cleanup(){
 local code=$?
 trap - EXIT
 docker logs "$NAME" > "$OUT/valhalla.log" 2>&1 || true
 docker inspect --format '{{json .State}}' "$NAME" > "$OUT/container-final-state.json" 2>/dev/null || true
 docker exec "$NAME" cat /sys/fs/cgroup/memory.events > "$OUT/memory-events.txt" 2>/dev/null || true
 docker rm -f "$NAME" >/dev/null 2>&1 || true
 sudo rm -rf -- "$WORK"
 exit "$code"
}
trap cleanup EXIT
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
mkdir "$WORK/custom"
cp "$PBF" "$WORK/custom/nordeste.osm.pbf"
chmod 777 "$WORK/custom" # disposable CI directory only
docker pull "$IMAGE"
START=$(date +%s)
docker run -d --name "$NAME" --memory=5g --memory-swap=5g --cpus=2 -p 127.0.0.1:8002:8002 -v "$WORK/custom:/custom_files" -e server_threads=2 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
READY=0
for i in $(seq 1 300); do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/valhalla-status.json"; then READY=1; break; fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 5
done
test "$READY" = 1
echo "$(( $(date +%s)-START ))" > "$OUT/graph-startup-seconds.txt"
du -sb "$WORK/custom" > "$OUT/graph-storage-bytes.txt"
python "$BASE/verify.py" route "$OUT"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
docker stats --no-stream --format '{{json .}}' "$NAME" > "$OUT/docker-stats.json"

# Retain the graph data only after validated routing, not a deployed service.
if [[ "${RETAIN_BUNDLE:-0}" == 1 ]]; then
  BUNDLE="$(dirname "$OUT")/apois-northeast-bundle"
  mkdir -p "$BUNDLE"
  test -s "$WORK/custom/valhalla_tiles.tar"
  cp "$WORK/custom/valhalla_tiles.tar" "$BUNDLE/valhalla_tiles.tar"
fi
