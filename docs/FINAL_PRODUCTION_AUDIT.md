# APOIS Superapp — Final Production Audit

> Checkpoint operacional. Este documento não autoriza publicação, deploy, aplicação de migrations ou alteração de secrets.

- **Data:** 2026-09-05
- **Branch:** `homologacao-apois-cliente`
- **HEAD confirmado antes desta atualização:** `3ccfe3f1e24bdf6145ec652a50d77eedfd8632c3`
- **Parent confirmado:** `33637c4c27d7f8e5db43c880923fdb3da574b77f`
- **Android package:** `br.com.apois.app`
- **Supabase Corridas canônico:** `vqtucstyduxrqjgyigfk`
- **Supabase Entregas canônico:** `sbvhdgyuuperszlsllji`
- **Supabase Corridas proibido/histórico:** `zjphbuvcapwyuynadgdt`

## Proveniência da branch e divergência de HEAD

O SHA anteriormente esperado `31ae367757129917662818c58f94d00c1cc713a0` não foi resolvível pelo mecanismo GitHub disponível na rodada anterior. Por isso, a continuidade não usa esse SHA como prova de ancestralidade.

A proveniência foi restabelecida diretamente pela ref `homologacao-apois-cliente`: antes de qualquer nova correção desta rodada, a branch apontava para `3ccfe3f1e24bdf6145ec652a50d77eedfd8632c3`, com parent `33637c4c27d7f8e5db43c880923fdb3da574b77f`. O histórico recente contém, entre outros, `9fc2bed2d2654369251cc120e58da44ffb8679de` (`build(motorista): apply auth and provider hardening before build`), `33637c4c...` (`docs(security): map backend authorization boundaries`) e `3ccfe3f1...` (`test(security): verify backend authorization boundaries`).

Como a ancestralidade do SHA `31ae...` não pôde ser usada, a integridade das correções críticas é confirmada por **conteúdo presente na árvore atual**, e não apenas por nomes de commits.

### Contratos críticos encontrados na árvore atual

**Corridas:**

- Auth UUID e DOMAIN USER ID tratados como identidades distintas;
- profile por `public.users.auth_user_id`;
- Google OAuth com `flowType: "pkce"`, dedupe de callback, `browserFinished`, `App.getLaunchUrl()` e cleanup de listeners;
- `request-ride` com `rollbackFailedDispatch`, cleanup condicional e `cancellation_reason`;
- `driver-ride-action` ignora `final_price` arbitrário do body e usa `ride.final_price ?? ride.estimated_price`;
- `cancel-ride` resolve AUTH → DOMAIN USER antes de ownership/escrita;
- cancellation fee tem reconciliação de retry e migration forward com `UNIQUE` por `ride_id`;
- wallet do motorista tem RLS AUTH → DOMAIN → DRIVER RECORD;
- `verify-corridas-ride-lifecycle-regressions.mjs` permanece versionado.

**Entregas:**

- payment boundary direto sem gateway no checkout release;
- `cash` + `payment_status` pendente sem fabricar `paid`;
- Merchant cash/pending por membership do `merchant_id`;
- `merchant_manual` versionado;
- `audit-entregas-customer-bundle.mjs` permanece versionado;
- fixture Cliente/Merchant permanece no integrador;
- migrations forward obrigatórias continuam presentes.

**Motorista:**

- provider boundary remove provisionamento automático Asaas;
- mensalidade informa indisponibilidade de gateway e não expõe CTA eletrônico morto;
- `audit-motorista-release-surface.mjs` existe e verifica a árvore mobile/dist executável;
- finance/state hardening permanece versionado.

**Autorização:**

- `docs/BACKEND_AUTHORIZATION_MATRIX.md` presente;
- `scripts/verify-backend-authorization-boundaries.mjs` presente.

Nenhuma correção crítica acima precisou ser restaurada antes da continuação.

## Pins protegidos

Os pins permanecem inalterados. Os sources protegidos não são editados diretamente; toda adaptação é feita na camada de integração e em cópias `.work` descartáveis.

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

## Achados e correções acumuladas

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

### Motorista — boundary financeiro/release

Correções já presentes na árvore:

- login/profile não provisiona subconta Asaas;
- mensalidade não inicia Pix/cartão/débito por gateway desativado;
- estado de mensalidade real permanece visível;
- acesso de homologação não cria cobrança;
- auditor de release verifica árvore mobile e, quando existe, `dist/client` executável para impedir rotas debug/dev e gateways antigos.

### Authorization / IDOR

A matriz backend e o verificador estático estão versionados. A execução real do verificador e a ampliação do inventário service_role/SECURITY DEFINER são objetivos ainda abertos desta rodada. Resultado estático nunca será promovido a E2E PASS sem teste A/B/RLS.

### Baseline histórico Corridas

**Erro confirmado, não falso positivo.** O arquivo protegido `supabase/migrations/20260806000000_clean_baseline.sql` contém vírgula ausente entre `rejected_driver_ids UUID[]` e `accepted_at TIMESTAMPTZ`.

Como o source é protegido, ele não foi editado. `scripts/prepare-corridas-clean-room.mjs` corrige exatamente esse erro somente na cópia `.work/corridas`, para permitir uma futura execução clean-room reproduzível. Isso **não equivale a clean-room PASS**.

## Validações acumuladas conhecidas

Os resultados abaixo não são promovidos para um nível de validação maior do que o efetivamente executado.

| Comando/etapa | Exit | Resultado |
|---|---:|---|
| checkout Entregas pinado | 0 | PASS |
| `prepare-workspace.mjs entregas` | 0 | PASS |
| `adapt-module-for-superapp.mjs entregas` | 0 | PASS |
| hardeners principais Entregas | 0 | PASS |
| `bun install --frozen-lockfile` | 1 | lock protegido incompatível com Bun usado no executor |
| `bun install --no-save` em `.work` | 0 | PASS; source/lock protegido não alterado |
| `audit-superapp-static.mjs` | 0 | PASS em execução anterior |
| `verify-corridas-database-ownership.mjs` | 0 | PASS em execução anterior |
| `audit-entregas-merchant-payments.mjs` | 0 | PASS em execução anterior; revisar coerência com boundary atual nos gates finais |
| `audit-payment-boundary.mjs` | 0 | PASS em execução anterior |
| `verify-superapp-release-requirements.mjs` | 0 | PASS em modo desenvolvimento, com warnings de env de Corridas |
| Entregas `bun run typecheck` | 0 | PASS |
| Entregas `bun run lint` | 1 | FAIL source-wide |
| Entregas `bun run test` | 0 | 43 pass, 0 fail, 6 arquivos |
| Entregas `bun run build:customer` | 0 | PASS |
| Entregas `bun run build:merchant` | 0 | PASS |

## Lint — triagem

Resultado source-wide conhecido e preservado como FAIL. Não executar formatter global nem reforma de milhares de arquivos históricos. A rodada atual deve extrair somente regras potencialmente funcionais/security do runtime ativo e registrar contagem por regra.

## Clean-room

**PENDENTE / NOT EXECUTED.**

Há preparação reproduzível para reparar o erro sintático histórico apenas na cópia descartável, mas a cadeia de migrations ainda não foi aplicada em PostgreSQL/Supabase limpo nesta rodada.

`migration review PASS` ≠ `clean-room PASS` ≠ `produção migrada`.

## Android

**PENDENTE.**

Nenhum APK/AAB foi gerado nesta rodada. Google OAuth real, Maps real, GPS/background, push, deep links, Android Back, resume e atualização/cache de WebView continuam dependentes de build/dispositivo apropriado.

## Matriz de achados

