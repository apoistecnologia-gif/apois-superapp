#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
PACK="$RUNNER_TEMP/apois-vale-runtime-assets/apois-vale-data/graph.tar"
test -f "$PACK"
test "$(stat -c %s "$PACK")" = 8263680
echo "38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433  $PACK" | sha256sum -c -
NAME=apois-local-auth-valhalla
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:71e4d1cbc96126e59d9a603da6290ccfc14e289deb2b4bd6eaca82a7655615e8'
docker run -d --name "$NAME" --memory=768m --memory-swap=768m --cpus=1 -p 127.0.0.1:8002:8002 \
 --mount "type=bind,src=$PACK,dst=/pack/graph.tar,readonly" --entrypoint /bin/bash "$IMAGE" -ec '
 valhalla_build_config --mjolnir-tile-dir /tmp/apois-no-loose-tiles --mjolnir-tile-extract /pack/graph.tar > /tmp/apois-valhalla.json
 exec valhalla_service /tmp/apois-valhalla.json 1
 '
ready=0
for n in $(seq 1 60);do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status >/dev/null;then ready=1;break;fi
 if test "$(docker inspect -f '{{.State.Running}}' "$NAME")" != true;then docker logs "$NAME";exit 1;fi
 sleep 1
done
test "$ready" = 1
echo APOIS_LOCAL_PINNED_VALHALLA_READY
