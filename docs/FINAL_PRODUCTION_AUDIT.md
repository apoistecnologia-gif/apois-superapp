# APOIS Superapp — Final Production Audit

> Documento de fechamento de produção. Não autoriza deploy, aplicação de migrations, alteração de secrets ou mudança dos pins protegidos.

- Data: 2026-09-05
- Branch: `homologacao-apois-cliente`
- HEAD observado imediatamente antes desta revisão: `41fa0d388818552ab551af619eb8674704b45818`
- Android package Cliente: `br.com.apois.app`
- Supabase Corridas canônico: `vqtucstyduxrqjgyigfk`
- Supabase Entregas canônico: `sbvhdgyuuperszlsllji`
- Supabase Corridas histórico/proibido em runtime: `zjphbuvcapwyuynadgdt`

## Proveniência e divergência histórica

O SHA anteriormente esperado `31ae367757129917662818c58f94d00c1cc713a0` não foi resolvível. A continuidade passou a ser baseada na ref real e nos contratos presentes na árvore, não na suposição de que aquele SHA exista. A rodada de fechamento iniciou em `ae567dbb313b0aed9131c5125bb4b6a61d8bb011` e, antes desta atualização documental, já havia integrado os hardeners e o release gate até `41fa0d388818552ab551af619eb8674704b45818`.

### Pins obrigatórios preservados

| Módulo | Pin |
|---|---|
| Passageiro | `7b047f75a1a919a5336c0df6e0d60b14b02f2618` |
| Motorista/Admin | `9fc171050d8b5703540c49d19a8f1e9f5162775f` |
| Entregas | `0a1e0b294f75c97bce903200b57e7a6b482f381a` |

Os submódulos protegidos não são editados diretamente. Correções de integração são aplicadas em `.work` e por forward migrations versionadas no integrador.

## Contratos críticos preservados

### Corridas

- AUTH USER ID, DOMAIN USER ID e DRIVER RECORD ID são tratados como identidades distintas.
- Passageiro é resolvido por `public.users.auth_user_id`.
- Google OAuth usa PKCE, dedupe de callback, `browserFinished` e launch URL.
- `request-ride` na branch possui rollback de falha de dispatch e `cancellation_reason`.
- `driver-ride-action` não aceita preço final arbitrário do cliente.
- cancelamento resolve AUTH → DOMAIN antes de ownership/escrita.
- cancellation fee tem proteção idempotente forward-only.
- driver wallet usa ownership AUTH → DOMAIN → DRIVER.
- lifecycle verifier permanece versionado.

### Entregas

- Checkout release é direto, sem gateway eletrônico ativo.
- `cash/pending` permanece operacional sem falsificar `paid`.
- Merchant opera somente seu `merchant_id` por membership backend.
- Repasse do entregador usa `merchant_manual`.
- Customer bundle auditor, fixture e forward migrations permanecem versionados.

### Motorista

- Provider boundary remove gateways não homologados do runtime de release.
- Mensalidade não oferece CTA eletrônico impossível de regularizar.
- Release surface auditor verifica árvore executável/bundle, não apenas arquivos históricos.
- Finance/state hardening permanece versionado.

## Integração dos hardeners nesta rodada

### Document boundary

`harden-motorista-document-boundary.mjs` foi conectado ao build isolado Motorista e ao pipeline Partner, antes do provider/finance boundary. Ele alinha a UI ao limite real de 10 MiB e mantém slot/MIME/client RPC sob verificação estática.

### Eligibility sem gateway

`harden-corridas-driver-eligibility-no-gateway.mjs` foi conectado imediatamente depois de `harden-corridas-backend-identity-boundary.mjs` na ordem real do build Corridas. Assim ele opera sobre o código já normalizado e remove somente o gate de assinatura eletrônica, preservando aprovação, online, GPS, categoria e preferências.

### Release gate

`verify-superapp-release-requirements.mjs` agora exige cinco forward migrations:

Corridas:

- `20260905070000_fix_passenger_identity_rls.sql`
- `20260905131500_harden_driver_wallet_and_cancellation_idempotency.sql`
- `20260905143000_harden_driver_document_ownership.sql`

Entregas:

- `20260905113000_allow_direct_cash_order_operations.sql`
- `20260905114500_enable_merchant_manual_courier_mode.sql`

Nenhuma migration foi aplicada em produção.

## P1 — Motorista documents / MIME + slot

O backend real já possuía AUTH → DOMAIN → DRIVER, buckets privados, path iniciado por `auth.uid()`, ownership e limite de 10 MiB. Porém `vehicle-documents` admite PDF porque CRLV pode ser PDF; sem validação de slot específica, um PDF válido no bucket poderia ser referenciado como `vehicle_photo`.

A forward migration `20260905143000_harden_driver_document_ownership.sql` fecha esse bypass com:

- slots explícitos `selfie`, `cnh_front`, `cnh_back`, `crlv`, `vehicle_photo`;
- bucket derivado do slot;
- path `auth.uid()/arquivo` sem escape/nesting arbitrário;
- filename ligado ao slot;
- MIME + extensão compatíveis;
- `selfie`/`vehicle_photo` somente imagem;
- `cnh_*`/`crlv` imagem ou PDF;
- buckets privados e limite de 10 MiB;
- leitura própria ou reviewer autorizado;
- bloqueio de update/delete de evidência já referenciada;
- RPC público somente para `authenticated`/`service_role` e implementação privada sem grant a cliente comum.

