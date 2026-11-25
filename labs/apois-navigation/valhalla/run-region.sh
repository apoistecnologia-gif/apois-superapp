#!/usr/bin/env bash
set -euo pipefail
# Disposable benchmark: localhost only, no live APOIS coordinates, no paid APIs.
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "${1:-$BASE/results}")"
PROFILE="${2:-standard}"
case "$PROFILE" in
  standard) MEMORY=5g; CPUS=2; THREADS=2; NODE_HEAP=512; EXPECT_MEMORY=5368709120; EXPECT_CPU=2000000000 ;;
  compact) MEMORY=512m; CPUS=1; THREADS=1; NODE_HEAP=128; EXPECT_MEMORY=536870912; EXPECT_CPU=1000000000 ;;
  *) echo 'Unknown bounded lab resource profile' >&2; exit 2 ;;
esac
mkdir -p "$OUT"
WORK="$(mktemp -d)"
NAME="apois-valhalla-lab-$$"
GATEWAY_PID=""
cleanup(){
  local code=$?
  trap - EXIT
  if [[ -n "$GATEWAY_PID" ]]; then kill "$GATEWAY_PID" 2>/dev/null || true; wait "$GATEWAY_PID" 2>/dev/null || true; fi
  docker logs "$NAME" >"$OUT/valhalla.log" 2>&1 || true
  docker inspect --format '{{json .State}}' "$NAME" >"$OUT/container-final-state.json" 2>/dev/null || true
  docker exec "$NAME" cat /sys/fs/cgroup/memory.events >"$OUT/cgroup-memory-events.txt" 2>/dev/null || true
  docker exec "$NAME" cat /sys/fs/cgroup/cpu.stat >"$OUT/cgroup-cpu-stat.txt" 2>/dev/null || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  # Docker builds graph files as root; remove only our own generated directory.
  if [[ "$WORK" == /tmp/tmp.* && -d "$WORK" && ! -L "$WORK" ]]; then
    rm -rf -- "$WORK" 2>/dev/null || sudo rm -rf -- "$WORK" || { echo "Temporary cleanup failed" >&2; if [ "$code" = 0 ]; then code=1; fi; }
  fi
  exit "$code"
}
trap cleanup EXIT
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
URL='https://download.geofabrik.de/south-america/brazil/nordeste-latest.osm.pbf'
mkdir -p "$WORK/custom"
# Keep a small regional extract in CI cache rather than redownloading Nordeste
# for every experiment. Revalidate the file and hash before use. Monthly cache
# rotation is only a lab convenience, not a production map-update policy.
CACHE="$BASE/.regional-cache"
mkdir -p "$CACHE"
if [ -s "$CACHE/vale.osm.pbf" ] && [ -s "$CACHE/source-sha256.txt" ] && [ -s "$CACHE/extract.sha256" ] &&
  (cd "$CACHE" && sha256sum -c extract.sha256) && osmium fileinfo "$CACHE/vale.osm.pbf" >/dev/null; then
  echo '[OK] Reusing verified local regional extract'
else
  curl --fail --location --retry 1 --retry-all-errors --retry-delay 5 --retry-max-time 900 --connect-timeout 20 --max-time 780 "$URL" -o "$WORK/nordeste.osm.pbf"
  sha256sum "$WORK/nordeste.osm.pbf" | awk '{print $1}' >"$CACHE/source-sha256.txt"
  osmium extract --strategy complete_ways --bbox=-40.80,-9.65,-40.20,-9.10 "$WORK/nordeste.osm.pbf" -o "$WORK/vale.osm.pbf"
  mv "$WORK/vale.osm.pbf" "$CACHE/vale.osm.pbf"
  (cd "$CACHE" && sha256sum vale.osm.pbf > extract.sha256)
