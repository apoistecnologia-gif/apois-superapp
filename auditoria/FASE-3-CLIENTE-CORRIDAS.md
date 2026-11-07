# APOIS — Fase 3 · Cliente Corridas (auditoria funcional)

**Branch:** `audit/continuacao-20261107` · **Pin auditado:** `7b047f75a1a919a5336c0df6e0d60b14b02f2618`
**Método:** leitura de código + execução de build real + 20 verificadores automatizados. Sem aparelho, sem Supabase.

---

## 1. Inventário — 16 rotas

| Rota | Arquivo | Linhas | Função |
|---|---|---:|---|
| `_public.index` | `_public.index.tsx` | 28 | landing/entrada |
| `_public.login` | `_public.login.tsx` | 126 | login e-mail/senha + Google |
| `_public.cadastro` | `_public.cadastro.tsx` | 193 | cadastro |
| `_public.recuperar-senha` | `_public.recuperar-senha.tsx` | 100 | recuperação |
| `_public.redefinir-senha` | `_public.redefinir-senha.tsx` | 131 | novo password |
| `_authenticated.tsx` | `_authenticated.tsx` | 110 | guarda de sessão + shell |
| `_authenticated.inicio` | `_authenticated.inicio.tsx` | 325 | home + mapa |
| `_authenticated.buscar-destino` | `_authenticated.buscar-destino.tsx` | 384 | busca de destino |
| `_authenticated.revisar-solicitacao` | `_authenticated.revisar-solicitacao.tsx` | 234 | revisão e confirmação |
| `_authenticated.corrida.$rideId` | `_authenticated.corrida.$rideId.tsx` | 286 | acompanhamento |
| `_authenticated.corridas` | `_authenticated.corridas.tsx` | 9 | histórico |
| `_authenticated.carteira` | `_authenticated.carteira.tsx` | — | carteira |
| `_authenticated.notificacoes` | `_authenticated.notificacoes.tsx` | 282 | notificações |
| `_authenticated.perfil` | `_authenticated.perfil.tsx` | 164 | perfil |

Total 2.430 linhas em rotas + hooks de corrida (537 linhas em `use-ride-request` e `use-active-ride`).

## 2. Backend do fluxo (Edge Functions do snapshot)

`request-ride` (827 linhas), `cancel-ride`, `passenger-pricing-estimate`, `passenger-routes-compute`, `passenger-geocode-reverse`, `process-ride-dispatch`, `driver-ride-action`, `send-ride-push`, `mercado-pago-*`, `pagbank-*`.

## 3. O que foi **executado** (evidência real)

| Verificação | Comando | Resultado |
|---|---|---|
| Preparação do workspace | `node scripts/prepare-workspace.mjs corridas` | OK — snapshot copiado e adaptado |
| Instalação de dependências | `bun install --frozen-lockfile` (523 pacotes) | OK |
| **Build do módulo** | `bun run build:capacitor` no `.work/corridas` | **✓ built in 2m 14s** |
| Build do módulo isolado + hardeners | `build-isolated-module.mjs corridas` | OK até o `bun run build` |
| Verificadores do Cliente Corridas | 20 scripts `verify-corridas-*` | **20/20 OK** |

Os 20 verificadores aprovados cobrem: ciclo de vida da corrida, regressões de lifecycle, fluxo da viagem, histórico, carteira, edição de perfil, paradas, despacho, retry de embarque, sugestões de destino, contraste, safe area do rodapé, recuperação de categoria, home compacta, posse do banco, source-of-truth do Supabase, elegibilidade sem gateway, PIN visível ao motorista e conforto da viagem.

## 4. Fluxo auditado ponta a ponta (leitura de código, com achados)

### 4.1 Solicitação de corrida — `request-ride`

O caminho é `confirmRide()` → `supabase.functions.invoke("request-ride", { action: "create", request_key, … })`. Pontos verificados:

- **Idempotência real:** a chave vem do cliente (`uuidv4` recriada sempre que categoria/origem/destino mudam) e a function valida o formato UUID; chave inválida gera uma nova no servidor. Consulta `rides.request_key` antes de inserir e devolve `reused: true` se já existir.
- **Trava de duplo toque no cliente:** `confirmationInFlightRef` + `activeSubmissionRef` impedem duas submissões concorrentes.
- **Antes de criar, recupera corrida ativa:** `recoverActiveRide()` navega para a corrida existente em vez de criar outra.
- **Bloqueios verificados:** passageiro bloqueado (`blocked_at`), suspenso (`suspended_until`) e carteira bloqueada (`passenger_debt_block`).
- **Preço calculado no servidor** a partir da tarifa da categoria, sem confiar no valor do cliente.

