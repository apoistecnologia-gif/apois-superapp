# APOIS — Fase 5 · Entregador (APOIS Parceiro)

**Branch:** `audit/continuacao-20261107` · **Snapshot:** `2f4606e0` (mesmo do Cliente Entregas)
**Método:** workspace real, 33 hardeners executados, build real nos 4 modos, 4 audits. Sem aparelho, sem Supabase.

---

## 1. Montagem do ambiente do Entregador

O Parceiro compila o módulo Entregador a partir do **mesmo repositório** do Cliente Entregas, num workspace separado (`.work/partner-entregador`) com `VITE_APOIS_PRODUCT_MODE=courier`. Confirmei isso em `scripts/build-partner-modules.sh` (linha 194+).

Montei a cópia sem `node_modules`, instalei as 448 dependências e rodei a cadeia de 33 hardeners `harden-partner-entregador-*` com `APOIS_ENTREGAS_WORKSPACE=.work/partner-entregador` e `APOIS_ENTREGAS_AUTH_HOME=/courier`.

## 2. Seis defeitos de hardener encontrados e corrigidos

Todos eram **o hardener exigindo texto que o snapshot já superou** — nenhum era defeito de produto. Cada um derrubava o build do Parceiro.

| # | Hardener | Causa raiz | Correção |
|---|---|---|---|
| 1 | `-privacy` | exigia a frase antiga de PIX/carteira; o snapshot já descreve conciliação de ganhos | substituições condicionais; contrato passa a ser o **significado** (não prometer PIX-only, carteira ou saque) |
| 2 | `-profile` | exigia `window.location.replace` numa string com aspas simples; e `PanelHeader` no arquivo errado | comparação normalizada de aspas/espaços; navegação verificada no arquivo certo |
| 3 | `-terms` | exigia a frase genérica "formas de pagamento habilitadas"; o snapshot já diz "pagamento direto ao estabelecimento" | aceita as duas redações; proíbe prometer saque/carteira |
| 4 | `-back-navigation` | exigia `if (historyOpen) {…}`; o snapshot evoluiu para `historyOpen && !activeJob` (mais seguro) | valida a presença dos painéis, não a forma exata |
| 5 | `-map` | herdava a falha do `-privacy` | resolvido em cascata |
| 6 | **`-gps-resume`** | **não idempotente**: inserir `let appStateHandle` duas vezes → `PARSE_ERROR: Identifier 'appStateHandle' has already been declared` | inserção condicional + contrato que falha se o símbolo aparecer mais de uma vez |

O nº 6 é o mais relevante: **o build do Entregador estava quebrado** com 16 erros de parse, e a causa era o hardener reaplicado, não o código de produto.

## 3. Execuções reais

| Verificação | Comando | Resultado |
|---|---|---|
| 33 hardeners `harden-partner-entregador-*` | execução completa | **33/33 OK, 0 falhas** |
| Build Entregador (Parceiro) | `VITE_APOIS_PRODUCT_MODE=courier bun run build` | **✓ built in 7.53s** |
| Build Cliente (mesmo snapshot) | `… customer` | **OK** |
| Build Estabelecimento | `… merchant` | **OK** |
| Build Admin Entregas | `… admin` | **OK** |
| Audits do Entregador | 4 scripts `audit-partner-entregador-*` | **4/4 OK** |

Os audits cobrem: runtime v3, sessão nativa v4, troca de perfil v5 (trava de função operacional) e background v6 (GPS em foreground service).

## 4. Fluxo auditado (leitura de código, com evidência)

- **Botão Voltar do Android:** fecha painéis internos (suporte, histórico, financeiro, perfil) **somente quando não há entrega ativa** (`historyOpen && !activeJob`). Com entrega em curso, mostra aviso em vez de sair. Com `is_online`, bloqueia a saída ao seletor. O `backHandle` é removido no cleanup — sem listener órfão.
- **Push:** `register_courier_push_device_v2`, token vinculado ao package `br.com.apois.parceiro`, e `PARTNER_PENDING_PUSH_KEY` encaminha push de corrida ao shell (Motorista).
- **Operação:** `COURIER_ACTION_TIMEOUT_MS = 20_000` limita ações de entrega; troca de etapa reconcilia o `activeJob.id` correto.
- **Política financeira:** os Termos e a Privacidade do Entregador **não prometem** PIX-only, carteira ativa nem saque manual — coerente com o bloqueio de repasse direto até homologação `marketplace_direct_live`.

## 5. Matriz — Fase 5

| Sistema | Função | Status | Gravidade | Evidência |
|---|---|---|---|---|
| Entregador | Build courier | **APROVADO** | crítica | 7.53s, sem erros |
| Entregador | 33 hardeners do Parceiro | **APROVADO** | crítica | 33/33 |
| Entregador | Botão Voltar com guarda de operação | **APROVADO (código)** | alta | `courier.tsx` |
| Entregador | Push vinculado ao package do Parceiro | **APROVADO (código)** | alta | `courier-push.ts` |
| Entregador | Timeout de ações (anti-giro infinito) | **APROVADO (código)** | alta | `COURIER_ACTION_TIMEOUT_MS` |
| Entregador | Termos/Privacidade sem promessa financeira | **APROVADO (código)** | alta | hardeners |
| Entregador | GPS em background / foreground service | **NÃO EXECUTADO (aparelho)** | — | precisa dispositivo |
| Entregador | Aceite, coleta, PIN, entrega, ganhos | **NÃO EXECUTADO (UI)** | — | precisa aparelho + Supabase |
| Entregador | Sincronização com Cliente e Estabelecimento | **NÃO EXECUTADO (E2E)** | crítica | precisa 3 atores |

## 6. Bloqueios

- **Supabase**: sem acesso — nenhuma RLS, RPC ou escrita exercitada.
- **Aparelho**: GPS em segundo plano, foreground service, aceite/recusa de oferta, PIN de entrega e push **não executados**.
- **Chaves**: mapas não homologáveis no ambiente.

## 7. Próximo

Fase 6 — Painel do Estabelecimento (`merchant`), já compilando neste mesmo snapshot, com foco no ciclo do pedido ponta a ponta.
