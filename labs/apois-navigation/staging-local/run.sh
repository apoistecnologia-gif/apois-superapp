#!/usr/bin/env bash
set -euo pipefail
LAB="$(cd "$(dirname "$0")" && pwd)"
: "${RUNNER_TEMP:?}"
ROOT="$RUNNER_TEMP/apois-navigation-local"
test ! -e "$ROOT"
mkdir "$ROOT"
cd "$ROOT"
umask 077
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_PROJECT_REF
trap 'supabase stop --no-backup >/dev/null 2>&1 || true; rm -rf "$ROOT"' EXIT
supabase --version
supabase init --help >/dev/null
supabase init
test ! -e supabase/.temp/project-ref
supabase start --help >/dev/null
# No hosted link, secrets, or remote database commands. Suppress local keys.
supabase start > "$ROOT/start.log" 2>&1 || { tail -n 15 "$ROOT/start.log" | sed -E 's/(eyJ|sb_(secret|publishable)_)[^ ]+/[redacted]/g'; exit 1; }
supabase status -o json > "$ROOT/status.json"
node -e 'const fs=require("node:fs");const s=JSON.parse(fs.readFileSync("status.json"));const u=new URL(s.DB_URL);if(!["127.0.0.1","localhost"].includes(u.hostname)||u.port!=="54322")process.exit(1);if(!["http://127.0.0.1:54321","http://localhost:54321"].includes(s.API_URL))process.exit(1);' 
node "$LAB/prepare-fixture.mjs" "$ROOT"
DB_URL="$(node -p 'JSON.parse(require("fs").readFileSync("status.json")).DB_URL')"
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f fixture.sql
npm init -y >/dev/null
npm install --save-exact --no-audit --no-fund @supabase/supabase-js@2.45.4
node "$LAB/apps-auth.integration.mjs" "$ROOT"
