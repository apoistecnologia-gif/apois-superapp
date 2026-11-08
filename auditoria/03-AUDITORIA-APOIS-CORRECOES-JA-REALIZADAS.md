# 03 — CORREÇÕES JÁ REALIZADAS

Todos os commits abaixo estão **publicados** em `origin/audit/continuacao-20261107` (HEAD remoto `96732c55`). Nenhum existe apenas no notebook.

---

## 7c1b6c00 — pipeline idempotente, build dos 4 modos verde
**Data:** 07/11/2026 · **Branch:** `audit/continuacao-20261107` · **24 arquivos, +1237/−133**

**Defeitos corrigidos**
- `SyntaxError: Identifier 'hasValidCoordinates' has already been declared` no callback `onAddressSelected` (bloco V12 repetido 3×) — quebrava a tela de novo endereço em runtime.
- `SyntaxError: Identifier 'missingLocationFieldsRef' has already been declared` — mesma classe.
- Regressão de regra de produto: `handleChange` normalizado perdeu "número/complemento não movem o ponto" e "UF equivalente não descarta o GPS".
- 8 hardeners não idempotentes (address-uf-v9, address-async-v11, address-selection-v12, address-missing-fields-v13, auto-delivery-address, auto-address-cep-v1, component-symbol-dedup, uf-and-number-v16).

**Alterações de comportamento:** número e complemento deixam de invalidar o ponto confirmado; UF equivalente preserva GPS; `novo.tsx` fica byte-idêntico após duas passadas.

**Testes:** 49/49 comandos de patch em 2 passadas; 4 builds (customer/courier/merchant/admin); 53 testes Node; 4 testes Bun. **Todos aprovados.**

**Riscos de regressão:** baixos — contratos verificam o código final, não marcadores.

---

## 9ff3368d — Fase 3, Cliente Corridas auditado
**Data:** 07/11/2026 · **1 arquivo, +108** · apenas documentação

**Testes:** build `build:capacitor` 2m14s; 20 verificadores `verify-corridas-*` 20/20.

**Pendência de reteste:** C-001 (contrato de preço) registrado, corrigido depois em `54bdec26`.

---

## 54bdec26 — contrato de preço do `request-ride`
**Data:** 07/11/2026 · **4 arquivos, +229**

**Defeito:** C-001 — caminho de criação não devolvia valor em centavos; reutilização devolvia `estimated_price` e não os demais campos.

**Correção:** `fare_amount_cents` adicionado de forma **aditiva**; nenhum campo removido ou renomeado.

**Testes:** `test-request-ride-estimated-price-contract-v1.mjs` — 7 testes (criação, reutilização, erro interno, idempotência, leitura pelo cliente). **Aprovados.**

**Estado:** código corrigido; **Edge Function NÃO publicada** — exige autorização específica.

**Risco:** baixo (aditivo). Impacto cruzado: Cliente, Motorista e Admin leem o mesmo contrato.

---

## ae92f1ba — hardeners do Entregador idempotentes
**Data:** 07/11/2026 · **6 arquivos, +147/−23**

**Defeito:** `PARSE_ERROR: Identifier 'appStateHandle' has already been declared` — 16 erros de parse derrubavam o build do Parceiro. Causa: `harden-partner-entregador-gps-resume.mjs` inseria a declaração sem checar existência.

**Também corrigidos:** `-privacy`, `-terms`, `-profile`, `-back-navigation` exigiam texto superado pelo snapshot.

**Testes:** 33/33 hardeners; build courier 7.53s; 4/4 audits. **Aprovados.**

---

## 5f82e5ea — hardeners idempotentes e gates executáveis no Windows
**Data:** 07/11/2026 · **9 arquivos, +188/−33**