| ID | Severidade | App | Jornada | Causa raiz | Correção | Validação | Status |
|---|---|---|---|---|---|---|---|
| RID-01 | P0/P1 | Corridas Passageiro | Request ride / matching | exceção de `dispatch()` era engolida depois de criar a ride | rollback lógico condicional + erro real + retry seguro | verificador de regressão criado; build Corridas ainda pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-02 | P1 | Corridas Motorista | Finish | `final_price > 0` do cliente era aceito como autoridade | preço final passa a vir do estado persistido/backend | verificador + trigger histórico revisado; build Motorista pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-03 | P1 | Corridas | Identidade | AUTH/DOMAIN/DRIVER IDs misturados em dispatch/action/push | resolução explícita em cada boundary | verifier versionado; execução final pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| RID-04 | P1 | Corridas Passageiro | Cancelamento | retry podia deixar fee/wallet parcial e RLS de wallet usava AUTH como DRIVER RECORD | reconciliação idempotente + UNIQUE por ride + RLS AUTH→DOMAIN→DRIVER | migration versionada, não aplicada; fixture Corridas pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| MIG-01 | P1 | Corridas DB | Clean-room | baseline histórico possui vírgula ausente em `rejected_driver_ids` | reparo exato somente em `.work` para futura clean-room | inspeção do arquivo real confirmou defeito; DB limpo ainda não executado | PENDENTE |
| DEL-01 | P1 | Entregas Cliente | Checkout | gateways antigos precisavam ser removidos do fluxo ativo | boundary direto `cash/pending`, sem gateway | typecheck/tests/build customer anteriores; E2E não executado | CORRIGIDO / E2E NÃO VERIFICADO |
| DEL-02 | P1 | Merchant | Pedidos cash/pending | pedidos diretos podiam ser tratados como não operacionais | merchant reconhece cash/pending sem marcar pago | build merchant anterior; RLS A/B pendente | CORRIGIDO / E2E NÃO VERIFICADO |
| DEL-03 | P1 | Entregas | Courier settlement | `merchant_manual` precisava impedir custódia/payout falso | settlement fica pendente até confirmação manual autorizada | migration/RPC revisados; clean-room/E2E pendentes | CORRIGIDO / E2E NÃO VERIFICADO |
| MOT-01 | P1 | Motorista | Login/Profile | profile aprovado provisionava gateway legado | provider boundary remove side effect | script versionado; build final pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| MOT-02 | P1 | Motorista | Mensalidade | UI podia oferecer fluxo eletrônico sem provider homologado | tela informativa sem CTA de gateway | script versionado; build final pendente | CORRIGIDO / BUILD NÃO VERIFICADO |
| AUTH-01 | P1 | Backend | Authorization | inventário service_role/IDOR estava incompleto | matriz + verifier versionados | execução/inventário completo pendentes | EM VALIDAÇÃO |
| LINT-01 | P2 | Entregas | Qualidade | source-wide inclui dívida histórica e formatação | triagem, sem formatter global | lint continua EXIT 1 | PENDENTE |
| BLD-01 | P1 | Superapp | Release | Corridas/Motorista sources não estavam materializados no executor Entregas | nenhuma falsa fixture criada | build completo não executado | PENDENTE |
| AND-01 | P1 | Android | Release | build físico não executado | nenhuma | APK/AAB não gerados | PENDENTE |

## Pendências de código atuais

- executar `verify-backend-authorization-boundaries.mjs` e corrigir falhas reais;
- completar inventário de Edge Functions com `service_role` e RPCs `SECURITY DEFINER` ativos;
- provar backend/storage ownership de `driver_update_document`;
- executar `audit-motorista-release-surface.mjs` em árvore transformada e artefato, quando materializável;
- executar pipeline Partner e build Motorista;
- executar os quatro verificadores Corridas e build Corridas, quando o source privado puder ser materializado sem alterar secrets;
- executar gates finais possíveis e registrar exit code real;
- executar build Superapp + `verify:dist` se os três sources estiverem disponíveis;
- preparar/executar testes multiusuário de RLS em ambiente descartável;
- completar clean-room das migrations.

## Dependências externas

Somente devem ser classificadas como externas quando realmente exigirem ambiente/credencial fora do código:

- Supabase/PostgreSQL descartável para clean-room e testes RLS multiusuário;
- configuração real de Maps/Google OAuth;
- Firebase real;
- toolchain Android + dispositivo/emulador para APK/AAB e comportamento nativo;
- materialização dos submódulos Corridas/Motorista no executor sem alteração de secrets, se a credencial atual não permitir;
- aplicação controlada das migrations em ambiente alvo, apenas após autorização.

## Release blockers no checkpoint

1. Authorization crítica ainda precisa de execução do verifier + inventário completo + RLS/E2E A/B.
2. Build Corridas transformado ainda não executado no checkpoint atual.
3. Build Motorista ainda não executado no checkpoint atual.
4. Build Superapp + `verify:dist` ainda não executados.
5. Clean-room das migrations ainda não executado.
6. Android APK/AAB e E2E externo ainda não verificados.

**Status global neste checkpoint: PENDENTE para publicação.**
