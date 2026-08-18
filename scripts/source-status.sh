#!/usr/bin/env bash
set -euo pipefail

for dir in apps/corridas-passageiro apps/corridas-motorista-admin apps/entregas; do
  echo "== $dir =="
  if [ ! -d "$dir/.git" ]; then
    echo "não copiado"
    echo
    continue
  fi
  git -C "$dir" rev-parse HEAD
  git -C "$dir" branch --show-current
  git -C "$dir" remote -v
  echo
 done
