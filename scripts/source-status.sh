#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for dir in sources/apois-corridas-passageiro sources/apois-corridas-motorista-admin sources/apois-entregas; do
  echo "== $dir =="
  if [ ! -e "$dir/.git" ] && ! git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    echo "não inicializado"
    echo
    continue
  fi
  git -C "$dir" rev-parse HEAD
  git -C "$dir" status --short
  echo
 done

npm run verify:pins
