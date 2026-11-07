# APOIS — Fase 4 · APOIS Motorista + Admin Corridas

**Branch:** `audit/continuacao-20261107` · **Pin:** `9fc171050d8b5703540c49d19a8f1e9f5162775f`
**Método:** build real, typecheck real, suítes executadas, verificadores de regressão. Sem aparelho, sem Supabase.

---

## 1. Inventário — 75 arquivos de rota

**Motorista (24 rotas):**
`motorista.login`, `motorista.cadastro`, `motorista.recuperar-senha`, `motorista.redefinir-senha`, `motorista.termos`, `motorista.documentos`, `motorista.assinatura`, `motorista.app` (mapa/operação), `motorista.status`, `motorista.corridas`, `motorista.corridas.$id`, `motorista.ganhos`, `motorista.carteira`, `motorista.regalias`, `motorista.notificacoes`, `motorista.preferencias-notificacoes`, `motorista.perfil`, `motorista.configuracoes`, `motorista.seguranca`, `motorista.privacidade`, `motorista.suporte`.

**Admin Corridas (23 rotas):**
`admin.login`, `admin.dashboard`, `admin.motoristas`, `admin.passageiros`, `admin.corridas`, `admin.operacoes`, `admin.mapa`, `admin.financeiro`, `admin.financeiro-motoristas`, `admin.pagamentos`, `admin.assinaturas`, `admin.precos`, `admin.categorias`, `admin.cupons`, `admin.administradores`, `admin.notificacoes`, `admin.relatorios`, `admin.analytics`, `admin.logs`, `admin.seguranca`, `admin.suporte`, `admin.backups`, `admin.configuracoes`.

**Rotas de diagnóstico** (`debug.motorista-auth`, `dev-diagnostics`, `dev.rating-test`, `diagnostico`, `map-test`) — excluídas do bundle de release pelo auditor oficial.

## 2. Execuções reais

| Verificação | Comando | Resultado |
|---|---|---|
| Workspace | `node scripts/prepare-workspace.mjs motorista` | OK |
| Dependências | `bun install --force` (780 pacotes) | OK |
| **Typecheck** | `bun run typecheck` (`tsc --noEmit`) | **OK, sem erros** |
| **Build Motorista** | `bun run build:motorista` | **OK — `dist/client/index.html` gerado** |
| Superfície de release | `audit-motorista-release-surface.mjs` | **OK — 10 artefatos, sem rotas debug** |
| Suítes unitárias do snapshot | 7 arquivos `tests/unit/*.test.ts` (Deno) | **31 pass / 0 fail** |
| Audits `audit-partner-motorista-*` | 6 scripts | **6/6 OK** |
| Verificadores `verify-partner-motorista-*` | 6 scripts | **0/6 — ver §4** |

### 2.1 Sobre os testes unitários

O snapshot declara `test:unit: deno test tests/unit/*.test.ts`, mas **Deno não existe no ambiente**. Em vez de declarar "não executado", criei `scripts/qa/run-motorista-deno-tests.mjs`, um shim que registra `Deno.test` e roda as mesmas funções sob Bun, com `assertEquals`/`assertThrows` do próprio arquivo e `Deno.readTextFile` mapeado para `node:fs`.

Resultado: **31 testes aprovados, 0 falhas** — cobrindo `fare-engine` (5), `dispatch-engine` (6), `ride-state` (6), `ride-request` (5), `settlement-validation` (5), `helpers` (3) e contrato de push 30s do Motorista (1).

Isso executa a lógica real dos módulos de tarifa, despacho e estado de corrida — não é inspeção textual.

## 3. Integração Cliente ↔ Motorista (contratos comparados)

| Contrato | Cliente (passageiro) | Motorista | Compatível? |
|---|---|---|---|
| Status da corrida | `procurar_motorista`, `motorista_a_caminho`, `motorista_chegou`, `em_viagem`, `finalizada`, `cancelada_*`, `expired` | `ride-state.ts` usa o mesmo conjunto (`tests/unit/ride-state.test.ts` cobre 6 transições) | **sim** |
| Preço | servidor calcula; cliente lê `estimated_price` | `fare-engine.ts` (5 testes) é o mesmo motor usado no despacho | **sim** |
| Cancelamento | `cancel-ride` no snapshot do passageiro | `driver-cancel-redispatch`, `driver-reject-redispatch` no motorista | **compatível, não exercitado em conjunto** |
| Localização / Realtime | `use-active-ride` assina `rides` com `unsubscribe` nos terminais | dispatcher consome presença e localização | **por código sim; E2E não executado** |
| Push | FCM compartilhado, sem `unregister` ao fechar módulo | contrato de oferta 30s validado por teste | **sim (teste)** |

