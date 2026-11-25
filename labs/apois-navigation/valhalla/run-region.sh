#!/usr/bin/env bash
set -euo pipefail
# Disposable benchmark: localhost only, no live APOIS coordinates, no paid APIs.
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "${1:-$BASE/results}")"
mkdir -p "$OUT"
WORK="$(mktemp -d)"
NAME="apois-valhalla-lab-$$"
cleanup(){ docker logs "$NAME" >"$OUT/valhalla.log" 2>&1 || true; docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
URL='https://download.geofabrik.de/south-america/brazil/nordeste-latest.osm.pbf'
mkdir -p "$WORK/custom"
curl --fail --location --retry 3 --max-time 240 "$URL" -o "$WORK/nordeste.osm.pbf"
sha256sum "$WORK/nordeste.osm.pbf" | awk '{print $1}' >"$OUT/source-sha256.txt"
# Bounding box covers the two cities, airport and neighbouring routes.
osmium extract --strategy complete_ways --bbox=-40.80,-9.65,-40.20,-9.10 "$WORK/nordeste.osm.pbf" -o "$WORK/custom/vale.osm.pbf"
osmium fileinfo "$WORK/custom/vale.osm.pbf" >"$OUT/extract-info.txt"
chmod 777 "$WORK/custom" # disposable runner directory; not production configuration
docker pull "$IMAGE"
docker image inspect --format '{{json .RepoDigests}}' "$IMAGE" >"$OUT/image-digest.json"
START=$(date +%s)
docker run -d --name "$NAME" --memory=5g --cpus=2 -p 127.0.0.1:8002:8002 \
  -v "$WORK/custom:/custom_files" \
  -e server_threads=2 -e build_admins=False -e build_time_zones=False \
  -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False \
  "$IMAGE"
READY=0
for i in $(seq 1 180); do
  if curl -fsS --max-time 2 http://127.0.0.1:8002/status >"$OUT/status.json"; then READY=1;break;fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != true ]; then echo "Valhalla stopped before ready"; exit 1;fi
  sleep 3
done
test "$READY" = 1
echo "$(( $(date +%s) - START ))" >"$OUT/startup-seconds.txt"
du -sb "$WORK/custom" >"$OUT/storage-bytes.txt"
python3 "$BASE/test_routes.py" "$OUT"
docker stats --no-stream --format '{{json .}}' "$NAME" >"$OUT/docker-stats.json"
echo '[OK] Regional route benchmark completed; no paid API calls or APK.'
