#!/usr/bin/env bash
# APOIS Corridas Admin/Motorista WEB-only preview from isolated, pinned source.
# No APK, no production deploy, no SQL changes.
set -euo pipefail
ROOT="$(pwd)"
OUTPUT="$ROOT/dist-admin-preview"
test -s package.json
test -f .gitmodules

if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
fi
export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
test "$(bun --version)" = "1.3.14"

if [ ! -f sources/apois-corridas-motorista-admin/src/routes/admin.motoristas.tsx ] || \
   [ ! -f sources/apois-entregas/src/routes/courier.tsx ]; then
  # Vercel does not authenticate private Git submodules by default.
  # This secret must be a short-lived GitHub fine-grained token with only
  # Contents:Read for the three pinned source repositories.
  if [ -z "${APOIS_PREVIEW_GITHUB_TOKEN:-}" ]; then
    echo '[BLOCKED] Configure APOIS_PREVIEW_GITHUB_TOKEN in the isolated Vercel QA project (Preview environment).'
    exit 2
  fi
  ASKPASS_SCRIPT="$(mktemp)"
  cat > "$ASKPASS_SCRIPT" <<'EOF'
#!/usr/bin/env sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$APOIS_PREVIEW_GITHUB_TOKEN" ;;
  *) exit 1 ;;
esac
EOF
  chmod 700 "$ASKPASS_SCRIPT"
  export GIT_ASKPASS="$ASKPASS_SCRIPT"
  export GIT_TERMINAL_PROMPT=0
  cleanup_submodule_auth() {
    rm -f "$ASKPASS_SCRIPT"
    unset GIT_ASKPASS APOIS_PREVIEW_GITHUB_TOKEN
  }
  trap cleanup_submodule_auth EXIT
  git submodule sync --recursive
  git submodule update --init --recursive
  cleanup_submodule_auth
  trap - EXIT
fi
test -f sources/apois-corridas-motorista-admin/src/routes/admin.motoristas.tsx
test -f sources/apois-entregas/src/routes/courier.tsx

case "${CORRIDAS_VITE_SUPABASE_URL:-}" in
  https://tbbzkrfupmqdywnzgnms.supabase.co) ;;
  *) echo '[FAIL] Preview Admin must use the verified APOIS Corridas Supabase URL'; exit 1 ;;
esac
test -n "${CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY:-}"
test -n "${CORRIDAS_WEB_MAPS_API_KEY:-}"
npm run build:partner

SOURCE="$ROOT/.work/partner-motorista/dist/client"
test -s "$SOURCE/index.html"
test -d "$SOURCE/assets"
rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"
cp -R "$SOURCE/." "$OUTPUT/"
# Build is static WEB preview; server-side TanStack functions are never exposed.
# No rewrite for API/JSON endpoints; static fallback handles client-side navigation.
cat > "$OUTPUT/vercel.json" <<'EOF'
{"version":2,"routes":[{"handle":"filesystem"},{"src":"/(.*)","dest":"/index.html"}]}
EOF
find "$OUTPUT" -type f -name '*.map' -delete
# Block actual secret-shaped values, not harmless names of environment variables
# or protective runtime checks embedded in the minified client code.
# Never echo matched content or environment variable values to build logs.
if grep -REq 'sb_secret_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{25,}|ghp_[A-Za-z0-9]{30,}|re_[A-Za-z0-9]{30,}|SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*eyJ[A-Za-z0-9_-]{15,}|RESEND_API_KEY[[:space:]]*=[[:space:]]*re_[A-Za-z0-9]{15,}|x-access-token:[A-Za-z0-9_-]{20,}' "$OUTPUT"; then
  echo '[FAIL] Potential secret value detected in public WEB output; preview blocked.'
  exit 1
fi
grep -Fq 'APOIS' "$OUTPUT/index.html" || {
  echo '[FAIL] APOIS HTML preview missing'; exit 1;
}
echo '[OK] Preview-only Corridas Admin ready; production domain unchanged.'
