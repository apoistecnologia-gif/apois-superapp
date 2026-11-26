#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
PBF="$(realpath "$1")"
OUT="$(realpath "$2")"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
cd "$WORK"
ln -s "$PBF" vale.osm.pbf
sed 's/APOIS Vale do Sao Francisco lab/APOIS Nordeste lab/' "$BASE/../cartography/vale.yml" > nordeste.yml
curl --fail --location --retry 1 --max-time 300 https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar -o planetiler.jar
echo 'f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d  planetiler.jar' | sha256sum -c -
# No bbox: process the whole Geofabrik regional extract, including border ways.
/usr/bin/time -v -o "$OUT/map-resources.txt" java -Xmx3g -jar planetiler.jar nordeste.yml --output="$WORK/nordeste.pmtiles" --minzoom=8 --maxzoom=15 --threads=2 2>&1 | tee "$OUT/map-build.log"
sha256sum nordeste.pmtiles > "$OUT/map.sha256"
python "$BASE/../cartography/verify_archive.py" nordeste.pmtiles "$BASE/../cartography/style-template.json" > "$OUT/map-archive-report.json"
python "$BASE/verify.py" map "$OUT" nordeste.pmtiles
# Evidence only; no large archive or graph uploaded at this stage.
