#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "$1")"
CACHE="$(realpath -m "$BASE/../valhalla/.regional-cache")"
mkdir -p "$OUT" "$CACHE"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
if ! (cd "$CACHE" && test -s source-sha256.txt && sha256sum -c extract.sha256 && osmium fileinfo vale.osm.pbf >/dev/null); then
  curl --fail --location --retry 1 --retry-max-time 900 --max-time 780 --connect-timeout 20 https://download.geofabrik.de/south-america/brazil/nordeste-latest.osm.pbf -o "$WORK/nordeste.osm.pbf"
  sha256sum "$WORK/nordeste.osm.pbf" | awk '{print $1}' > "$CACHE/source-sha256.txt"
  osmium extract --strategy complete_ways --bbox=-40.80,-9.65,-40.20,-9.10 "$WORK/nordeste.osm.pbf" -o "$WORK/vale.osm.pbf"
  mv "$WORK/vale.osm.pbf" "$CACHE/vale.osm.pbf"
  (cd "$CACHE" && sha256sum vale.osm.pbf > extract.sha256)
fi
cp "$CACHE/vale.osm.pbf" "$WORK/vale.osm.pbf"
cp "$CACHE/"{extract.sha256,source-sha256.txt} "$OUT/"
curl --fail --location --retry 1 --max-time 300 https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar -o "$WORK/planetiler.jar"
echo 'f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d  planetiler.jar' > "$WORK/jar.sha256"
(cd "$WORK" && sha256sum -c jar.sha256)
cd "$WORK"
/usr/bin/time -v -o "$OUT/build-resources.txt" java -Xmx2g -jar planetiler.jar "$BASE/vale.yml" --output="$OUT/vale.pmtiles" --bounds=-40.80,-9.65,-40.20,-9.10 --minzoom=8 --maxzoom=15 --threads=2 2>&1 | tee "$OUT/build.log"
python3 "$BASE/verify_archive.py" "$OUT/vale.pmtiles" "$BASE/style-template.json" | tee "$OUT/archive-report.json"
cp "$BASE/style-template.json" "$OUT/"
(cd "$OUT" && sha256sum vale.pmtiles style-template.json > SHA256SUMS)
