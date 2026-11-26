#!/usr/bin/env bash
set -euo pipefail
DEST="$1"
OUT="$2"
EXPECTED=49cad6d647ad887d95c56677bd0c02e732ef9984b1aa6ac92b0dfe018eb08835
BASE=https://download.geofabrik.de/south-america/brazil
PART="$DEST.part"
trap 'rm -f "$PART"' EXIT
mkdir -p "$OUT"
# Exact dated archive candidate corresponds to replication timestamp 24 Nov
# 21:21 UTC. Availability is not assumed. Only the approved hash is accepted.
for URL in "$BASE/nordeste-261125.osm.pbf" "$BASE/nordeste-latest.osm.pbf" "$BASE/nordeste-261124.osm.pbf";do
    rm -f "$PART"
    if curl --fail --location --proto '=https' --proto-redir '=https' --retry 2 --retry-all-errors --retry-delay 15 --connect-timeout 25 --max-time 480 "$URL" -o "$PART";then
        ACTUAL=$(sha256sum "$PART" | cut -d ' ' -f1)
        printf '%s %s\n' "$ACTUAL" "$URL" >> "$OUT/source-attempts.txt"
        if [[ "$ACTUAL" == "$EXPECTED" ]];then
            mv "$PART" "$DEST"
            (cd "$(dirname "$DEST")" && sha256sum "$(basename "$DEST")") > "$OUT/source.sha256"
            printf '%s\n' "$URL" > "$OUT/source-url.txt"
            exit 0
        fi
    else
        printf 'download failed: %s\n' "$URL" >> "$OUT/source-attempts.txt"
    fi
done
echo 'Exact approved OSM snapshot unavailable; refuse substitute.' >&2
exit 1