## 4. Defeito encontrado — verificadores do Parceiro apontam para workspace inexistente

**Arquivos:** `scripts/verify-partner-motorista-*.mjs` (6 scripts).

Todos leem `.work/partner-motorista/…`, mas **nenhum script do repositório cria esse diretório**. O pipeline oficial `build:partner` (`scripts/build-partner-modules.sh`) usa `APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"` — ou seja, a variável é esperada, mas o workspace não é gerado por `normalize-partner-workspaces.mjs` (que exige dois argumentos: `<motorista> <entregador>` e não é chamado por `package.json`).

Ao criar a cópia manualmente (`.work/motorista` → `.work/partner-motorista`), os 6 verificadores passaram a **executar** e todos falharam em asserções de marcador (`data-apois-driver-menu-fullscreen-v4`, `ApoisRideComfortCard.tsx`, `APOIS_DRIVER_ROUTE_AUTH_V1`, `data-apois-driver-settings-contrast-v4`, `showStatusCheck`).

**Interpretação honesta:** as falhas são de **hardener não aplicado**, não necessariamente de produto. O caminho correto é rodar os hardeners `harden-partner-motorista-*` antes de verificar — o que `build:partner` faz e meu recorte manual não fez.

**Status:** **DEFEITO DE PIPELINE CONFIRMADO** (workspace ausente). **Correção NÃO aplicada** porque `build-partner-modules.sh` é o caminho oficial de release do Parceiro e alterá-lo é operação de risco de publicação — fica para sua decisão.

**Linha de correção proposta:** `normalize-partner-workspaces.mjs` sem argumentos deve derivar os dois workspaces de `.work/motorista` e `.work/entregas`, e `package.json` deve chamá-lo no `prepare:modules`.

## 5. Matriz — Fase 4

| Sistema | Função | Status | Gravidade | Evidência |
|---|---|---|---|---|
| Motorista | Typecheck | **APROVADO** | alta | `tsc --noEmit` limpo |
| Motorista | Build | **APROVADO** | crítica | `dist/client/index.html` gerado |
| Motorista | Superfície de release (sem rotas debug) | **APROVADO** | alta | auditor oficial |
| Motorista | Tarifa, despacho, estado, assentamento | **APROVADO (teste)** | crítica | 31 testes |
| Motorista | Contrato de push 30s | **APROVADO (teste)** | alta | teste dedicado |
| Motorista | 23 telas (login, docs, assinatura, ganhos, carteira…) | **NÃO EXECUTADO (UI)** | — | precisa aparelho |
| Admin Corridas | 23 rotas | **NÃO EXECUTADO (UI)** | — | precisa sessão admin + Supabase |
| Pipeline Parceiro | Workspace `.work/partner-motorista` | **DEFEITO CONFIRMADO** | alta | 6 verificadores quebrados |
| Integração Cliente↔Motorista | Status, preço, cancelamento, realtime | **APROVADO (código+teste)** / E2E **NÃO EXECUTADO** | crítica | §3 |

## 6. Bloqueios (mantidos)

- **Supabase**: sem acesso. Nenhuma RLS, RPC, Edge Function ou escrita real exercitada.
- **Mapas**: `CORRIDAS_*_MAPS_API_KEY` ausentes — mapa do Motorista não homologável.
- **Aparelho**: GPS, aceite/recusa real, PIN, navegação e push ficam **NÃO EXECUTADOS**.
- **Deno**: ausente; suítes executadas via shim documentado.

## 7. Defeito C-001 — correção preparada e testada

`supabase/functions/request-ride/index.ts` (versão do Superapp): adicionado `fare_amount_cents` ao retorno de criação, **sem remover nem renomear nenhum campo existente**. Contrato verificado por `scripts/qa/test-request-ride-estimated-price-contract-v1.mjs`: **7 testes aprovados** cobrindo criação, reutilização, erro interno, idempotência e leitura pelo cliente.

**Não houve deploy da Edge Function.**