Status: **CODE FIXED / MIGRATION NOT APPLIED / E2E NOT EXECUTED**.

### Compatibilidade histórica

A migration não apaga nem reescreve URLs históricas já gravadas em `drivers`. As novas regras de MIME/filename são aplicadas quando `driver_update_document` recebe uma substituição. Objetos antigos continuam legíveis conforme policies de ownership/reviewer; não há migração destrutiva de evidências existentes.

## P1 — Eligibility sem mensalidade eletrônica

O matching não pode exigir uma assinatura eletrônica ativa quando não existe provider homologado disponível para o motorista regularizar a mensalidade. O hardener remove a consulta/gate de `subscriptions` do matching enquanto gateways estão desativados, sem remover:

- `approval_status = aprovado`;
- `is_online`;
- GPS válido e fresco;
- categoria compatível;
- exclusão de motoristas rejeitados/ocupados;
- raio/preferências;
- preferência por meio direto.

A normalização anterior continua responsável por manter `subscriptions.driver_id = DRIVER RECORD ID` nos trechos históricos que ainda usam a relação. O hardener de eligibility não volta a misturar AUTH/DOMAIN/DRIVER.

Status: **CODE FIXED / BUILD VALIDATION PENDING / RUNTIME UPDATE MAY BE REQUIRED**.

## Drift branch × runtime

O fato mais importante permanece: branch corrigida não significa backend implantado atualizado.

| Componente | Branch | Runtime observado | Drift | Ação de release |
|---|---|---|---|---|
| `request-ride` | rollback de dispatch + identity + eligibility hardening | função implantada ainda engole exceção de dispatch e contém gate de subscription antigo | SIM | deploy backend controlado antes da publicação final |
| `driver-ride-action` | AUTH→DOMAIN→DRIVER + preço persistido | revisar versão implantada contra markers da branch | A CONFIRMAR | comparação/deploy controlado se divergir |
| `cancel-ride` | AUTH→DOMAIN + cancel policy corrigida | runtime deve ser comparado antes de release | A CONFIRMAR | gate de drift |
| `send-ride-push` | normalização de recipients AUTH/DOMAIN | runtime deve ser comparado antes de release | A CONFIRMAR | gate de drift |
| `create-order` | boundary direto/cash aplicado em `.work` | Edge implantada pinada ainda aceita contrato antigo até deploy correspondente | SIM/PRODUTO | não publicar frontend incompatível |
| Merchant operations | cash/pending + membership no integrador | runtime precisa suportar forward migrations | A CONFIRMAR | migrations + deploy controlado |
| `driver_update_document` / storage | migration 14:30 versiona contrato endurecido | runtime atual possui versão anterior sem MIME/slot estrito | SIM | aplicar migration controladamente antes de release |

`request-ride` deve permanecer **CODE FIXED / RUNTIME OLD** até atualização controlada do backend.

## Authorization / service_role

`docs/BACKEND_AUTHORIZATION_MATRIX.md` e `scripts/verify-backend-authorization-boundaries.mjs` são gates obrigatórios. A rodada atual precisa corrigir premissas obsoletas do verifier e completar a classificação das Edge Functions ACTIVE dos dois projetos.

Nenhum PASS estático será promovido a E2E PASS sem testes A×B/RLS.

## Baseline Corridas / clean-room

O source pinado original permanece historicamente inválido por vírgula ausente após `rejected_driver_ids UUID[]`. O reparo permitido ocorre apenas na cópia `.work` por `prepare-corridas-clean-room.mjs`.

Portanto:

- ORIGINAL PINNED MIGRATION = **INVALID**;
- HISTORICAL REPAIR IN `.work` = **DOCUMENTED**;
- CLEAN-ROOM DATABASE PASS = **NOT EXECUTED**.

## Android

APK/AAB não foram gerados nesta rodada. OAuth real, Maps real, FCM, GPS/background, deep links, resume e comportamento WebView continuam exigindo build Android/dispositivo apropriado. A revisão estática deve ser diferenciada de validação física.

## Níveis de evidência

Sempre registrar separadamente:

1. **CODE FIXED** — correção presente na branch.
2. **BUILD VALIDATED** — comando/build correspondente passou.
3. **RUNTIME DEPLOYED** — backend/migration realmente implantado no ambiente alvo.
4. **E2E VALIDATED** — jornada/teste A×B/dispositivo executado.

Um nível nunca implica automaticamente o seguinte.

## Release blockers atuais

- authorization verifier ainda precisa ser atualizado e executado;
- service_role/legacy deployed inventory precisa ser fechado;
- drift branch/runtime precisa ser explicitamente bloqueado no release;
- Motorista/Partner/Corridas builds precisam ser executados quando o source estiver materializável;
- migration de documents não aplicada;
- clean-room não executado;
- RLS/IDOR A×B não executado;
- Android APK/AAB/E2E não executados.

**STATUS GLOBAL: NOT READY.**
