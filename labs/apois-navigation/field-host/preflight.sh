#!/usr/bin/env bash
# Read-only local readiness checks. Never starts services, opens ports, modifies DNS or prints credentials.
set -euo pipefail
cd "$(dirname "$0")"
[[ "$(uname -s)" == Linux ]] || { echo 'Linux required'; exit 1; }
: "${APOIS_FIELD_HOST:?set dedicated host}"
: "${APOIS_GRAPH_DIR:?set graph directory}"
: "${APOIS_SECRET_FILE:?set credential path}"
: "${APOIS_UID:?set uid}" "${APOIS_GID:?set gid}" "${APOIS_EXPIRES_AT:?set expiry}"
: "${APOIS_NODE_IMAGE:?set pinned image}" "${APOIS_CADDY_IMAGE:?set pinned image}"
[[ "$APOIS_FIELD_HOST" =~ ^navigation-lab(-[a-z0-9]{1,20})?\.apoisbrasil\.com\.br$ ]] || { echo 'Dedicated APOIS hostname required'; exit 1; }
[[ "$APOIS_UID" =~ ^[1-9][0-9]*$ && "$APOIS_GID" =~ ^[0-9]+$ ]] || { echo 'Non-root gateway UID required'; exit 1; }
[[ -d "$APOIS_GRAPH_DIR" && "$APOIS_GRAPH_DIR" = /* && -f "$APOIS_SECRET_FILE" && ! -L "$APOIS_SECRET_FILE" && "$APOIS_SECRET_FILE" = /* ]] || { echo 'Invalid data or secret path'; exit 1; }
[[ "$(stat -c %u "$APOIS_SECRET_FILE")" = "$APOIS_UID" && "$(stat -c %a "$APOIS_SECRET_FILE")" =~ ^(400|600)$ ]] || { echo 'Secret owner/mode invalid'; exit 1; }
[[ "$(stat -c %s "$APOIS_SECRET_FILE")" =~ ^(64|65)$ ]] || { echo 'Secret size invalid'; exit 1; }
[[ "$APOIS_EXPIRES_AT" =~ ^[0-9]{13}$ ]] || { echo 'Expiry format invalid'; exit 1; }
now=$(date +%s%3N)
(( APOIS_EXPIRES_AT > now && APOIS_EXPIRES_AT - now <= 900000 )) || { echo 'Expiry invalid'; exit 1; }
[[ "$APOIS_NODE_IMAGE" =~ ^(docker.io/library/|library/)?node@sha256:[a-f0-9]{64}$ && "$APOIS_CADDY_IMAGE" =~ ^(docker.io/library/|library/)?caddy@sha256:[a-f0-9]{64}$ ]] || { echo 'Approved digest form required'; exit 1; }
docker compose config --quiet
for image in "$APOIS_NODE_IMAGE" "$APOIS_CADDY_IMAGE" ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257; do
 docker image inspect "$image" >/dev/null
done
echo 'Read-only config and local image checks passed. No deployment performed.'
echo 'Still required: graph checksums, firewall, TLS, DNS, disk/RAM and explicit owner authorization.'
