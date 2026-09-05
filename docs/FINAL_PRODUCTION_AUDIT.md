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

## Execução local complementar — 2026-09-05

Esta seção substitui os estados `NOT EXECUTED` acima quando há evidência local mais recente. Baseline desta execução: branch `homologacao-apois-cliente`, HEAD inicial `70a836879c7b8649ec16b364c3906c9796428300`, pins Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`, Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f` e Entregas `0a1e0b294f75c97bce903200b57e7a6b482f381a`.

| ID | Severidade | App / funcionalidade | Sintoma / causa raiz | Correção / arquivos | Teste e exit code | Resultado | Status |
|---|---|---|---|---|---|---|---|
| AUD-LOCAL-01 | P0 | Corridas / Supabase source of truth | Sanitizer existia, mas não era etapa obrigatória da cadeia; snapshot histórico `backend-standalone` com ref legado entrava em `.work`. | Sanitizer conectado em `build-isolated-module.mjs`; snapshot histórico excluído por `prepare-workspace.mjs`; gate distingue documentação de runtime. | `verify:corridas-supabase-source` = 0; URL canônica strict = 0; URL legada strict = 1. | Runtime de release local usa somente `vqtucstyduxrqjgyigfk`. | CORRIGIDO E VALIDADO |
| AUD-LOCAL-02 | P0 | Corridas / cancel-ride | O pin contém string TypeScript não terminada na mensagem da taxa. | Reparo somente na cópia isolada em `harden-corridas-cancellation-policy.mjs`; pin preservado. | ESLint da função: parser error removido; `verify:corridas-lifecycle` = 0. | Função gerada é analisável; dívida `no-explicit-any` permanece. | CORRIGIDO E VALIDADO |
| AUD-LOCAL-03 | P0 | Motorista / Google OAuth | Componente gerado importava `PluginListenerHandle` do pacote errado para Capacitor 8. | Import do tipo corrigido no gerador `harden-motorista-auth.mjs`. | `bun run typecheck` em `.work/motorista` = 0 após correção. | Compilação do callback Google validada; OAuth físico depende de configuração externa. | CORRIGIDO — DEPENDE VALIDAÇÃO EXTERNA |
| AUD-LOCAL-04 | P1 | Motorista / documentos | Gate esperava chaves quoted, enquanto o objeto TypeScript usa propriedades normais. | Verificador alinhado ao contrato real de buckets/slots; 10 MiB, MIME, filename, ownership e reviewer permanecem exigidos. | `verify:backend-auth` = 0; pipeline Partner atravessa o boundary = 0 nessa etapa. | Contrato estático coerente; banco descartável não disponível. | CORRIGIDO — DEPENDE VALIDAÇÃO EXTERNA |
| AUD-LOCAL-05 | P0 | Partner / CI financeiro | Codemagic exigia presença de CTA/endpoint Mercado Pago, contradizendo o pipeline que os proíbe; launcher ainda importava hardener aposentado. | CI passou a falhar se os marcadores aparecerem; import aposentado removido; auditorias apontam para `build-partner-release.sh`. | `npm run audit:partner` = 0. | Provider aposentado permanece fail-closed no source de release. | CORRIGIDO E VALIDADO |
| AUD-LOCAL-06 | P1 | Entregas / pagamento direto | Verificadores ainda exigiam linguagem PIX apesar do checkout cash/direct atual. | Gates de dist/policy/security atualizados para exigir cash/pending sem confirmação eletrônica e proibir gateways. | `npm run verify:dist` = 0; `verify:entregas-direct-order` = 0; testes Entregas 43/43 = 0. | Customer e merchant mantêm pagamento direto sem fabricar `paid`. | CORRIGIDO E VALIDADO |
| AUD-LOCAL-07 | P1 | Motorista / financeiro | Hardener removia provider da navegação, mas deixava código morto de saque causar nullability no TypeScript. | Narrowing explícito no handler e asserção limitada ao ramo visual morto em `harden-partner-motorista-direct-earnings.mjs`. | `npm run build:motorista` = 0, incluindo typecheck, bundle e release-surface audit. | Bundle isolado sem OpenPix, PagBank, Mercado Pago, Asaas ou saque custodial. | CORRIGIDO E VALIDADO |
| AUD-LOCAL-08 | P1 | Android Cliente | Rodada anterior não possuía artefato local. | Capacitor add/sync, hardening API 36 e build Gradle debug executados. | `bunx cap sync android` = 0; `gradlew.bat assembleDebug --no-daemon --stacktrace` = 0. | APK debug local de 20.178.610 bytes; não é release assinado. | CORRIGIDO — DEPENDE VALIDAÇÃO EXTERNA |
| AUD-LOCAL-09 | P0 | Runtime providers | Source possui 48 stubs 410, mas runtimes remotos continuam antigos/expostos. | Gate não foi enfraquecido; nenhum deploy foi feito. | `verify-retired-provider-source` = 0; `verify:legacy-provider-runtime` = 1 com 47 blockers. | Branch protegida, runtime ainda divergente. | BLOQUEADO POR CONFIGURAÇÃO EXTERNA |
| AUD-LOCAL-10 | P1 | Migrations / RLS A×B | Docker, PostgreSQL, Supabase CLI, Deno e Python não estão disponíveis localmente. | Nenhuma produção foi usada como substituto. | Clean-room e E2E DB não executáveis neste ambiente. | Evidência estática existe; execução transacional/RLS ainda necessária. | BLOQUEADO POR CONFIGURAÇÃO EXTERNA |

### Evidência consolidada

- Gates estáticos finais com EXIT CODE 0: `verify:backend-auth`, `audit:static`, `audit:hardening`, `audit:ui`, `audit:partner`, `audit:play-store`, `verify:pins`, `verify:partner-portability`, `verify:finance-policy`, `verify:release-requirements`, `verify:corridas-auth`, `verify:corridas-supabase-source`, `verify:corridas-lifecycle`, `verify:corridas-db-ownership`, `verify:corridas-driver-eligibility`, `verify:entregas-direct-order` e `verify-retired-provider-source`.
- Builds com EXIT CODE 0: Corridas integrado, Entregas integrado, Shell/Superapp, painel Merchant (fora do sandbox após `EPERM readlink`), dist verification e Android debug.
- Lint normalizado: Corridas 117 errors/27 warnings antes do reparo de parser; Entregas 2208 errors/349 warnings, sendo 2207 `prettier/prettier`, 340 warnings `no-explicit-any`, 9 `react-refresh/only-export-components` e 1 `no-empty`. Não foi executado formatter global.
- Partner release: chega ao gate obrigatório de Maps e falha fechado sem `CORRIDAS_WEB_MAPS_API_KEY` (EXIT CODE 1).
- Firebase/FCM, Maps reais, Google OAuth físico, assinatura release, ADB/device e migrations/RLS em banco descartável continuam externos.

**STATUS GLOBAL APÓS EXECUÇÃO LOCAL: NOT READY — RUNTIME UPDATE REQUIRED, CONFIGURAÇÃO EXTERNA E CLEAN-ROOM/RLS E2E PENDENTES.**
