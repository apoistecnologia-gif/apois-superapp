#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="$(cd "$ROOT/../passenger-provenance-snapshot/experimental/apois-navigation/ui" && pwd)"
BROWSER="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
test -n "$BROWSER"
WORK="$(mktemp -d)"
python3 -m http.server 18763 --bind 127.0.0.1 --directory "$BASE" >"$WORK/http.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$WORK"' EXIT
for n in $(seq 1 25); do
  if curl -fsS http://127.0.0.1:18763/ride-journal.browser.html >/dev/null; then break; fi
  sleep 0.2
done
timeout 90 node "$ROOT/test-journal-browser.mjs" "$BROWSER" "$WORK/profile" http://127.0.0.1:18763/ride-journal.browser.html
