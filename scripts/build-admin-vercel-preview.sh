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
  git submodule sync --recursive
  git submodule update --init --recursive
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
if grep -REqi 'sb_secret_|RESEND_API_KEY=|SUPABASE_SERVICE_ROLE_KEY=|x-access-token:' "$OUTPUT"; then
  echo '[FAIL] Potential secret marker found in public WEB output'
  exit 1
fi
grep -Fq 'APOIS' "$OUTPUT/index.html" || {
  echo '[FAIL] APOIS HTML preview missing'; exit 1;
}
echo '[OK] Preview-only Corridas Admin ready; production domain unchanged.'
