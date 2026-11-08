# APOIS — Fase 6 · Painel do Estabelecimento + pendências da Fase 5

**Branch:** `audit/continuacao-20261107` · **Snapshot:** `2f4606e0` · **Modo:** `merchant`
**Método:** build real, gates financeiros executados, hardeners e audits. Sem aparelho, sem Supabase.

---

## 1. Pendências anteriores — resolvidas

### 1.1 Ausência de `.work/partner-motorista/` — causa identificada

**Quem deveria criar:** `scripts/build-partner-modules.sh`, linhas 9–14:

```bash
rm -rf "$MOTORISTA" "$ENTREGADOR"
mkdir -p "$MOTORISTA" "$ENTREGADOR"
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-corridas-motorista-admin" -cf - . | tar -C "$MOTORISTA" -xf -
tar --exclude=node_modules --exclude=.git -C "$ROOT/sources/apois-entregas" -cf - . | tar -C "$ENTREGADOR" -xf -
node "$ROOT/scripts/normalize-partner-workspaces.mjs" "$MOTORISTA" "$ENTREGADOR"
```

**Causa raiz:** o diretório **só existe durante `npm run build:partner`**. Os 6 `verify-partner-motorista-*` e `audit-partner-preflight-v1` leem esse caminho, mas nenhum script de `package.json` fora do `build:partner` o cria. `normalize-partner-workspaces.mjs` exige dois argumentos e não é chamado por nenhum script de preparação.

**Impacto:** rodar qualquer verificador do Parceiro fora do build completo falha com `ENOENT` — não por defeito de produto. **Não alterei o processo de release**, conforme sua instrução.

**Linha de correção proposta (não aplicada):** um `prepare:partner` que execute as quatro primeiras linhas do `build-partner-modules.sh` sem os hardeners de release.

### 1.2 Testes do Motorista via shim Bun

Registrado: os **31 testes** rodaram sob Bun com `scripts/qa/run-motorista-deno-tests.mjs` (shim de `Deno.test`, `Deno.readTextFile` → `node:fs`). **Ainda precisam de confirmação no Deno original** — o ambiente não tem Deno.

### 1.3 Idempotência do Entregador — confirmada por duas execuções

Encontrei **três hardeners não idempotentes** e corrigi:

| Hardener | Defeito | Correção |
|---|---|---|
| `-operation-states` | envolvia `setDeliveryHistory` em `if/else` a cada execução, aninhando blocos | só aplica se o guarda ainda não existe |
| `-background-location` | prependia `stopCourierNativeLocation` antes de cada alvo, duplicando chamadas | decisão por proximidade (500 chars antes do alvo) |
| `-journey` | reinseria o bloco nativo de GPS | só reescreve se o caminho nativo ainda não existe |

**Verificação:** `courier.tsx` e `CourierLocationTracker.tsx` ficam **byte-idênticos** após a segunda passada; build `courier` continua verde.

### 1.4 C-001 — mantido isolado

`supabase/functions/request-ride/index.ts` com `fare_amount_cents` aditivo. **Sem deploy.**

### 1.5 Bloqueios preservados

Supabase inacessível, chaves de mapas ausentes, zero teste físico. Nada foi declarado homologado por eles.

---

## 2. Fase 6 — defeitos encontrados e corrigidos

### 2.1 Gates de pagamento reprovavam por ambiente, não por conteúdo

| Script | Defeito | Correção |
|---|---|---|
| `audit-payment-boundary` | `spawnSync('bun', …)` falha com **ENOENT no Windows** (bun é `.cmd`) | usa `bun.cmd` + `shell` no win32, mesmo tratamento de `build-product.mjs` |
| `test-safe2pay-webhook-retry-v1` | asserções usam `indexOf("…\n…")`; os SQL de review estão em **CRLF** → `-1` | normalização de fim de linha antes de comparar |

Ambos faziam o gate **reprovar sem que o conteúdo estivesse errado**. Após a correção:

