# 05 — DEFEITOS PENDENTES

Todos os itens abaixo foram verificados no commit `96732c55`. Nenhum foi declarado corrigido por relatório anterior sem conferência.

---

## D-004 · Cadastro do Motorista renderiza tela vazia

| Campo | Valor |
|---|---|
| **ID** | D-004 |
| **Aplicativo** | APOIS Motorista |
| **Tela / rota** | `/motorista/cadastro` |
| **Gravidade** | **P0 — bloqueador** (impede novo motorista de se cadastrar) |
| **Descrição** | A rota monta e não desenha nada |
| **Esperado** | Formulário de cadastro com campos e CTA |
| **Observado** | `document.body.innerText.length = 0`, `inputs = 0`, path preservado em `/motorista/cadastro` |
| **Reprodução** | 1. build `bun run build:motorista`; 2. servir `dist/client`; 3. abrir `/motorista/cadastro`; 4. aguardar 2s |
| **Evidência** | `qa-visual/mot-batch.mjs` — linha `cadastro path=/motorista/cadastro len=0 in=0` |
| **Repositório** | `apois-superapp` (módulo vem de `movvi-go-connect` @ `9fc17105`) |
| **Branch / commit** | `audit/continuacao-20261107` @ `96732c55` |
| **Arquivo** | `sources/apois-corridas-motorista-admin/src/routes/motorista.cadastro.tsx` |
| **Linha** | **não confirmada** — componente não foi lido nesta fase documental |
| **Causa raiz** | **hipótese**: guarda de rota ou `beforeLoad` retornando sem render, ou componente condicionado a estado que nunca resolve |
| **Correção recomendada** | ler o componente, identificar o retorno antecipado e garantir render do formulário; se houver guarda de sessão, ela deve redirecionar, não renderizar vazio |
| **Arquivos afetados** | `motorista.cadastro.tsx` e possivelmente o layout `_public` do módulo |
| **Impacto cruzado** | nenhum app além do Motorista |
| **Testes necessários** | smoke Playwright com asserção de `inputs >= 4`; teste de regressão dos demais fluxos públicos |
| **Risco de regressão** | médio — o arquivo pode conter guarda de segurança |
| **Estado atual** | **ABERTO** |
| **Bloqueio** | nenhum |

---

## D-005 · Histórico do Motorista renderiza e esvazia

| Campo | Valor |
|---|---|
| **ID** | D-005 |
| **Aplicativo** | APOIS Motorista |
| **Tela / rota** | `/motorista/corridas` |
| **Gravidade** | **P0 — bloqueador** (histórico inutilizável, comportamento não determinístico) |
| **Descrição** | Conteúdo aparece e é removido |
| **Esperado** | Lista de corridas estável |
| **Observado** | 1ª medição: 563 chars, h1 "Histórico", 1 input. 2ª medição da mesma rota: **0 chars, 0 inputs** |
| **Reprodução** | 1. servir `dist/client`; 2. abrir `/motorista/corridas`; 3. medir após 2s; 4. recarregar e medir de novo |
| **Evidência** | `qa-visual/mot-batch.mjs` (563) e `qa-visual/mot-hist.mjs` (0) |
| **Repositório** | `apois-superapp` (módulo de `movvi-go-connect`) |
| **Branch / commit** | `audit/continuacao-20261107` @ `96732c55` |
| **Arquivo** | `sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx` |
| **Linha** | **não confirmada** |
| **Causa raiz** | **hipótese**: efeito que limpa estado ao falhar a busca (sem sessão, a query retorna erro e o componente esvazia em vez de redirecionar) |
| **Correção recomendada** | tratar erro de sessão com redirect para login; manter estado anterior em falha transitória |
| **Arquivos afetados** | `motorista.corridas.tsx` |
| **Impacto cruzado** | nenhum |
| **Testes necessários** | duas medições consecutivas com asserção de `len > 100` estável |
| **Risco de regressão** | baixo |
| **Estado atual** | **ABERTO** |
| **Bloqueio** | nenhum |

---

## F-001 · `process-superapp-refund` com variáveis fora de escopo

| Campo | Valor |
|---|---|
| **ID** | F-001 |
| **Aplicativo** | Entregas (Edge Function) |
| **Gravidade** | **P0 — risco financeiro** |
| **Descrição** | `providerRefundId`, `status` e `reused` declarados dentro de `if (chargeRoute.api === "orders")` e usados no bloco seguinte (Payments API) |
| **Esperado** | variáveis no escopo da função |
| **Observado** | uso fora do bloco de declaração; em Deno vira `undefined` em runtime |
| **Evidência** | leitura de `sources/apois-entregas/supabase/functions/process-superapp-refund/index.ts` na Fase 2 |
| **Arquivo** | `sources/apois-entregas/supabase/functions/process-superapp-refund/index.ts` |
| **Linha** | **não confirmada** — leitura registrada sem número |
| **Causa raiz** | declaração dentro de bloco, uso fora |
| **Correção recomendada** | mover as três declarações para o escopo da função |
| **Testes necessários** | teste de contrato com mocks dos dois caminhos (orders e payments) |
| **Risco de regressão** | alto — código financeiro |
| **Estado atual** | **NÃO CORRIGIDO** — aguarda autorização explícita |
| **Bloqueio** | aprovação sua |

---

## P-001 · `.work/partner-motorista` não é criado fora de `build:partner`

| Campo | Valor |
|---|---|
| **ID** | P-001 |
| **Gravidade** | **P1** |
| **Descrição** | 6 verificadores e `audit-partner-preflight-v1` leem `.work/partner-motorista`, criado apenas por `scripts/build-partner-modules.sh` (linhas 9–14) |
| **Esperado** | workspace disponível para verificadores isolados |
| **Observado** | `ENOENT` fora do build completo |
| **Arquivo** | `scripts/build-partner-modules.sh` (linhas 5–14), `scripts/normalize-partner-workspaces.mjs` |
| **Correção recomendada** | `prepare:partner` no `package.json` executando as quatro primeiras linhas do script |
| **Risco** | baixo, mas altera caminho de release do Parceiro — validar impacto |
| **Estado atual** | **DIAGNOSTICADO, não alterado** |

---

## P-002 · Preview admin bloqueado por dependência

| Campo | Valor |
|---|---|
| **ID** | P-002 |
| **Gravidade** | **P1** |
| **Descrição** | `build-corridas-admin-spa-v1` exige `node_modules/vite` em `.work/partner-motorista`; `audit-admin-preview-render-v2` exige Playwright |
| **Arquivo** | `scripts/build-corridas-admin-spa-v1.mjs`, `scripts/audit-admin-preview-render-v2.mjs` |
| **Correção recomendada** | rodar dentro de `build-admin-vercel-preview.sh`, que já cria o workspace |
| **Estado atual** | **BLOQUEADO POR DEPENDÊNCIA** |

---

## Resumo

| Prioridade | Quantidade | IDs |
|---|---:|---|
| P0 | 3 | D-004, D-005, F-001 |
| P1 | 2 | P-001, P-002 |
| P2 | 0 | — |
| P3 | 0 | — |

Nenhum defeito P2/P3 pendente: os de interface encontrados (D-001, D-002, D-003) foram corrigidos e validados.