fi
cp "$CACHE/source-sha256.txt" "$OUT/source-sha256.txt"
cp "$CACHE/extract.sha256" "$OUT/extract.sha256"
cp "$CACHE/vale.osm.pbf" "$WORK/custom/vale.osm.pbf"
osmium fileinfo "$WORK/custom/vale.osm.pbf" >"$OUT/extract-info.txt"
chmod 777 "$WORK/custom" # disposable runner directory; not production configuration
docker pull "$IMAGE"
docker image inspect --format '{{json .RepoDigests}}' "$IMAGE" >"$OUT/image-digest.json"
START=$(date +%s)
docker run -d --name "$NAME" --memory="$MEMORY" --memory-swap="$MEMORY" --cpus="$CPUS" -p 127.0.0.1:8002:8002 \
  -v "$WORK/custom:/custom_files" \
  -e server_threads="$THREADS" -e build_admins=False -e build_time_zones=False \
  -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False \
  "$IMAGE"
actual_memory="$(docker inspect -f '{{.HostConfig.Memory}}' "$NAME")"
actual_swap="$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$NAME")"
actual_cpu="$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$NAME")"
test "$actual_memory" = "$EXPECT_MEMORY"
test "$actual_swap" = "$EXPECT_MEMORY"
test "$actual_cpu" = "$EXPECT_CPU"
printf '{"profile":"%s","valhallaMemoryBytes":%s,"valhallaMemorySwapBytes":%s,"valhallaNanoCpus":%s,"valhallaThreads":%s,"nodeOldSpaceMiB":%s,"nodeRssHardLimited":false}\n' "$PROFILE" "$actual_memory" "$actual_swap" "$actual_cpu" "$THREADS" "$NODE_HEAP" >"$OUT/resource-profile.json"
echo "APOIS_RESOURCE_PROFILE $(cat "$OUT/resource-profile.json")"
READY=0
for i in $(seq 1 180); do
  if curl -fsS --max-time 2 http://127.0.0.1:8002/status >"$OUT/status.json"; then READY=1;break;fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != true ]; then echo "Valhalla stopped before ready"; exit 1;fi
  sleep 3
done
test "$READY" = 1
echo "$(( $(date +%s) - START ))" >"$OUT/startup-seconds.txt"
du -sb "$WORK/custom" >"$OUT/storage-bytes.txt"
# The real SDK response is tested through the same strict local gateway.
# Native Valhalla benchmark remains direct; no public ports or live requests.
APOIS_LAB_GATEWAY_PORT=8003 node --max-old-space-size="$NODE_HEAP" "$BASE/route-gateway.mjs" >"$OUT/gateway.log" 2>&1 &
GATEWAY_PID=$!
GATEWAY_READY=0
for i in $(seq 1 20); do
  if curl -fsS --max-time 1 http://127.0.0.1:8003/healthz >/dev/null; then GATEWAY_READY=1;break;fi
  kill -0 "$GATEWAY_PID"
  sleep 1
done
test "$GATEWAY_READY" = 1
python3 "$BASE/test_routes.py" "$OUT"
node --max-old-space-size="$NODE_HEAP" "$BASE/authenticated-regional-smoke.mjs" "$OUT"
# Optional, CI-only end-to-end fixture; no effect on the default benchmark.
if [[ "${APOIS_LAB_GUARDED_REGIONAL:-0}" == 1 ]]; then
  bash "$BASE/run-guarded-fixture.sh" "$OUT"
fi
node --max-old-space-size="$NODE_HEAP" "$BASE/authenticated-capacity.mjs" "$OUT" "$NAME" extended
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
# On cgroup v2 capture evidence of subprocess OOM too, not only container exit.
if docker exec "$NAME" cat /sys/fs/cgroup/memory.events >"$OUT/cgroup-memory-during.txt" 2>/dev/null; then
  awk '$1=="oom_kill" {found=1; if($2!=0) exit 1} END {if(!found) exit 1}' "$OUT/cgroup-memory-during.txt"
fi
docker stats --no-stream --format '{{json .}}' "$NAME" >"$OUT/docker-stats.json"
echo '[OK] Regional route benchmark completed; no paid API calls or APK.'
