# APOIS — Homologação em dinheiro, sem Safe2Pay (03/11/2026)

**Decisão comercial do responsável:** Safe2Pay é o provedor eletrônico escolhido, mas o contrato/conta exige regularização antes de utilizá-lo. A homologação agora será **exclusivamente por pagamento em dinheiro direto**, sem Pix real ou simulado pela Safe2Pay, sem cartão via gateway, sem split eletrônico e sem disparar webhooks financeiros. A decisão NÃO aposenta nem substitui a Safe2Pay.

## Proteções absolutas

- Usar somente a branch `fix/entregas-homologacao-ajustes-20261030` de `apoistecnologia-gif/apois-superapp` até os testes serem aprovados.
- Os submódulos em `sources/` e o `source-lock` ficam pinados; alterações de homologação acontecem nas cópias de integração e hardeners da branch.
- Não rodar pagamentos reais, Pix, cartão, split, repasses bancários, manipulações de saldo, assinatura fictícia, cadastro/ordens/corridas de teste em produção ou migrações sem revisão e E2E isolado.
- Não promover Vercel Preview para produção, não alterar autenticação/RLS para dar acesso público, não desativar SSO e não gerar APK como "homologado" só porque o CI WEB passou.
- A opção dinheiro representa pagamento fora da APOIS. Em **Entregas**, um pedido `cash` mantém `payment_status=pending` porque a APOIS não verifica o dinheiro físico. Em **Corridas**, a solicitação começa `pending`, mas o gatilho de conclusão atual registra `payment_status=paid` como quitação operacional presumida ao encerrar a viagem, sem confirmação externa. Isso NÃO representa Pix/cartão nem saldo de carteira: `payment_provider=null`, `wallet_amount=0`, `platform_fee=0`. Confirmar o recebimento físico é parte do teste.
- Os motoristas recebem o valor integral da corrida diretamente. O estabelecimento responde pelos recebimentos dos pedidos e pelo repasse manual acordado com o entregador.

## Estado técnico verificado no banco real, somente leitura — 03/11/2026

### Corridas — Supabase `tbbzkrfupmqdywnzgnms`

- `app_settings.finance.ride_electronic_payments_enabled = false`: **PASS**.
- `apois_rpc_private.driver_accept_ride` possui boundary de método: **PASS estrutural**, não substitui E2E.
- `apois_rpc_private.driver_set_presence` verifica KYC: **PASS**, não fazer bypass.
- **P0/BLOCK:** quatro funções ainda mencionam `private.driver_subscription_allows_rides(v_driver.subscription_status)`, o gate legado de cobrança: `apois_rpc_private.driver_set_presence`, `driver_accept_ride_candidate_legacy`, `driver_finish_ride` e `private.enforce_driver_operational_stage_transition`. Podem interferir em online, aceite de oferta, estágio e fila de próxima corrida.
- A correção SQL pré-existente na branch é `supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql`. **Não aplicar em produção automaticamente**: testar assinatura, chamadores, KYC/ownership e corrida em PostgreSQL isolado antes.
- O gatilho real `public.handle_completed_ride_settlement()` foi examinado: ao finalizar uma corrida `cash`, registra `wallet_amount=0`, `platform_fee=0`, `payment_provider=NULL` e `payment_status=paid` como quitação física presumida. Não existe confirmação bancária. A forma de conferir recebimento e lidar com contestação deve ser testada antes da liberação.
- Run apenas-leitura: `database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql` — 4 gates legados `false`; validação de não-creditamento cash na carteira e sinalização informativa da quitação automática.

### Entregas — Supabase `ptgkwyyolrdgnqketkjj`

