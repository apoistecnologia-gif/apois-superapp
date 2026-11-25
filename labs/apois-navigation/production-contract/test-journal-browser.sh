#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BROWSER="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
test -n "$BROWSER"
"$BROWSER" --version
timeout 90 python3 "$ROOT/test-journal-browser.py" "$BROWSER" "$ROOT/../passenger-provenance-snapshot/experimental/apois-navigation/ui/ride-journal.mjs"
