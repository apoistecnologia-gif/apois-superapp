#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath "$1")"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
curl --fail --location --retry 1 --max-time 300 https://github.com/openmaptiles/fonts/releases/download/v2.0/noto-open-sans.zip -o "$WORK/fonts.zip"
echo '1a5d6323621d556ec120eaf95398d5093abb9f5181a17c9b8867e214b3f4312b  fonts.zip' > "$WORK/fonts.sha256"
(cd "$WORK" && sha256sum -c fonts.sha256)
mkdir -p "$OUT/glyphs"
curl --fail --location --max-time 60 https://raw.githubusercontent.com/openmaptiles/fonts/a4f9e7cf18aa382945c0a912f3022ba94a0b1d52/open-sans/LICENSE.txt -o "$OUT/glyphs/LICENSE-Open-Sans.txt"
test "$(git hash-object "$OUT/glyphs/LICENSE-Open-Sans.txt")" = 75b52484ea471f882c29e02693b4f02dba175b5e
python3 "$BASE/prepare_glyphs.py" "$WORK/fonts.zip" "$OUT/glyphs" "$OUT/label-codepoints.json" | tee "$OUT/glyph-report.json"
