#!/usr/bin/env bash
set -euo pipefail
REPO="$(realpath "$1")"
STAGE="$(realpath "$2")"
OUT="$(realpath -m "$3")"
test "${STAGE#"$RUNNER_TEMP/"}" != "$STAGE"
mkdir -p "$OUT"
export APOIS_CURRENT_ROOT="$REPO"
export APOIS_MOTORISTA_ONLY=1
# Non-resolving endpoint and nonfunctional dummy keys. Do not expose secrets.
export CORRIDAS_VITE_SUPABASE_URL=https://apois-navigation-lab.invalid
export CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_navigation_lab_placeholder_not_a_key
export CORRIDAS_WEB_MAPS_API_KEY=AIzaSyNavigationLabPlaceholderNotAKey
export VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED=false
unset VITE_APOIS_PARTNER_VECTOR_MAP_ID
node "$REPO/labs/apois-navigation/host-compat/prepare-qa290-web.mjs" "$STAGE" "$REPO"
cd "$STAGE"
bash -n .navigation-qa290-web.sh
bash .navigation-qa290-web.sh
test -s .work/partner-motorista/dist/client/index.html
test ! -e .work/partner-entregador/dist/client/index.html
test ! -e .work/partner-entregador/.output
test -z "$(find superapp -name '*.apk' -print -quit)"
# Export only evidence: no bundle, credentials, private source, or node_modules.
node "$REPO/labs/apois-navigation/host-compat/audit-qa290-web.mjs" "$STAGE/.work/partner-motorista" "$OUT/report.json"
