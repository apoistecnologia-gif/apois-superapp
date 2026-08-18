#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

clone_if_missing() {
  local repo="$1"
  local branch="$2"
  local target="$3"

  if [ -d "$target/.git" ]; then
    echo "[preservado] $target já existe; não atualizando automaticamente."
    return
  fi

  mkdir -p "$(dirname "$target")"
  echo "[copiando] $repo ($branch) -> $target"
  git clone --depth 1 --branch "$branch" "https://github.com/$repo.git" "$target"
  git -C "$target" remote rename origin source-origin
  git -C "$target" config remote.source-origin.pushurl DISABLED
}

clone_if_missing "franciel046631/say-hello-buddy-23-84b5dcbf" "feat/apois-passageiro-completo" "apps/corridas-passageiro"
clone_if_missing "franciel046631/movvi-go-connect" "fix/apois-corridas-consolidacao" "apps/corridas-motorista-admin"
clone_if_missing "franciel046631/apois-entregas" "main" "apps/entregas"

echo
echo "Fontes copiadas em modo protegido. Os remotes de origem tiveram push desativado."