- `create_order_atomic` suporta `cash` e inicia `payment_status='pending'`: **PASS**.
- `platform_settings.courier_payout_mode='merchant_manual'`: **PASS**. `get_delivery_checkout_readiness()` reconhece `merchant_manual`: **PASS**.
- **P0/BLOCK:** ainda não há as políticas genéricas previstas de leitura pelo membro do estabelecimento para `orders`, `order_items` e `order_status_history` de pedidos `cash/pending` (3 gates `false`). Em seu lugar existem políticas antigas "paid" e políticas específicas **APOIS test cash** usando `private.apois_test_cash_orders`; as exceções de QA não comprovam que todos os estabelecimentos podem operar com dinheiro.
- **P0/BLOCK:** `public.merchant_reject_order(uuid,text)` ainda restringe cancelamento comum a pedidos `paid/refunded`; não libera rejeição de pedido `cash/pending` para membro do estabelecimento (1 gate `false`). Não transformar `cash` em `paid` para contornar.
- A migração já versionada é `supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql`. **Não aplicar na produção antes do E2E isolado e revisão de RLS, permissões de membros, pedidos pagos/refund e reversão**.
- Configuração futura `order_payment_provider='safe2pay_marketplace'` permanece armazenada no banco: **não significa que cash precise chamar o provedor**. O checkout de integração só permite `cash`.
- Run da auditoria apenas-leitura: `database/review/20261103_entregas_cash_homologacao_READ_ONLY.sql` — 4 gates críticos `false`, 3 `true`, 1 informativo.

## Diferença crítica entre o código homologado e a Edge Function já implantada

**Comprovado por leitura da Edge Function ativa (03/11/2026):** a `create-order` do Supabase Entregas está na **versão 13 ACTIVE** e usa `PAYMENT_METHODS = new Set(["pix", "cash"])`. O dinheiro **não** está habilitado para todos os estabelecimentos: existe uma validação exclusiva `apois_check_test_cash_access(_merchant_id, _customer_id)`, sem a qual retorna `403 TEST_CASH_NOT_AUTHORIZED`. Para cash, responde `paymentMode="homologacao_sem_dinheiro"`. A consulta agregada somente de leitura encontrou **1 par cliente/loja de QA autorizado e 4 pedidos de teste já registrados**, sem consultar identidades ou modificar registros.

**Atenção:** a `supabase/functions/create-order/index.ts` deste repositório é a **cópia de integração na branch QA** (cash-only, valida estritamente pending). **NÃO é a Edge Function v13 em execução.** Os 23 testes com mocks abaixo validam a cópia em GitHub, não o cadastro real nem a rota autenticada já implantada. Portanto, não afirmar disponibilidade geral de pagamento em dinheiro em Entregas antes de aplicar e homologar as regras corretas, sempre em ambiente controlado.

**Comprovado por leitura da Edge Function ativa Corridas:** `request-ride` está na **versão 18 ACTIVE**, com métodos `cash`, `credit` e `pix`. O Pix depende de `app_settings.finance.ride_electronic_payments_enabled`, atualmente `false`. Corridas em dinheiro começam `pending`, sem provedor; seguem bloqueadas operacionalmente pela dependência de assinatura antiga das funções PostgreSQL listadas acima.

## Alterações de código e testes sem transações

- `supabase/functions/create-order/index.ts`: agora só aceita como resultado autoritativo de criação `payment_method='cash'` **e** `payment_status='pending'`. Estados `paid`, `failed`, `cancelled`, `refunded` e `processing` são inconsistências, nunca um sucesso de criação.
- `scripts/verify-entregas-direct-order-contract.mjs`: protege o novo contrato estrito.
- `scripts/test-entregas-cash-create-order-isolated-v1.mjs`: executa o **handler TypeScript real** com `vm` e cliente Supabase fictício, sem rede, sem credencial real, sem enviar cobranças. Casos: cash/pending, checkout entrega/retirada, dados autorizados do usuário, endereço salvo, Pix/cartão/carteira bloqueados, autenticação, itens, estados inesperados e erros.
- `scripts/audit-payment-boundary.mjs`: liga os testes acima ao CI WEB-only existente. Safe2Pay permanece com testes de regressão 100% simulados, sem interação externa.
- Os hardeners de Cliente Corridas já expõem recebimento direto `cash` e `credit`; para o teste físico escolher **somente dinheiro**, não alterar a capacidade futura de cartão direto.
- O Admin segue atrás de Vercel SSO. Visual da tela de login aprovado, mas E2E autenticado e serviço privado de documentos continuam pendentes; não inserir segredo `service_role` em frontend.

## Ordem da homologação CASH controlada (obrigatória)

