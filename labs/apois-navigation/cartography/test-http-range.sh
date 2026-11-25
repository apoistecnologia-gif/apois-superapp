#!/usr/bin/env bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(realpath "$1")"
WORK="$(mktemp -d)"
PID=""
cleanup() { if [ -n "$PID" ]; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi; rm -rf -- "$WORK"; }
trap cleanup EXIT
test -s "$OUT/vale.pmtiles"
HASH="$(sha256sum "$OUT/vale.pmtiles" | cut -d' ' -f1)"
cp "$OUT/vale.pmtiles" "$WORK/vale-$HASH.pmtiles"
PORT="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
cat > "$WORK/nginx.conf" <<EOF
worker_processes 1;
pid $WORK/nginx.pid;
error_log $WORK/error.log;
events { worker_connections 32; }
http {
  access_log off;
  server {
    listen 127.0.0.1:$PORT;
    root $WORK;
    gzip off;
    etag on;
    max_ranges 1;
    location = /vale-$HASH.pmtiles {
      default_type application/octet-stream;
      add_header Cache-Control "public, max-age=31536000, immutable";
      limit_except GET { deny all; }
    }
    location / { return 404; }
  }
}
EOF
nginx -p "$WORK/" -c "$WORK/nginx.conf" -g 'daemon off;' &
PID=$!
python3 "$BASE/verify_http_range.py" "$WORK/vale-$HASH.pmtiles" "http://127.0.0.1:$PORT/vale-$HASH.pmtiles" | tee "$OUT/range-report.json"
