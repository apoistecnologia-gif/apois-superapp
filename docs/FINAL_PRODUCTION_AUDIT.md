# APOIS Superapp — Final Production Audit

> Checkpoint operacional. Este documento não autoriza publicação, deploy, aplicação de migrations ou alteração de secrets.

- **Data:** 2026-09-05
- **Branch:** `homologacao-apois-cliente`
- **HEAD documentado nesta revisão:** `62df6c21633c0a9b396047ca6ca69ebd9227b1c8`
- **Android package:** `br.com.apois.app`
- **Supabase Corridas canônico:** `vqtucstyduxrqjgyigfk`
- **Supabase Entregas canônico:** `sbvhdgyuuperszlsllji`
- **Supabase Corridas proibido/histórico:** `zjphbuvcapwyuynadgdt`

## Pins protegidos

Os pins permaneceram inalterados nesta rodada. Os sources protegidos não foram editados diretamente; toda adaptação é feita na camada de integração e em cópias `.work` descartáveis.

| Módulo | Repositório | Pin |
|---|---|---|
| Entregas | `franciel046631/apois-entregas` | `0a1e0b294f75c97bce903200b57e7a6b482f381a` |
| Corridas Passageiro | `franciel046631/say-hello-buddy-23-84b5dcbf` | `7b047f75a1a919a5336c0df6e0d60b14b02f2618` |
| Corridas Motorista/Admin | `franciel046631/movvi-go-connect` | `9fc171050d8b5703540c49d19a8f1e9f5162775f` |

## Arquitetura de identidade de Corridas

Os identificadores abaixo **não são intercambiáveis**:

1. **AUTH USER ID** — `auth.users.id`, `auth.uid()`, `public.users.auth_user_id`.
2. **DOMAIN USER ID** — `public.users.id`.
3. **DRIVER RECORD ID** — `public.drivers.id`.

Relações confirmadas no schema pinado:

- `public.drivers.user_id` → `public.users.id` (DOMAIN USER ID).
- `public.rides.passenger_id` → `public.users.id` (DOMAIN USER ID).
- `public.rides.driver_id` → `public.drivers.id` (DRIVER RECORD ID).
- `public.rides.accepted_driver_id` → `public.drivers.id` (DRIVER RECORD ID).
- `public.subscriptions.driver_id` → `public.drivers.id` (DRIVER RECORD ID).
- `public.cancellation_fees.passenger_id` → `public.users.id` (DOMAIN USER ID).
- `public.driver_wallets.driver_id` → `public.drivers.id` (DRIVER RECORD ID).
- `public.driver_wallet_transactions.driver_id` → `public.drivers.id` (DRIVER RECORD ID).

## Gateways e política financeira atual

Nenhum gateway novo foi integrado nesta rodada.

### Corridas

O boundary atual expõe **Dinheiro** e **Cartão direto ao motorista**. O motorista não pode escolher arbitrariamente `final_price`: a Edge Function transformada usa somente valor já persistido pelo backend (`ride.final_price ?? ride.estimated_price`), e o trigger pinado de settlement reforça o mesmo source of truth.

### Entregas

O produto Cliente usa pagamento direto `cash`, cria pedido com `payment_status` pendente e não deve chamar Mercado Pago, PagBank, Asaas ou OpenPix no fluxo ativo. O repasse ao entregador é `merchant_manual`: o estabelecimento paga diretamente ao entregador; a APOIS não deve custodiá-lo nem marcar payout como concluído sem evidência/autorização.

## Migrations forward obrigatórias

**Nenhuma foi aplicada em produção nesta rodada.** Código + migrations obrigatórias são tratados como uma única unidade de release.

### Corridas

- `supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql`
- `supabase/corridas-forward-migrations/20260905131500_harden_driver_wallet_and_cancellation_idempotency.sql`

### Entregas

- `supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql`
- `supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql`

A segunda migration de Corridas cria a barreira mecânica de idempotência `UNIQUE` por `cancellation_fees.ride_id` e corrige RLS de wallet/transactions para a cadeia AUTH → DOMAIN → DRIVER RECORD.

## Achados e correções desta rodada

### Request Ride — falha de dispatch

Problema confirmado: a função criava `procurar_motorista`, chamava `dispatch()` e engolia exceção, podendo retornar sucesso para uma corrida sem matching ativo.

Correção no integrador:

- rollback lógico somente se a corrida ainda estiver `procurar_motorista`;
- `driver_id IS NULL` e `accepted_driver_id IS NULL` obrigatórios no cleanup;
- estado terminal existente `cancelada_passageiro` é usado para a falha interna;
- `cancellation_reason` registra falha de dispatch;
- nenhum fee/wallet é criado;
- `request_key` é liberado no registro terminal para permitir retry do mesmo request sem apagar auditoria;
- se uma corrida avançou concorrentemente, o cleanup não a sobrescreve; a função relê e devolve o estado real;
- erro de dispatch retorna erro real ao cliente, não falso sucesso.

### Driver Ride Action — final price

Problema confirmado: `finish` aceitava qualquer `final_price > 0` enviado pelo cliente/motorista.

Correção: o parâmetro do cliente deixa de ser autoridade. `finish` utiliza preço persistido pelo backend; a migration/trigger histórica de settlement já reforça essa regra.

### Cancelamento — identidade e idempotência

Correções materializadas:

- AUTH USER ID é resolvido para DOMAIN USER ID antes de autorizar/escrever;
- UI oferece cancelamento somente em `procurar_motorista` e `motorista_a_caminho`, como o backend;
- fórmula de fee inexistente foi removida da UI;
- fee usa `app_settings` do backend;
- retry de corrida já cancelada reconcilia fee/wallet caso a primeira execução tenha falhado após mudar o status;
- índice forward-only único por `ride_id` impede fee duplicado mecanicamente;
- fee já liquidado não volta a bloquear wallet.

### Baseline histórico Corridas

**Erro confirmado, não falso positivo.** O arquivo protegido `supabase/migrations/20260806000000_clean_baseline.sql` contém vírgula ausente entre `rejected_driver_ids UUID[]` e `accepted_at TIMESTAMPTZ`.

Como o source é protegido, ele não foi editado. `scripts/prepare-corridas-clean-room.mjs` corrige exatamente esse erro somente na cópia `.work/corridas`, para permitir uma futura execução clean-room reproduzível. Isso **não equivale a clean-room PASS**.

## Validações executadas

Os resultados abaixo vieram da árvore Entregas transformada a partir do pin exato no executor conectado. Nenhum resultado é promovido para um nível de validação maior do que o efetivamente executado.

| Comando/etapa | Exit | Resultado |
|---|---:|---|
| checkout Entregas pinado | 0 | PASS |
| `prepare-workspace.mjs entregas` | 0 | PASS |
| `adapt-module-for-superapp.mjs entregas` | 0 | PASS |
| hardeners principais Entregas | 0 | PASS |
| `bun install --frozen-lockfile` | 1 | lock protegido incompatível com Bun 1.3.14 |
| `bun install --no-save` em `.work` | 0 | PASS; source/lock protegido não alterado |
| `audit-superapp-static.mjs` | 0 | PASS |
| `verify-corridas-database-ownership.mjs` | 0 | PASS |
| `audit-entregas-merchant-payments.mjs` | 0 | PASS |
| `audit-payment-boundary.mjs` | 0 | PASS |
| `verify-superapp-release-requirements.mjs` | 0 | PASS em modo desenvolvimento, com warnings de env de Corridas |
| Entregas `bun run typecheck` | 0 | PASS |
| Entregas `bun run lint` | 1 | FAIL: 2558 problemas |
| Entregas `bun run test` | 0 | 43 pass, 0 fail, 6 arquivos |
| Entregas `bun run build:customer` | 0 | PASS |
| Entregas `bun run build:merchant` | 0 | PASS |

O novo `audit-entregas-customer-bundle.mjs`, adicionado após `build:customer`, ainda precisa ter sua execução colhida no HEAD que o contém.

## Lint — triagem

Resultado conhecido e preservado como FAIL:

- **2558 problemas**
- **2208 errors**
- **350 warnings**
- **2207 errors** reportados como potencialmente auto-fixáveis pelo ESLint

Classificação atual:

- **D — estilo/Prettier:** maioria dos errors.
- **C — legado/desativado:** grande volume nas Edge Functions antigas de Mercado Pago/refund/readiness/sync, fora do boundary financeiro ativo.
- **A/B — código ativo:** há warnings `no-explicit-any` e foi localizado um warning funcional de hook em `CustomerLocationAddressSelector.tsx`; o integrador passou a memoizar `locate` e incluir a dependência correta no `useEffect`.
- Não foi executado formatter global nem alteração massiva do source protegido.

## Clean-room

**PENDENTE.**

Há preparação reproduzível para reparar o erro sintático histórico apenas na cópia descartável, mas a cadeia de migrations ainda não foi aplicada em PostgreSQL/Supabase limpo nesta rodada.

`migration review PASS` ≠ `clean-room PASS` ≠ `produção migrada`.