**Etapa 1 — Bancos isolados (sem dados reais):** revisar e aplicar em staging separado as duas migrações listadas, preservando KYC/ACL. Testar via papéis de usuário realistas: cliente, estabelecimento, entregador, motorista aprovado, motorista não aprovado e admin. Confirmar que não existe alteração de saldos, `payments` ou reembolso automático.
**Etapa 2 — Cliente Entregas + Estabelecimento:** checkout somente em dinheiro; pedido `cash/pending`; lista, itens e histórico visíveis para o estabelecimento correto; outro estabelecimento não enxerga; aceitação/preparo/cancelamento sem reembolso de gateway; idempotência de reenvio.
**Etapa 3 — Entregador:** restaurante solicita entregador; distribuição/notificação e aceite, localização, entrega e conclusão; estabelecimento marca repasse manual e entregador confirma; uma confirmação não duplica saldo.
**Etapa 4 — Passageiro + Motorista:** selecionar dinheiro; valor calculado no backend; busca/aceite, PIN, rota até embarque e destino, voz, chegada e finalização; pagamento físico ao motorista e recibo **não eletrônico**; testar fila de próxima corrida sem assinatura antiga.
**Etapa 5 — negativos/segurança:** cancelamento, multa e bloqueio por dívida quando previsto, notificações, histórico, offline/reconexão, reabertura de app, acesso cruzado entre usuários, validações de 13 fotos e área de atuação.
**Etapa 6 — APKs de TESTE:** build Android de homologação assinado em ambiente QA, sem declaração de release; instalação em dispositivos reais, teste de login/Google/OTP, câmera, GPS/Google Maps, push e recuperação de sessão. Stage2 de 13 fotos somente depois de validar fluxo de upload/aprovação, conforme política anterior.

### Requisitos adicionais do motorista já fornecidos pelo proprietário

A lista `OQUE PRECISA TER NO APP DO MOTORISTA.pdf` solicita, entre outros: multas de cancelamento visíveis na carteira e bloqueio de novas corridas por dívida; botão voltar em menus e no Android; foto do motorista; PIN; rotas e voz até embarque/destino com possibilidade de desativar; oferta com dados e avaliação do passageiro, distância até embarque e destino, valor e KM; corrida sobre o mapa; próximo pedido próximo ao destino da viagem ativa; rating e carteira. **Não afirmar E2E aprovada com base em checagens WEB estáticas.**

## Decisões e dependências que ainda exigem alinhamento

- Em Entregas com **delivery em dinheiro**, definir quem recebe fisicamente do consumidor (entregador versus estabelecimento), como comprova e como acerta esse valor. Isso é diferente do repasse manual do estabelecimento ao entregador. Não pressupor que o entregador sempre recolha dinheiro.
- Mensalidade de motorista/estabelecimento: teste de uso do aplicativo não equivale a pagamento de mensalidade. Não ativar assinaturas fictícias nem marcar `paid` apenas para abrir a tela; usar contas e políticas de QA autorizadas.
- Sem regularização Safe2Pay, todo pagamento eletrônico integrado, split, webhooks de produção, estorno e conciliação continuam fora do escopo. Eles voltam a ser avaliados posteriormente.
- Admin Corridas Preview: documento privado tem fail-closed por ausência de `CORRIDAS_SUPABASE_SERVICE_ROLE_KEY`, exigindo solução isolada e autorizada; backend de fotos não foi validado em conta real.
- Testes remotos protegidos Vercel 403 exigem autorização da conexão, não desativação de SSO.
- Maps/GPS, push, upload da vistoria de 13 fotos, segurança real Auth e liberação Android ainda dependem de execução física/ambiente de staging.

**Evidência de testes:** GitHub Actions [41725146466](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41725146466) — **3/3 jobs WEB aprovados**, com **23 casos cash** executando a cópia do handler em memória. Nenhuma operação financeira real. O lint global do legado Entregas registra milhares de ocorrências e é tratado como warning pela esteira; o CI verde não significa lint global corrigido.

**Status geral:** a homologação cash continua **BLOQUEADA pelos oito gates PostgreSQL** (quatro Corridas, quatro Entregas). O cash já implantado Entregas é uma exceção restrita a contas de QA, não o fluxo geral. Não anunciar pronto para produção nem emitir APK final.

---

## Execução complementar — 03/11/2026, PostgreSQL descartável e gates WEB

**Último commit de código/testes validado:** `1c33e3b79c8a988f19e90fad9439e500f7f98a4e`.
**CI WEB final (3/3 SUCCESS):** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41733670288