### 4.2 Acompanhamento — `use-active-ride`

Estados terminais tratados explicitamente: `finalizada`, `expired`, `cancelada_*` → `screenState` muda e o **Realtime é cancelado** (`unsubscribe`). Há `requestSequenceRef` para descartar respostas fora de ordem. **Nenhum defeito encontrado neste caminho.**

## 5. Defeito encontrado — e não corrigido por decisão

### C-001 · Preço da corrida volta `null` logo após a criação

**Arquivo:** `supabase/functions/request-ride/index.ts` (retorno do caminho de criação).

O hook `use-ride-request.tsx` já sabe ler `estimated_price` da resposta:

```ts
if (typeof value["estimated_price"] === "number" && Number.isFinite(value["estimated_price"])) {
  response.estimated_price = value["estimated_price"];
}
```

Mas a function devolve a chave com outro nome — `estimated_price` só aparece nos caminhos **reuse** (linhas 605 e 641); o caminho de criação nova devolve o valor sob outra chave. Resultado: o campo chega `undefined` e o cliente exibe "—" até o primeiro Realtime/polling atualizar a corrida.

**Impacto:** cosmético-funcional. Não perde corrida, não cobra errado (o preço vem do servidor). O passageiro vê ausência de preço por alguns segundos.

**Status:** **DEFEITO CONFIRMADO — correção NÃO aplicada.**
Motivo: a correção muda o contrato de resposta de uma Edge Function que o **Motorista e o Admin** também consomem, e o snapshot é protegido. Não aplico alteração de contrato de backend sem que você aprove, porque o risco de regressão cruza módulos.

**Linha de correção proposta (para aprovação):** incluir `estimated_price` no objeto de retorno da criação, mantendo as demais chaves. É aditivo — nenhum consumidor existente quebra.

## 6. Matriz — Fase 3

| Sistema | Função | Esperado | Observado | Status | Gravidade | Evidência |
|---|---|---|---|---|---|---|
| Cliente Corridas | Build do módulo | compilar | ✓ built in 2m 14s | **APROVADO** | crítica | execução local |
| Cliente Corridas | 20 verificadores de regressão | todos passarem | 20/20 | **APROVADO** | alta | execução local |
| Cliente Corridas | Idempotência da solicitação | 1 corrida por request_key | garantida no servidor | **APROVADO (código)** | alta | `request-ride` |
| Cliente Corridas | Duplo toque no confirmar | bloqueado | `confirmationInFlightRef` | **APROVADO (código)** | alta | `revisar-solicitacao.tsx` |
| Cliente Corridas | Corrida ativa recuperada | sem duplicar | `recoverActiveRide()` | **APROVADO (código)** | alta | `revisar-solicitacao.tsx` |
| Cliente Corridas | Estados terminais / Realtime | encerrar assinatura | `unsubscribe` nos 3 terminais | **APROVADO (código)** | média | `use-active-ride.tsx` |
| Cliente Corridas | Preço na resposta da criação | número | ausente no caminho de criação | **DEFEITO CONFIRMADO** | média | `request-ride/index.ts` |
| Cliente Corridas | Divisão/roteamento financeiro | servidor | tarifa calculada no servidor | **APROVADO (código)** | alta | `request-ride` |
| Cliente Corridas | Mapa Google nativo | renderizar | depende de chave ausente no ambiente | **NÃO EXECUTADO** | — | precisa `CORRIDAS_*_MAPS_API_KEY` |
| Cliente Corridas | GPS real, rota real, PIN | funcionar | — | **NÃO EXECUTADO** | — | precisa aparelho |
| Cliente Corridas | Integração com Motorista | status sincronizarem | — | **NÃO EXECUTADO** | — | precisa 2 aparelhos + Supabase |

## 7. Bloqueios desta fase

1. **Chaves de mapa** (`CORRIDAS_WEB_MAPS_API_KEY`, `CORRIDAS_ANDROID_MAPS_API_KEY`): sem elas o build passa, mas o mapa não é homologável — o próprio build emite `[WARN]`.
2. **Supabase**: nenhuma escrita, leitura de RLS ou teste de RPC executado.
3. **Aparelho**: nenhum teste físico de GPS, rota, PIN ou push.

## 8. Próximo

Fase 4 — Motorista (`sources/apois-corridas-motorista-admin`): 73 rotas, incluindo `admin.*`, com a mesma profundidade.