## Android

**PENDENTE.**

Nenhum APK/AAB foi gerado nesta rodada. Google OAuth real, Maps real, GPS/background, push, deep links, Android Back, resume e atualização/cache de WebView continuam dependentes de build/dispositivo apropriado.

## Matriz de achados

| ID | Severidade | App | Jornada | Causa raiz | Correção | Validação | Status |
|---|---|---|---|---|---|---|---|
| RID-01 | P0/P1 | Corridas Passageiro | Request ride / matching | exceção de `dispatch()` era engolida depois de criar a ride | rollback lógico condicional + erro real + retry seguro | verificador de regressão criado; build Corridas ainda não executado neste HEAD | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-02 | P1 | Corridas Motorista | Finish | `final_price > 0` do cliente era aceito como autoridade | preço final passa a vir do estado persistido/backend | verificador + trigger histórico revisado; build Motorista pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-03 | P1 | Corridas | Identidade | AUTH/DOMAIN/DRIVER IDs misturados em dispatch/action/push | resolução explícita em cada boundary | `verify-corridas-database-ownership` EXIT 0; builds finais pendentes | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-04 | P1 | Corridas Passageiro | Cancelamento | retry podia deixar fee/wallet parcial e RLS de wallet usava AUTH como DRIVER RECORD | reconciliação idempotente + UNIQUE por ride + RLS AUTH→DOMAIN→DRIVER | migration versionada, não aplicada; fixture Corridas pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| MIG-01 | P1 | Corridas DB | Clean-room | baseline histórico possui vírgula ausente em `rejected_driver_ids` | reparo exato somente em `.work` para futura clean-room | inspeção do arquivo real confirmou defeito; DB limpo ainda não executado | PENDENTE |
| DEL-01 | P1 | Entregas Cliente | Checkout | gateways antigos precisavam ser removidos do fluxo ativo | boundary direto `cash/pending`, sem gateway | typecheck 0, tests 0, build customer 0; E2E não executado | CORRIGIDO / E2E NÃO VERIFICADO |
| DEL-02 | P1 | Merchant | Pedidos cash/pending | pedidos diretos podiam ser tratados como não operacionais | merchant reconhece cash/pending sem marcar pago | hardeners 0 + build merchant 0 | CORRIGIDO / E2E NÃO VERIFICADO |
| DEL-03 | P1 | Entregas | Courier settlement | `merchant_manual` precisava impedir custódia/payout falso | settlement fica pendente até evidência/admin autorizado | migration forward revisada; clean-room/E2E pendentes | CORRIGIDO / E2E NÃO VERIFICADO |
| LINT-01 | P2 | Entregas | Qualidade | source-wide inclui dívida histórica e formatação | triagem, sem formatter global; hook ativo corrigido pontualmente | lint continua EXIT 1 | PENDENTE |
| BLD-01 | P1 | Superapp | Release | Corridas/Motorista sources não estavam materializados no executor Entregas | nenhuma falsa fixture criada | build completo não executado | PENDENTE |
| AND-01 | P1 | Android | Release | build físico não executado | nenhuma | APK/AAB não gerados | PENDENTE |

## Pendências de código atuais

- executar fixture/build Corridas com os hardeners de lifecycle/identity/cancelamento realmente aplicados;
- concluir inspeção funcional de Motorista;
- concluir inspeção funcional de Entregador;
- concluir classificação de endpoints Admin/Merchant e IDOR;
- executar o novo audit do bundle Cliente e investigar qualquer marcador que sobreviva;
- preparar/executar testes multiusuário de RLS quando houver PostgreSQL/Supabase descartável;
- completar clean-room das migrations.

## Dependências externas

Somente devem ser classificadas como externas quando realmente exigirem ambiente/credencial fora do código:

- Supabase/PostgreSQL descartável para clean-room e testes RLS multiusuário;
- configuração real de Maps/Google OAuth;
- Firebase real;
- toolchain Android + dispositivo/emulador para APK/AAB e comportamento nativo;
- aplicação controlada das migrations em ambiente alvo, apenas após autorização.

## Release blockers no checkpoint

1. Build Corridas transformado ainda não executado com as correções desta rodada.
2. Build Motorista ainda não executado com as correções desta rodada.
3. Build Superapp + `verify:dist` ainda não executados.
4. Clean-room das migrations ainda não executado.
5. Auditoria funcional/IDOR de Motorista, Entregador e Admin ainda não concluída.
6. Android APK/AAB e E2E externo ainda não verificados.

**Status global neste checkpoint: PENDENTE para publicação.**