### Correções efetivas e evidência

1. `6001e255f0fcd5bf5a66f57813bce0546821e675`: a cópia QA da Edge `create-order` não aceita como checkout recém-criado pedidos cash em estado terminal `cancelled`, `refunded` ou `delivered`, mesmo se `payment_status=pending`. Os testes isolados passaram de 23 para **27 verificações**; **não há Edge implantada por esse commit**.
2. `fec07a5291d22cb64191ce0f5fc042d4c753656c`: a migração ainda não aplicada `20260905113000_allow_direct_cash_order_operations.sql` passou a **bloquear, antes de mutações**, o cancelamento cash com estado financeiro diferente de pending ou com qualquer registro em `public.payments`; requer conciliação manual em vez de gerar refund eletrônico. Contrato protegido por `scripts/verify-entregas-direct-order-contract.mjs`. CI 41732619460 **3/3 sucesso**.
3. `f59d4c9eb6869087fcf7af2f943aa8b7461a0694`, `4610099fdb590f0b2a9a202400938917eb3647f6`: teste real no PostgreSQL **17.6 isolado, em contêiner descartável sem rede/portas expostas**, integrado como passo ao workflow WEB preexistente (nenhum workflow novo). O primeiro teste enfrentou corrida de inicialização do próprio contêiner, corrigida após aguardar término do init e confirmar `SELECT 1` no servidor definitivo. Evidência de sucesso 41733254793.
4. `1c33e3b79c8a988f19e90fad9439e500f7f98a4e`: adicionado segundo banco SQL descartável para executar a **proposta original de proteção** `driver_complete_registration_v3` (arquivo REVIEW_ONLY, sem aplicação no Supabase). O log de 41733670288 registrou `[PASS] Registration blocked for aprovado`, `suspenso` e `bloqueado`, e `[PASS] Real PostgreSQL synthetic driver registration guard: 6 status cases, no downgrade`.

Os testes PostgreSQL confirmaram, **em esquema sintético mínimo**, a leitura dos pedidos cash/pending, itens e histórico apenas pelo estabelecimento correto, o cancelamento cash sem reembolso fictício, o bloqueio de pedido cash vinculado a pagamento eletrônico, a ausência de mutação de oferta/job em caso de falha e a preservação do cancelamento eletrônico pago legado. Testes de driver cobriram novo, reprovado, pendente, aprovado, suspenso e bloqueado, preservando os últimos três. **Não são E2E no esquema integral Supabase, nem simulam todos os triggers, Auth real, Storage, concorrência, Android ou GPS.**

### Reconfirmações sem mutação

- Supabase Corridas `tbbzkrfupmqdywnzgnms`: 4 gates antigos de assinatura do motorista continuam faltando na produção.
- Supabase Entregas `ptgkwyyolrdgnqketkjj`: 3 políticas gerais de leitura cash/pending do estabelecimento e 1 contrato de cancelamento continuam faltando na produção.
- Contagem agregada (read-only): **zero** pedidos cash/pending com registro associado em `public.payments` no momento da consulta.
- Ambos os projetos Supabase conectados são **produção** e não têm dev branches; não rodamos DDL nem testes mutáveis nesses bancos.
- Vercel `apois-corridas-admin-homologacao` foi consultada **sem filtro de teamId**: projeto acessível, SSO `enabled=true`, Preview mais recente do commit `1c33e3b` em `READY`. Variáveis de Preview inspecionadas **somente por nomes e alvos, sem decrypt**; `CORRIDAS_SUPABASE_SERVICE_ROLE_KEY` permanece ausente. `READY` não é E2E autenticado do Admin nem libera documentos privados.

**Release/APK:** continua **NÃO LIBERADO**. Antes de tocar a produção é preciso staging compatível com o esquema completo (KYC, RLS, triggers, permissões, funções chamadoras e reversão), homologação real dos pedidos/corridas em dinheiro, vistoria de 13 fotos, Admin privado, Android físico/GPS/push. Safe2Pay permanece provedora escolhida, mas desativada durante os testes cash, sem pagamentos bancários.

**Preservação:** nenhuma migração/Edge foi implantada, nenhum saldo, pedido, aprovação ou pagamento real foi alterado; nenhum merge, publicação Android ou Vercel Production; `sources/`, submódulos e source-lock continuam intactos.
