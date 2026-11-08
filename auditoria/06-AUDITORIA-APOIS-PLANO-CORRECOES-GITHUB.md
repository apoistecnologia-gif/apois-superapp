# 06 — PLANO DE CORREÇÕES PARA EXECUÇÃO NO GITHUB

Plano para o ChatGPT executar diretamente no repositório. Cada item traz diagnóstico, arquivos, alteração, dependências, testes e critério de aprovação.

**Branch de trabalho sugerida:** `fix/auditoria-p0-20261108` (a partir de `audit/continuacao-20261107` @ `96732c55`).
**Nunca** fazer merge em `main` sem aprovação. **Nunca** publicar Edge Function sem autorização.

---

## P0 — Bloqueadores

### P0-1 · D-004 — cadastro do Motorista em branco

**Diagnóstico:** `/motorista/cadastro` monta e não renderiza (0 chars, 0 inputs).

**Arquivos:** `sources/apois-corridas-motorista-admin/src/routes/motorista.cadastro.tsx` (módulo protegido — a correção deve ir por hardener em `scripts/`, não no submódulo).

**Alteração recomendada:**
1. Ler o componente e localizar o retorno antecipado (`if (!x) return null` ou guarda equivalente).
2. Criar `scripts/harden-motorista-cadastro-render.mjs` que substitua o retorno vazio por redirect a `/motorista/login` quando não houver sessão, mantendo o formulário quando houver.
3. Registrar o hardener em `.apois/modules.json` na cadeia do motorista, antes do build.

**Dependências:** nenhuma.

**Testes de regressão:**
- `qa-visual/mot-batch.mjs` deve reportar `len > 100` e `inputs >= 4` em `/motorista/cadastro`.
- Smoke das demais rotas públicas do Motorista inalterado.

**Critério de aprovação:** asserção de `inputs >= 4` e `len > 100` estável em duas execuções consecutivas.

**Risco:** médio — o arquivo pode conter guarda de segurança; a correção deve preservá-la como redirect.

---

### P0-2 · D-005 — histórico do Motorista instável

**Diagnóstico:** renderiza 563 chars e depois 0 na medição seguinte.

**Arquivos:** `sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx` (via hardener).

**Alteração recomendada:**
1. Identificar o efeito que zera `deliveryHistory`/`rides` em erro.
2. Criar `scripts/harden-motorista-historico-estavel.mjs` que preserve o estado anterior em falha transitória e redirecione ao login apenas em erro de sessão.

**Testes de regressão:**
- Duas medições consecutivas com `len > 100` estável.
- Rotas `/motorista/app`, `/ganhos`, `/perfil` continuam redirecionando.

**Critério de aprovação:** `len` estável entre duas execuções, sem `pageerror`.

**Risco:** baixo.

---

### P0-3 · F-001 — `process-superapp-refund` com variáveis fora de escopo

**Diagnóstico:** `providerRefundId`, `status`, `reused` declarados dentro de `if (chargeRoute.api === "orders")` e usados no bloco Payments API.

**Arquivos:** `sources/apois-entregas/supabase/functions/process-superapp-refund/index.ts`.

**Alteração recomendada:**
1. Mover as três declarações para o topo do handler, antes do `if`.
2. Não alterar nenhuma regra de negócio, valor ou fluxo.

**Dependências:** **aprovação explícita do usuário** (código financeiro).

**Testes de regressão:**
- Novo `scripts/qa/test-process-superapp-refund-scope-v1.mjs` com mocks dos dois caminhos (`orders` e `payments`), verificando que os três símbolos são atribuídos antes do uso.
- Suíte existente de refund não deve regredir.

**Critério de aprovação:** teste de contrato verde nos dois caminhos, sem alteração de valores.

**Risco:** alto. **Não publicar a Edge Function.**

---

## P1 — Alta prioridade

### P1-1 · P-001 — `.work/partner-motorista` no prepare

**Arquivos:** `package.json`, `scripts/build-partner-modules.sh`, `scripts/normalize-partner-workspaces.mjs`.

**Alteração recomendada:** adicionar `"prepare:partner"` que execute as quatro primeiras linhas do script (rm, mkdir, dois `tar`) sem os hardeners de release. `normalize-partner-workspaces.mjs` deve aceitar zero argumentos e derivar os dois caminhos.

**Testes:** os 6 `verify-partner-motorista-*` devem executar sem `ENOENT` após `prepare:partner`.

**Critério:** verificadores rodam; `build:partner` continua idêntico.

**Risco:** médio — toca o caminho de release do Parceiro.

---

### P1-2 · P-002 — preview admin

**Arquivos:** `scripts/build-corridas-admin-spa-v1.mjs`, `scripts/audit-admin-preview-render-v2.mjs`.

**Alteração recomendada:** nenhuma no código; documentar que ambos só rodam dentro de `build-admin-vercel-preview.sh`. Se quiserem execução isolada, adicionar checagem amigável que explique a dependência em vez de falhar com `ENOENT`.

**Critério:** mensagem clara de dependência, sem falso negativo.

**Risco:** baixo.

---

## Agrupamento sugerido

| Grupo | Itens | Motivo |
|---|---|---|
| A — Motorista | P0-1, P0-2 | mesmo módulo, mesmo padrão de hardener, um único reteste de smoke |
| B — Financeiro | P0-3 | isolado, exige aprovação, teste próprio |
| C — Pipeline Parceiro | P1-1, P1-2 | mesma área, risco de release |

Executar **A** primeiro (impacto direto no usuário), depois **C** (destrava verificadores), **B** por último (maior risco).

## O que NÃO refazer

- D-001, D-002, D-003 — corrigidos e validados.
- UF, GPS, duplicações de símbolo, Push hash — corrigidos.
- Hardeners de Entregas, Entregador e Admin — idempotentes.
- Nenhum componente que já funciona deve ser reescrito.
