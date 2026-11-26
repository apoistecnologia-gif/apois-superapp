#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(realpath -m "$1")"
mkdir -p "$OUT"
# Reuse the existing cartography pipeline, including its verified local cache.
# This is a NEW candidate: map and graph are generated from one exact extract.
bash "$BASE/cartography/build-region.sh" "$OUT"
CACHE="$BASE/valhalla/.regional-cache"
(cd "$CACHE" && sha256sum -c extract.sha256)
cmp "$CACHE/extract.sha256" "$OUT/extract.sha256"
W="$(mktemp -d)"
NAME="apois-launch-vale-$$"
cleanup(){
 local code=$?
 trap - EXIT
 docker logs "$NAME" > "$OUT/valhalla.log" 2>&1 || true
 docker rm -f "$NAME" >/dev/null 2>&1 || true
 sudo rm -rf "$W"
 exit "$code"
}
trap cleanup EXIT
mkdir "$W/custom"
cp "$CACHE/vale.osm.pbf" "$W/custom/vale.osm.pbf"
(cd "$W/custom" && sha256sum -c "$OUT/extract.sha256")
chmod 777 "$W/custom"
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:71e4d1cbc96126e59d9a603da6290ccfc14e289deb2b4bd6eaca82a7655615e8'
docker pull "$IMAGE"
docker run -d --name "$NAME" --memory=2g --memory-swap=2g --cpus=2 -p 127.0.0.1:8002:8002 -v "$W/custom:/custom_files" -e server_threads=2 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
READY=0
for i in $(seq 1 180);do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/status.json";then READY=1;break;fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 3
done
test "$READY" = 1
python "$BASE/launch-vale/verify.py" "$OUT"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
python "$BASE/embedded-northeast/inspect-index.py" "$W/custom/valhalla_tiles.tar" "$OUT/graph-index-report.json"
cp "$W/custom/valhalla_tiles.tar" "$OUT/graph.tar"
