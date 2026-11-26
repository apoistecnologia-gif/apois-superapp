#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath -m "$1")"
mkdir -p "$OUT"
W="$(mktemp -d)"
NAME="apois-piaui-field-$$"
cleanup(){ local status=$?; trap - EXIT; docker logs "$NAME" > "$OUT/valhalla.log" 2>&1 || true; docker rm -f "$NAME" >/dev/null 2>&1 || true; sudo rm -rf -- "$W"; exit "$status"; }
trap cleanup EXIT
# Source explicitly distinct from the integral Geofabrik evidence.
URL=https://download.openstreetmap.fr/extracts/south-america/brazil/northeast/piaui-latest.osm.pbf
curl --fail --location --retry 2 --retry-all-errors --connect-timeout 20 --max-time 240 "$URL" -o "$W/piaui.osm.pbf"
sha256sum "$W/piaui.osm.pbf" | awk '{print $1}' > "$OUT/source-sha256.txt"
printf '%s\n' "$URL" > "$OUT/source-url.txt"
osmium fileinfo "$W/piaui.osm.pbf" > "$OUT/source-info.txt"
# Cover the urban sample areas and connecting corridor; NOT all Piauí or Nordeste.
BOUNDS=-41.85,-7.75,-41.15,-6.85
osmium extract --strategy complete_ways --bbox="$BOUNDS" "$W/piaui.osm.pbf" -o "$W/vale.osm.pbf"
(cd "$W" && sha256sum vale.osm.pbf) > "$OUT/extract.sha256"
sed 's/APOIS Vale do Sao Francisco lab/APOIS Itainopolis Picos field pilot/' "$BASE/../cartography/vale.yml" > "$W/pilot.yml"
curl --fail --location --retry 2 --max-time 300 https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar -o "$W/planetiler.jar"
(cd "$W" && echo 'f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d  planetiler.jar' | sha256sum -c - && java -Xmx2g -jar planetiler.jar pilot.yml --output="$OUT/pilot.pmtiles" --bounds="$BOUNDS" --minzoom=8 --maxzoom=15 --threads=2)
python "$BASE/verify.py" map "$OUT"
# Use the existing licensed glyph preparation, with codepoints from the pilot.
bash "$BASE/../cartography/prepare-glyphs.sh" "$OUT"
python - "$BASE/../cartography/style-template.json" "$OUT" <<'PY'
import sys,json,pathlib
style=json.load(open(sys.argv[1]));out=pathlib.Path(sys.argv[2])
style.update(name="APOIS Itainópolis/Picos — piloto",center=[-41.4786,-7.4475])
style["sources"]["regional"].update(url="pmtiles://asset://apois-field-pilot/pilot.pmtiles",bounds=[-41.85,-7.75,-41.15,-6.85])
style["glyphs"]="asset://apois-field-pilot/glyphs/{fontstack}/{range}.pbf"
(out/"style.json").write_text(json.dumps(style,ensure_ascii=False,indent=2))
PY
mkdir "$W/custom"
cp "$W/vale.osm.pbf" "$W/custom/pilot.osm.pbf"
chmod 777 "$W/custom"
IMAGE='ghcr.io/valhalla/valhalla-scripted@sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257'
docker pull "$IMAGE"
docker run -d --name "$NAME" --memory=2g --memory-swap=2g --cpus=2 -p 127.0.0.1:8002:8002 -v "$W/custom:/custom_files" -e server_threads=2 -e build_admins=False -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False "$IMAGE"
READY=0
for i in $(seq 1 180); do
 if curl -fsS --max-time 2 http://127.0.0.1:8002/status > "$OUT/status.json"; then READY=1; break; fi
 test "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true
 sleep 3
done
test "$READY" = 1
python "$BASE/verify.py" route "$OUT"
test "$(docker inspect -f '{{.State.Running}} {{.State.OOMKilled}}' "$NAME")" = "true false"
python "$BASE/manifest.py" "$OUT"
