#!/usr/bin/env bash
set -euo pipefail
REPO="$(realpath "$1")"
STAGE="$(realpath "$2")"
OUT="$(realpath -m "$3")"
test "${STAGE#"$RUNNER_TEMP/"}" != "$STAGE"
mkdir -p "$OUT"
RECOVERY="$(realpath "$RUNNER_TEMP/apois-qa290-recovery")"
test "$(git -C "$RECOVERY" rev-parse HEAD)" = "a19fc0bc8e68c94dae0f1d48ff7cef2dba8ad94d"
test "$(git -C "$RECOVERY" hash-object scripts/reconcile-motorista-qa290-visual.mjs)" = "9619c4af8b3e81c18e0102b402dad60f154bb8ae"
test "$(git -C "$RECOVERY" hash-object scripts/fix-motorista-ride-video-audit-v1.mjs)" = "527dec7061b3ca6bf0062cbc9204e86094af7536"
export APOIS_CURRENT_ROOT="$RECOVERY"
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
