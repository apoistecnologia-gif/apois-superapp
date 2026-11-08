# 04 — DIFF CONSOLIDADO

Comparação entre a base (`main`), a branch de auditoria anterior (`audit/ecossistema-20261107`) e o estado atual (`audit/continuacao-20261107`).

---

## 1. Visão geral

| Comparação | Arquivos | Inserções | Remoções |
|---|---:|---:|---:|
| `main` → `audit/continuacao-20261107` (só `scripts/`, `.apois/`, `supabase/`) | **563** | **40.210** | **3.410** |
| — arquivos novos em `scripts/` | **367** | — | — |
| — arquivos modificados em `scripts/` | **93** | — | — |

A branch de auditoria é **muito maior** que `main`: ela incorpora o trabalho de `audit/ecossistema-20261107` (que já trazia 487 arquivos) mais as correções desta continuação.

## 2. `main` → `audit/ecossistema-20261107`

Branch anterior, base da continuação. Traz o inventário, a matriz de 115 linhas, o checkpoint do APK #112 e os hardeners de endereço V9–V13.

| Item | Estado em `main` | Estado em `ecossistema` |
|---|---|---|
| `.apois/source-lock.json` | Entregas `0a1e0b29` (main do repo) | Entregas `2f4606e0` (branch de readiness) |
| Hardeners de endereço V9–V13 | ausentes | presentes |
| `scripts/qa/` (44 suítes) | ausente | presente |
| `docs/auditoria-20261107/` | ausente | presente |
| Preview admin Vercel | ausente | presente |

## 3. `audit/ecossistema-20261107` → `audit/continuacao-20261107`

Onze commits, todos publicados.

| Commit | Tipo | Arquivos | Natureza |
|---|---|---:|---|
| `7c1b6c00` | fix | 24 | pipeline de Entregas idempotente |
| `9ff3368d` | docs | 1 | Fase 3 |
| `54bdec26` | fix | 4 | contrato `request-ride` |
| `ae92f1ba` | fix | 6 | hardeners Entregador |
| `5f82e5ea` | fix | 9 | idempotência + gates Windows |
| `4a01d0d1` | docs | 1 | Fase 6 |
| `49f7a98e` | fix | 3 | guarda admin |
| `d9202d74` | fix | 38 | D-001 e D-002 |
| `3898e9d3` | fix | 14 | D-003 |
| `81fe8c80` | docs | 21 | Fase 10 |
| `96732c55` | docs | 30 | Fase 11 |

**Total: 151 arquivos tocados, sendo 5 commits de correção de código e 6 de documentação/QA.**

## 4. Alterações por área

### 4.1 `scripts/` — 460 arquivos afetados
- **Novos hardeners desta continuação:** `harden-entregas-address-callback-dedup`, `harden-entregas-component-symbol-dedup`, `harden-entregas-address-uf-and-number-v16`, `harden-entregas-product-route-redirect-hang`, `harden-entregas-cold-route-invariant`, `harden-entregas-touch-targets-v17`, `harden-partner-entregador-block-dedup`, `lib/source-git.mjs`.
- **Hardeners tornados idempotentes:** 11 (listados no doc 03).
- **Verificadores corrigidos:** `verify-module-pins`, `status-modules`, `audit-payment-boundary`, `test-safe2pay-webhook-retry-v1`.

### 4.2 `.apois/modules.json`
Cadeia de Entregas cresceu de 40 para 49 comandos. Novos: `auto-address-cep-v1`, `location-identified-state`, `address-fields`, `address-callback-dedup`, `component-symbol-dedup`, `address-uf-and-number-v16`, `product-route-redirect-hang`, `cold-route-invariant`, `touch-targets-v17`.

### 4.3 `supabase/functions/request-ride/index.ts`
Uma alteração: `fare_amount_cents` adicionado ao retorno de criação (C-001). **Não publicado.**

### 4.4 `qa-visual/` — novo
19 arquivos: servidor estático, smokes por modo, auditoria de alvos de toque, hit-test, capturas PNG.

### 4.5 `auditoria/` — novo
Relatórios das Fases 1–11 mais os dez documentos desta entrega.

## 5. Estado do worktree

```
$ git status --short
?? .vercel/
```

Apenas `.vercel/` não rastreado — artefato de ferramenta, não código. **Nenhuma alteração de código pendente.**

## 6. Submódulos

Os três submódulos estão checked out nos commits pinados. Nenhum foi modificado — a política do repositório proíbe alterar `sources/`.

## 7. O que NÃO mudou

- Nenhum arquivo em `sources/` foi tocado.
- Nenhum merge em `main`.
- Nenhum deploy, nenhum APK novo, nenhuma Edge Function publicada.
- Nenhum `git reset --hard`, nenhum arquivo removido.