**Defeitos**
- `-operation-states` aninhava `if/else` a cada execução.
- `-background-location` duplicava `stopCourierNativeLocation`.
- `-journey` reinseria bloco nativo de GPS.
- `audit-payment-boundary` usava `spawnSync('bun')` → **ENOENT no Windows**; o gate reprovava sem o teste rodar.
- `test-safe2pay-webhook-retry-v1` comparava com `\n` em arquivos **CRLF** → `-1`.

**Testes:** 27 checagens cash; 31 testes Safe2Pay; isolamento de sandbox; `build-merchant-panel` EXIT 0.

---

## 4a01d0d1 — Fase 6, Estabelecimento
**Data:** 07/11/2026 · **1 arquivo, +118** · documentação

**Pendências resolvidas:** causa de `.work/partner-motorista` identificada (criado só por `build-partner-modules.sh`); idempotência do Entregador confirmada em 2 passadas.

---

## 49f7a98e — guarda de navegação admin idempotente
**Data:** 07/11/2026 · **3 arquivos, +69/−3**

**Defeitos:** `fix-admin-guard-navigation-v1` fazia `throw` quando o marcador já existia; `fix-partner-admin-legacy-brand-v1` exigia título MOVVI já convertido.

**Testes:** build admin 3 etapas; 11/13 scripts `*admin*` em 2 passadas; `test-admin-preview-private-documents-v1` aprovado.

**Bloqueados:** `build-corridas-admin-spa-v1` (falta Vite em `.work/partner-motorista`) e `audit-admin-preview-render-v2` (falta Playwright) — exclusivos do preview Vercel.

---

## d9202d74 — rota de outro produto não trava nem derruba o app
**Data:** 07/11/2026 · **38 arquivos, +447/−1**

**D-001 (crítico):** navegar para `#/courier` prendia o app em "Validando sessão". Medido: 16 caracteres em 2s, 6s, 15s e 30s. Causa: `AuthSessionIsolation` redirecionava sem `setReady(true)`. Depois: 308 caracteres estável.

**D-002 (crítico):** cold load em `#/courier`, `#/merchant`, `#/admin` → `Invariant failed`, 0 caracteres. Causa: hash chegava ao matcher antes do redirect. Corrigido normalizando antes de `createRouter`.

**Testes:** 22 rotas — 3 com tela vazia antes, 0 depois; 15 combinações de viewport sem overflow.

---

## 3898e9d3 — alvos de toque de 44px
**Data:** 08/11/2026 · **14 arquivos, +302/−2**

**D-003:** Termos 65×16→84×44; Privacidade 51×16→125×44; Voltar 36×36→44×44; senha 20×20→44×44; checkbox 16×16→44×44; Entrar 42×44→44×44.

**Erro registrado:** `after:content-[""]` quebrou o build; `::after` não ampliava a área clicável segundo hit-test. Solução final com `::before`.

**Testes:** 15 combinações, 0 problemas.

---

## 81fe8c80 — Fase 10, Cliente Corridas em navegador
**Data:** 08/11/2026 · **21 arquivos, +149**

**Testes:** 14 rotas, 0 pageerror. `/admin` e `/motorista/app` retornam 404 do SPA — isolamento correto.

---

## 96732c55 — Fase 11, Motorista e diagnóstico de auth
**Data:** 08/11/2026 · **30 arquivos, +207**

**D-004:** `/motorista/cadastro` — 0 caracteres, 0 inputs. **ABERTO.**
**D-005:** `/motorista/corridas` — 563 → 0 caracteres. **ABERTO.**

**Diagnóstico de auth:** `.env.example` sem valores; `config.toml` de deploy; sem Supabase local, seed ou contas documentadas; Docker ausente.

---

## Resumo por situação

| Situação | Commits |
|---|---|
| Publicado no remoto | **todos os 11** |
| Apenas no notebook | nenhum |
| Substituído por implementação posterior | nenhum |
| Revertido | nenhum |
| Precisa de reteste | `54bdec26` (deploy da Edge Function), `d9202d74`, `3898e9d3` (reteste em aparelho) |
| Defeito ainda aberto | D-004, D-005, `process-superapp-refund` |
