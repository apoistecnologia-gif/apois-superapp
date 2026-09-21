#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# O mesmo preflight usado pelas auditorias decide primeiro se os sources existem
# e estão completos. Em export/ZIP sem .git ele valida o conteúdo, mas informa
# explicitamente que o pin não é verificável em vez de chamar isso de
# "não inicializado".
npm run preflight:sources

if [ ! -e "$ROOT/.git" ]; then
  echo
  echo "[INFO] export/ZIP sem metadata .git: conteúdo dos sources validado; status/pin Git não verificável neste ambiente."
  exit 0
fi

for dir in sources/apois-corridas-passageiro sources/apois-corridas-motorista-admin sources/apois-entregas; do
  echo "== $dir =="
  git -C "$dir" rev-parse HEAD
  git -C "$dir" status --short
  echo
 done
