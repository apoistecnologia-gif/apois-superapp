#!/usr/bin/env bash
set -euo pipefail
# Rebuild the actual QA290 Motorista source chain, never Android or Courier.
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
BASE=6b0d31dcad5be9b7c7b9a8c651deeca98104b65f
DRIVER_PIN=9fc171050d8b5703540c49d19a8f1e9f5162775f
test "$(git -C sources/apois-corridas-motorista-admin rev-parse HEAD)" = "$DRIVER_PIN"
git cat-file -e "$BASE^{commit}"
mkdir -p .work
STAGE="$(mktemp -d "$ROOT/.work/qa290-checkout.XXXXXX")"
cleanup() { git -C "$ROOT" worktree remove --force "$STAGE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git worktree add --detach "$STAGE" "$BASE"
test "$(git -C "$STAGE" rev-parse HEAD)" = "$BASE"
# Verify every source pin before copying. Delivery checkout is used only by
# historical shared read-only checks; never invoke its build section.
for module in apois-corridas-motorista-admin apois-entregas; do
  expected="$(git -C "$STAGE" ls-tree HEAD "sources/$module" | awk '{print $3}')"
  test -n "$expected"
  # The delivery pin has advanced since QA290. Read the old object without
  # changing the current checkout, ref, source files or remote repository.
  if ! git -C "$ROOT/sources/$module" cat-file -e "$expected^{commit}" 2>/dev/null; then
    git -C "$ROOT/sources/$module" fetch --no-tags origin "$expected"
  fi
  test "$(git -C "$ROOT/sources/$module" rev-parse "$expected^{commit}")" = "$expected"
  mkdir -p "$STAGE/sources/$module"
  git -C "$ROOT/sources/$module" archive "$expected" | tar -x -C "$STAGE/sources/$module"
done
cd "$STAGE"
# Materialize precisely the original Motorista half of the QA290 release.
# Keep all historical tests, order, types and guards. No new payment policy.
node --input-type=module <<'NODE'
import {readFileSync,writeFileSync} from 'node:fs';
const src=readFileSync('scripts/build-partner-release.sh','utf8');
const split=src.split('# ---------------- Entregador ----------------');
if(split.length!==2) throw Error('Historical release boundary changed');
const driver=split[0];
if(!driver.includes('fix-partner-qa290-compact-offer-v1.mjs')||!driver.includes('bun run typecheck')||!driver.includes('npm run build:motorista'))throw Error('QA290 recovery contract missing');
if((driver.match(/npm run build:motorista/g)||[]).length!==1)throw Error('Unexpected build count');
writeFileSync('.qa290-motorista-web.sh',driver);
NODE
bash -n .qa290-motorista-web.sh
bash .qa290-motorista-web.sh
test -s .work/partner-motorista/dist/client/index.html
test ! -e .work/partner-entregador/.output
test ! -e superapp/partner-shell/android/app/build/outputs/apk
# Source and bundle evidence for controlled visual reconciliation. Explicit
# allowlist avoids copying credentials, .env, node_modules or delivery data.
OUT="$ROOT/.work/qa290-recovered-evidence"
rm -rf "$OUT"
mkdir -p "$OUT/src/routes" "$OUT/src/components" "$OUT/src/lib"
for file in motorista.app motorista.login motorista.perfil motorista.corridas motorista.ganhos motorista.configuracoes; do
  cp ".work/partner-motorista/src/routes/$file.tsx" "$OUT/src/routes/"
done
for file in MovviMap mapMarkers ApoisPremiumDriverNav MovviHeader; do
  cp ".work/partner-motorista/src/components/$file.tsx" "$OUT/src/components/"
done
cp .work/partner-motorista/src/lib/theme.tsx "$OUT/src/lib/"
cp .work/partner-motorista/src/styles.css "$OUT/src/"
printf '%s\n' "$BASE" > "$OUT/QA290-COMMIT.txt"
for marker in APOIS_PARCEIRO_QA283_PROFILE_COMPLETED_RIDES_V1 APOIS_PARCEIRO_QA284_DRIVER_HISTORY_UI_V1; do
  grep -R -Fq "$marker" "$OUT/src/routes"
done
echo '[OK] QA290 Motorista web reconstructed; no Android APK or delivery bundle.'
