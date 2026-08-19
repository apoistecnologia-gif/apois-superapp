#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[sync] inicializando snapshots protegidos em sources/..."
git submodule sync --recursive
git submodule update --init --recursive

# O commit efetivo de cada submódulo é parte do próprio Superapp. Nunca siga
# automaticamente o HEAD das branches de origem durante build/homologação.
npm run verify:pins

echo
echo "[OK] fontes protegidas inicializadas exatamente nos commits fixados em .apois/source-lock.json"