- **27 checagens** de pedido cash isolado — PASS
- **31 testes** Safe2Pay (reenvio, zero registros, estornos simulados) — PASS
- isolamento de sandbox vs produção — PASS
- `build-merchant-panel` → **EXIT 0**

### 2.2 Hardeners do Estabelecimento exigindo texto superado

| Hardener | Causa | Correção |
|---|---|---|
| `-mercadopago-v2` | concordância "o liberação"; prontidão via `merchant-payment-readiness`; `pixFunction` no checkout | concordância opcional; aceita RPC `get_delivery_checkout_readiness`; valida ausência de provedor legado |
| `fix-entregas-merchant-order-review-v1` | `.eq("payment_status","paid")` não existe mais | substituição condicional |
| `normalize-entregas-merchant-mp-handoff` | bloco `configuredProvider` removido do checkout | sai com 0 quando o bloco já não existe |

## 3. Execuções reais

| Verificação | Resultado |
|---|---|
| Build `merchant` | **✓ 3 etapas compiladas** |
| `build-merchant-panel` | **EXIT 0** — fixture Cliente + bundle audit + gates + painel |
| `audit-entregas-merchant-payments` | **OK** |
| `harden-entregas-merchant-*` (4) | **4/4 OK** |
| `audit-payment-boundary` | **completo** (27 + 31 + sandbox) |
| Lint source-wide do snapshot | **NÃO CONCLUÍDO** — excedeu 10 min e foi interrompido; registrado como pendência, não como aprovado |

## 4. Matriz — Fase 6

| Sistema | Função | Status | Gravidade | Evidência |
|---|---|---|---|---|
| Estabelecimento | Build merchant | **APROVADO** | crítica | 3 etapas |
| Estabelecimento | Painel completo (build-merchant-panel) | **APROVADO** | crítica | EXIT 0 |
| Estabelecimento | Boundary financeiro (cash/pending operacional) | **APROVADO (teste)** | crítica | 27 checagens |
| Estabelecimento | Safe2Pay atômico e isolamento sandbox | **APROVADO (teste)** | crítica | 31 testes |
| Estabelecimento | Mensalidade R$ 69,90 exibida | **APROVADO (código)** | alta | contrato no hardener |
| Estabelecimento | Checkout sem provedor legado | **APROVADO (código)** | alta | hardener |
| Estabelecimento | Login, produtos, categorias, imagens, disponibilidade | **NÃO EXECUTADO (UI)** | — | precisa sessão + Supabase |
| Estabelecimento | Receber/aceitar/preparar/cancelar pedido | **NÃO EXECUTADO (E2E)** | crítica | precisa 3 atores |
| Estabelecimento | Alertas sonoros e realtime | **NÃO EXECUTADO (aparelho)** | — | precisa dispositivo |
| Estabelecimento | Isolamento entre estabelecimentos (RLS) | **BLOQUEADO POR ACESSO** | crítica | sem Supabase |
| Lint source-wide | — | **NÃO EXECUTADO** | baixa | timeout |

## 5. Contratos Cliente ↔ Estabelecimento ↔ Entregador

| Contrato | Situação |
|---|---|
| Status do pedido | `order-machine.ts` compartilha o conjunto; `merchantNextStatuses` e `courierNextStatus` encaixam |
| Pagamento | `paymentAllowsFulfillment` exige `paid`; cash/pending tratado como operacional por política explícita |
| Cancelamento | `customer_cancel_order` e `merchant_reject_order` validam estados distintos e não se sobrepõem |
| Valores | total vem do servidor; refund valida `Math.round(amount*100)` contra o provider |
| Realtime | Cliente assina `orders` e `delivery_jobs`; painel assina os mesmos canais |
| Divergência encontrada | nenhuma nova nesta fase |

## 6. Próximo

Fase 7 — Painéis administrativos (Admin Entregas e Admin Corridas), depois Fase 8 (Supabase/segurança) com o que for possível sem acesso.
