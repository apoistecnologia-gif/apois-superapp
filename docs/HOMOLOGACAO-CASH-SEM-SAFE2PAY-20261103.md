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

---

## Homologação SQL reforçada — associação real e integridade de contratos (03/11/2026)

**Escopo:** branch `fix/entregas-homologacao-ajustes-20261030` do único repositório autorizado. Nenhuma implantação de migrações ou Edge Functions, nenhum pagamento, saldo, motorista, pedido ou dado Auth de produção modificado.

### 1. Entregas — autorização com semântica aproximada das funções reais

**Commit `f12dacd6460b74bc309686a36723c87d49d60c52`:**
- Substituiu o teste anterior, que usava a variável arbitrária `apois.qa.merchant_id`, por helpers PostgreSQL baseados no corpo de `pg_get_functiondef` efetivamente consultado no Supabase Entregas: `current_user_is_active`, `has_role`, `current_user_is_admin` e `current_user_is_merchant_member`.
- Exercitou oito identidades: proprietário A, proprietário B, funcionário autorizado, funcionário suspenso, vínculo removido, perfil desativado, administrador e terceiro sem vínculo. Conferiu RLS de `orders`, `order_items` e `order_status_history`.
- Verificou cinco tentativas de cancelamento com identidade indevida, além de privilégios `EXECUTE` da função `SECURITY DEFINER` para `anon` e `authenticated`.
- **Limite:** dados, perfis e memberships são sintéticos; as funções foram reconstruídas conforme leitura de produção, não exportadas do PostgreSQL oficial como um clone completo. A assinatura criptográfica de JWT, os outros triggers e as demais RLS não foram exercitados.

### 2. Corridas — SQL real de presença e mudança de etapa

**Commits `98c7d12d20be831937078c8c1f3f105e0c9a55c5` e `0388daffbde5d06f0afc2b07ddee4bc1dbda53e0`:**
- O preflight existente cria um terceiro banco isolado `driver_operations_qa` no mesmo contêiner PostgreSQL 17, **sem rede externa e sem portas publicadas**.
- O extrator `scripts/qa/extract-corridas-operational-sql-v1.mjs` usa o texto **exato da migração versionada**, sem reescrever a lógica: `apois_rpc_private.driver_set_presence` e `private.enforce_driver_operational_stage_transition`.
- A bateria verifica presença online de aprovado com KYC, identidade de domínio do motorista, recusa de suspenso/bloqueado/em análise/KYC incompleto, coordenadas ou velocidade/direção inválidas, saída offline sem GPS, mudança permitida de status da corrida e sete transições impedidas.
- Corrigida no próprio teste a criação duplicada do papel `authenticated`: papéis PostgreSQL são globais ao cluster, apesar de cada fixture usar banco separado.
- **Evidência:** execução [41737894342](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41737894342), **3/3 WEB SUCCESS**. Logs registram `[PASS] Eight isolated JWT role/ownership/RLS states`, `[PASS] Five unauthorized member/tenant cancellation attempts denied`, `[PASS] Approved KYC driver online without legacy subscription` e `[PASS] Approved stage and seven rejected stage transitions`.

### 3. Compatibilidade identificada na função de presença

**Commit `4bd32c46ce18b1203989fe46345674547409267e`:**
- Comparação **read-only da assinatura SQL ativa em produção** de `driver_set_presence(boolean,numeric,numeric,numeric,numeric)` comprovou **quatro argumentos numéricos opcionais com `DEFAULT NULL::numeric`**.
- A migração preparada inicialmente omitira esses defaults; isso poderia quebrar chamadores que omitem localização/velocidade ao ficar offline.
- A migração ainda NÃO APLICADA agora preserva os quatro defaults. A suíte SQL confirma `pg_proc.pronargdefaults=4` e executa `driver_set_presence(false)` com apenas um argumento.
- A função ativa ainda contém o bloqueio de assinatura aposentado; **essa correção foi exclusivamente na migração preparada, sem qualquer mudança na produção**.
- CI do commit: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41738214219 — **3/3 jobs WEB SUCCESS**, confirmado após conclusão, com a guarda de argumentos opcionais e chamada de um único argumento aprovadas no log PostgreSQL.

### Segurança, diferenças e decisão

A comparação dos commits com o último relatório mostra somente mudanças em `scripts/qa/`, `scripts/test-cash-postgres-isolated-v1.sh` e no arquivo de migração de Corridas. Nenhum arquivo `sources/`, `source-lock`, submódulo ou workflow alterado nesta rodada. **Os bancos oficiais continuam com os oito bloqueios cash operacionais já documentados.**

**NÃO LIBERAR APK/PRODUÇÃO:** os testes SQL usam relações e identidades artificiais; falta ambiente de staging reproduzindo o **esquema completo**, inclusive trigger, Auth, Storage, KYC documental, ledger e fluxos autenticados de corrida/entrega. Falta homologar Android físico, GPS, push e PIN; Safe2Pay segue escolhida, mas fora da fase cash. Não executar SQL REVIEW_ONLY/forward em produção sem staging completo e decisão expressa.

---

## Aceitação, conclusão e frescor GPS — SQL isolado (03/11/2026)

**Alvo exclusivo:** branch `fix/entregas-homologacao-ajustes-20261030` de `apoistecnologia-gif/apois-superapp`. Todos os commits abaixo estão somente na branch de homologação. Nenhuma Edge Function, migração ou APK implantado; produção sem modificações.

### Segurança cash-only: Safe2Pay no aceite de corridas

- **Correção no commit `0209cf771b5e42227c9b05bb9121ea3291ef297c`** em `supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql`: `driver_accept_ride` e `driver_accept_ride_candidate_legacy` agora rejeitam `payment_flow` com prefixo `safe2pay` (comparação normalizada por `lower(btrim(...))`), além dos marcadores já bloqueados `mercadopago_marketplace`, `asaas`, `pagbank` e `openpix`. Corridas `cash` com `direct_to_driver` permanecem válidas; não foi removida a capacidade histórica de crédito direto para futura reativação autorizada.
- `scripts/qa/ride-acceptance-fixture-v1.sql`, `scripts/qa/extract-corridas-acceptance-sql-v1.mjs`, `scripts/qa/ride-acceptance-assertions-v1.sql`: quarto banco PostgreSQL 17 isolado, extraindo e executando os **dois corpos SQL reais propostos** da migração, com dados sintéticos, ofertas expiradas e rejeitadas, métodos inválidos, provedor aposentado, KYC, suspensão, bloqueio, aceite cash e motorista ocupado.
- Commits `a651e2193837593488907bb543056a55eb35b1fa` e `dd66a5eb756973e806036e9be5e8cb55e214799a`: exclusivamente correções dos próprios testes (metacomando psql e leitura do estado persistido como proprietário da fixture). Erros intermediários não foram apagados do histórico; o commit `dd66a5e` passou **3/3 jobs WEB** no [CI 41739929611](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41739929611).

### Finalização e liberação de próxima corrida

- **Commit `a48328e02fb6a1a69d10ee9a921b234310f97db2`**: quinto banco PostgreSQL 17 descartável, executando diretamente a função versionada `driver_finish_ride` e o trigger versionado `enforce_driver_operational_stage_transition`.
- Testes verificam recusa ao finalizar corrida de outro motorista, bloqueio a finalizar duas vezes, promoção de próxima corrida para motorista elegível online com KYC/GPS recentes, liberação da próxima corrida quando o motorista tem KYC pendente, foi suspenso ou tem GPS antigo/está offline, limpeza de associação/PIN/ofertas e registros de auditoria. São **cenários sintéticos**, não comprovam trigger real de settlement ou pagamento físico.
- [GitHub Actions 41740238583](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41740238583): **3/3 jobs WEB SUCCESS**.

### Restrição de frescor GPS na aceitação

- **Commit `7659e04f6cf0cf31b2b0d4dedfcadab8a7c71200`**: reforço exclusivo na *migração ainda não aplicada* de `driver_accept_ride_candidate_legacy`, exigindo coordenadas válidas dentro dos limites já presentes no projeto e `last_location_at` entre 120 segundos antes e 30 segundos depois de `now()`. A validação entra depois de aprovação, bloqueio/suspensão, presença online e KYC. Mensagem controlada `driver_location_stale`, SQLSTATE 42501.
- Os testes do quarto banco PostgreSQL foram estendidos com quatro motoristas sintéticos online e aprovados mas com GPS ausente, antigo, fora da faixa ou com timestamp futuro. O caso válido passa com localização atualizada. Não mudamos a função real em produção.
- [GitHub Actions 41740590888](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41740590888): **3/3 jobs WEB SUCCESS**, com aprovação do PostgreSQL 17 descartável, build WEB e renderização anônima. Logs confirmam os quatro casos de GPS inválido, bloqueio Safe2Pay em ambas as funções, aceite cash válido, transições de fila, prevenção de dupla finalização e rastreabilidade em audit_logs.

### Limites, proteção de fontes e release

- Comparação com HEAD anterior `101ebbc1f85bef6760b4dbbdcdd69568e2b34f3b`: alterações apenas em scripts/qa, execução de SQL QA e migração Corridas. **Nenhum arquivo `sources/`, source-lock, workflow, configuração do Supabase ou secret alterado.**
- Os ambientes Supabase conectados são **somente produção**; não há staging com o esquema completo. A migração de Corridas segue **não aplicada**; os quatro gates de assinatura legada e os quatro gates cash/RLS Entregas da produção continuam como bloqueios de liberação até implantação autorizada e revalidação em isolamento.
- Testes SQL reais contra tabelas artificiais **não validam** esquema completo, autenticação/JWT real, concorrência/locks entre sessões, settlement verdadeiro, Maps/GPS em dispositivo físico, push, PIN ou vistoria de 13 fotos.
- **NÃO EMITIR APK FINAL NEM PROMOVER PRODUÇÃO**. Safe2Pay permanece escolhida para fase futura, mas está eletronicamente desativada nesta homologação em dinheiro.


### Gates de produção reconfirmados após os testes

Consulta **somente de leitura** aos projetos oficiais, após CI 41740590888:
- Corridas `tbbzkrfupmqdywnzgnms`: as quatro funções de presença, aceite legado, conclusão e transição de etapa continuam com dependência legada `driver_subscription_allows_rides` no banco real; **4/4 bloqueios permanecem**.
- Entregas `ptgkwyyolrdgnqketkjj`: as três políticas operacionais de leitura (`orders`, `order_items`, `order_status_history`) e a liberação de `merchant_reject_order` para `cash/pending` continuam ausentes; **4/4 bloqueios permanecem**.

**Decisão de release mantida:** o trabalho está versionado e testado em banco descartável; não é autorização para aplicar em produção, gerar APK final ou declarar homologação completa. Falta cópia isolada do esquema completo, testes em aparelho Android, Auth real e aprovação explícita do caminho de implantação.

---

## Funções públicas autenticadas — gates de permissão (03/11/2026)

**Escopo da rodada:** revisão de segurança das RPCs Corridas e Entregas com acesso somente de leitura aos dois Supabases de produção. As correções permanecem exclusivamente na branch de homologação. Nenhum objeto, usuário, pagamento ou configuração de produção foi alterado.

**Diagnóstico de privilégio no Supabase Corridas oficial:** `apois_rpc_private.driver_set_presence`, `driver_accept_ride`, `driver_accept_ride_candidate_legacy` e `driver_finish_ride` já têm `EXECUTE` **somente por service_role**. As funções públicas homônimas `public.driver_set_presence`, `public.driver_accept_ride` e `public.driver_finish_ride` são wrappers `SECURITY DEFINER`, invocáveis por `authenticated`, `service_role` e também **anon** na produção atual; os respectivos serviços internos verificam `auth.uid()`. A análise **não demonstrou que anônimos conseguem concluir operações**, mas a permissão de chamada anônima é desnecessária e aparece no aviso do Supabase Security Advisor **0028 (Public Can Execute SECURITY DEFINER Function)**: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### Commits e testes executados

1. **`487b3f63ce49c95952248b81c37a6616f6011025`**: o PostgreSQL de QA replica explicitamente o privilégio `service_role` nas quatro RPCs internas e reproduz as funções públicas reais do aplicativo. As chamadas de presença, aceitação e conclusão foram redirecionadas para essas funções públicas; o teste da função legada ocorre por `service_role`. Este commit isoladamente passou **3/3 WEB** em [41742289884](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41742289884), confirmando também a negação lógica de chamadas anônimas sem `auth.uid()`.
2. **`2f65aa127e810114d1daea03fd5a3a888aefc4a6`**: acrescentadas na **migração ainda não aplicada de Corridas** três revogações explícitas de `EXECUTE` para `PUBLIC, anon` nas wrappers públicas `driver_set_presence(boolean,numeric,numeric,numeric,numeric)`, `driver_accept_ride(uuid)` e `driver_finish_ride(uuid)`. Permissões de `authenticated` e `service_role` são preservadas e funções internas continuam restritas. A suíte replica o estado pretendido **após** a migração, recusa `anon` já na ACL PostgreSQL, continua permitindo os fluxos autorizados e verifica estaticamente que a migração contém as três revogações.
3. **`f893c46efae2cd1bf4968fa94d4f82387dc7f8f8`**: ampliado o preflight read-only `database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql` com dois gates novos de `EXECUTE` — wrapper público `authenticated` apenas e funções internas `service_role` apenas. O arquivo SQL foi executado **somente para consulta** no projeto oficial: 11 gates (10 exigidos, 1 informativo); **5 falhas exigidas**: quatro dependências legadas de assinatura já registradas e o novo gate de `anon` pendente. O gate de privilégio das RPCs internas passou.
4. **`d92d0c6558d2cfa404f7977647c55a917acbfc6e`**: adicionado o gate read-only correspondente no Supabase Entregas para `public.merchant_reject_order(uuid,text)`, cuja ACL real ainda permite `PUBLIC/anon`. A migração de cash Entregas **já versionada, não aplicada** contém a revogação e preserva `authenticated` e `service_role`; ela não foi reescrita. Preflight read-only Entregas executado contra produção: 9 gates (8 exigidos, 1 informativo); **5 falhas exigidas**: quatro fluxos cash originais e a revogação de `anon` ainda pendente. A execução real da RPC autenticada em Entregas ainda depende de staging.

**Regressão CI do commit `2f65aa1`:** [GitHub Actions 41742621422](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41742621422), **3/3 jobs WEB SUCCESS**. O log da bateria PostgreSQL registra repetidamente `[PASS] Private Corridas RPCs are service_role-only; staged public wrappers deny anon and permit authenticated` e `[PASS] Anon wrapper calls denied by PostgreSQL EXECUTE ACL`. Regras operacionais anteriores de dinheiro, KYC, GPS, aprovação, fim de corrida e fila permaneceram aprovadas.

**Diferença importante entre os ambientes:** a produção real ainda concede chamadas anônimas para esses wrappers e contém as quatro restrições Corridas de assinatura antiga; o PostgreSQL descartável verifica o comportamento **esperado da migração preparada**, não prova que foi aplicado ao Supabase. Em Entregas continuam os quatro bloqueios operacionais de cash/pending. Somando os dois produtos, são **oito gates operacionais conhecidos e dois gates adicionais de permissão anônima**, ainda não cumpridos na produção. Não confundir o CI verde com produção liberada.

**Fonte protegida e decisão:** diff desta rodada toca apenas `supabase/corridas-forward-migrations/`, `scripts/qa/`, runner PostgreSQL e os dois arquivos `database/review/`; sem modificação em `sources/`, submódulos, source-lock ou workflows. Não executar revogações/migrações em produção sem validação de callers e staging fiel com o esquema completo. Nenhum APK final autorizado enquanto não forem testados Auth real, KYC/13 fotos, GPS, push, PIN e fluxo financeiro físico.

---

## Schema Entregas progressivamente fiel — integração de gatilho financeiro (03/11/2026)

**Finalidade:** elevar a fidelidade dos testes PostgreSQL isolados sem copiar dados pessoais nem conectar ao Supabase oficial. O QA continua com esquema **sintético parcial**; não constitui clone integral da produção nem libera APK.

### Fonte autoritativa e melhorias aplicadas

- Consulta **somente de leitura** ao Supabase Entregas `ptgkwyyolrdgnqketkjj` validou tipos e colunas obrigatórias de `orders`, `order_items`, `order_status_history`, `payments`, `refunds`, `delivery_jobs`, `delivery_offers`, `delivery_events` e `admin_audit_logs`. Também foram lidas CHECK constraints e triggers relevantes, sem alterar nem executar nenhuma operação financeira real.
- Commit `7c5b31a88ceae8f483f24eb0c96ffdede0aedbbd`: aprimorou a fixture `scripts/qa/cash-postgres-fixture-v1.sql` com tipos UUID, valores obrigatórios, estados válidos, estrutura financeira e campos essenciais similares aos de produção, além de 12 verificações explícitas de tipos/NOT NULL e tentativas de violar métodos/status.
- Commits `0e141c94575d5fb3dc7db3b2407e3c6bf7b325ba`, `4274a7cd1c06bd5762a5ecef43d8013762b77ea6` e `fdc2b525e8fd9e488de282b9bd617a79c0468b39`: repararam problemas **exclusivos dos arquivos sintéticos de testes** identificados em CI (SQL duplicado ao substituir literalmente uma regex de moeda e conflito com nome do campo `relname` de `pg_class`). A migração operacional de Entregas NÃO foi modificada por esses commits. Em [41744590497](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41744590497), a nova bateria PostgreSQL passou.
- Commit `16bc169c97d6589ca7d755cddc935243c001d03f`: criou `scripts/qa/entregas-payment-stage-trigger-qa-v1.sql` baseado no corpo efetivamente lido via `pg_get_functiondef` de `public.enforce_order_payment_before_fulfillment`, instalando o gatilho apenas no PostgreSQL descartável e verificando:
  - Pedido `cash/pending` pode avançar até `preparing` sem marcar pagamento eletrônico como `paid`.
  - Pedido `pix/pending` NÃO pode entrar em preparo; a tentativa deve ser recusada sem mutação do estado.
  - Pedido `pix/paid` pode avançar em preparo, preservando o comportamento eletrônico legado.
  - Pedido `cash/pending` em preparo pode ser cancelado pela função real proposta `merchant_reject_order`, sem criar registro de `refund` eletrônico e mantendo `payment_status='cancelled'`.
- CI [41744829063](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41744829063): **3/3 jobs WEB SUCCESS**, com PostgreSQL 17 descartável, builds WEB e auditoria visual aprovados. O log comprova 12 contratos de colunas, restrições de status/métodos, preparo cash/pending permitido, preparo Pix/pending negado, preparo Pix/paid permitido e cancelamento cash sem gateway/refund.

### Diferenciar teste de implantação

A base QA aproxima a superfície de **nove tabelas** de Entregas, mas não reproduz todas as tabelas do banco, funções Auth, RLS legadas cumulativas, triggers de notificações, dispatch automático, saldos, webhooks e concorrência de duas sessões. O teste só executa os corpos do SQL versionado e um gatilho adicional lido da produção; não é autorização para DDL no Supabase.

A base real continua com `orders`, `order_items`, `order_status_history` sem as políticas gerais `cash/pending`, `merchant_reject_order` sem a guarda de conciliação cash vigente e `anon` com EXECUTE na função pública. Consulta read-only novamente efetuada após os testes — **cinco gates Entregas** ainda bloqueados, além dos cinco conhecidos de Corridas. Não há branches de desenvolvimento nos dois projetos Supabase (listagem consultada, retorno vazio). Um ambiente staging real dependerá de uma decisão separada sobre infraestrutura, custo e proteção de dados.

**Proteção de fontes:** nesta rodada a comparação GitHub mostrou alterações apenas em `scripts/qa/cash-postgres-fixture-v1.sql`, `scripts/qa/cash-postgres-assertions-v1.sql`, `scripts/qa/entregas-payment-stage-trigger-qa-v1.sql` e `scripts/test-cash-postgres-isolated-v1.sh`; nenhum `sources/`, workflow, submódulo ou source-lock modificado. Nenhuma migração aplicada em produção, nenhum merge, nenhum APK gerado.

---

## Cancelamento cash idempotente após reenvio — revisão do contrato em produção (03/11/2026)

**Inspeção:** `pg_get_functiondef('public.merchant_reject_order(uuid,text)'::regprocedure)` foi consultado no Supabase oficial Entregas `ptgkwyyolrdgnqketkjj`, **somente leitura**. O contrato ativo continua restrito ao cancelamento de pedidos pagos/reembolsados pelo estabelecimento. A migração forward-only proposta, ainda não aplicada, passou a admitir `cash/pending`; após o primeiro cancelamento, grava `status='cancelled'` e `payment_status='cancelled'`. Como a regra anterior só deixava passar `cash/pending`, uma segunda chamada legítima do mesmo estabelecimento falhava **antes de chegar ao retorno idempotente**. Para cash cancelado sem reembolso, a expressão `v_refund.status in ('pending','processing')` também retornava `null` em JSON, não `false`.

**Correção versionada no commit `64c2e2aa504fd9beaa2b13bf317c2b8051b7e5f4`:** foi adicionada permissão **somente de repetição** ao estabelecimento já autorizado para `payment_method='cash'`, `status='cancelled'`, `payment_status='cancelled'`. Isso não permite a primeira rejeição de um pedido cash com estado financeiro inconsistente. O retorno terminal agora usa `coalesce(...,false)` para `refund_pending`. Autorização do tenant é verificada **antes** desta exceção e nenhuma operação financeira ocorre na repetição.

**Regressões PostgreSQL:** `scripts/qa/cash-postgres-assertions-v1.sql` agora cancela e reenvia o mesmo pedido, exige a mesma situação terminal, `refund_id=null`, `refund_pending=false`, apenas **uma** linha de histórico de cancelamento e **nenhum** reembolso. A leitura da tabela `refunds` ocorre apenas após `COMMIT` como proprietário da fixture; não foi concedido `SELECT` financeiro ao papel `authenticated`. Commit `819b06d70cac7ee137c2ce18e63f829cd900e473` corrigiu a própria asserção que inicialmente tentava ler a tabela `refunds` com acesso insuficiente. O [CI 41746038745](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41746038745) encerrou com **3/3 jobs WEB aprovados**, incluindo PostgreSQL 17 descartável.

**Proteção permanente em `7ced112a44e7cbd78487ecca3ed1ff340449acce`:** `scripts/verify-entregas-direct-order-contract.mjs` passou a recusar uma migração que retire a autorização estrita de repetição, o booleano `false` ou a ordem correta de permissão/retorno antes de qualquer mutação. O gate de cancelamento de `database/review/20261103_entregas_cash_homologacao_READ_ONLY.sql` exige agora esses elementos. Consulta live, **somente leitura**, retornou cinco gates Entregas não cumpridos: os mesmos quatro operacionais/tenant já pendentes e a permissão `anon` ainda não revogada. Este novo cenário não adiciona outro gate: reforça o gate de cancelamento já existente. O [CI 41746209048](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41746209048) encerrou **3/3 jobs WEB SUCCESS**, com PostgreSQL isolado, builds WEB e renderização anônima aprovados.

**Fronteiras:** sem deploy, sem migration no projeto oficial, sem merge, sem APK e sem uso de credenciais financeiras. Não foram alterados `sources/`, submódulos, source-lock ou workflows. A ausência de staging com o esquema completo e os **10 gates de release** (cinco Corridas, cinco Entregas) seguem impedindo a liberação real.

---

## Admissão de cash para comerciantes comuns — dois novos bloqueios de produção (03/11/2026)

**Descoberta por introspecção SQL, apenas leitura:** o Supabase Entregas `ptgkwyyolrdgnqketkjj` possui um `BEFORE INSERT OR UPDATE OF payment_method` em `public.orders` chamado `orders_supported_payment_method_guard`. O corpo vigente de `public.enforce_supported_order_payment_method` aceita `pix` e restringe `cash/pending` a `private.apois_test_cash_authorized(merchant_id,customer_user_id)`. A função de autorização exige registro temporário da dupla estabelecimento/cliente e nome do estabelecimento `APOIS TESTE%`. Isso torna o **cash de homologação possível, mas impede cash para comerciantes normais** mesmo que tenham assinatura ativa.

Outra função acionada em cada inserção de pedido, `public.enforce_merchant_subscription_on_order`, chama `merchant_subscription_in_good_standing`. Para estabelecimentos aprovados e ativos comuns, a função vigente depende de `public.merchant_subscriptions`, `last_payment_status='approved'`, `metadata->>'environment'` e `public.platform_settings['mercado_pago_environment']`. A exceção especial `APOIS TESTE%` preserva o caminho QA. **A verificação de assinatura não deve ser simplesmente removida:** é um controle comercial separado de pagar corridas/entregas em dinheiro e necessita de uma política de mensalidade autorizada que não se apoie indevidamente no provedor aposentado.

**Nova bateria no commit `f4cf970ff49a0e3740d5f112a12c9e1f74629e1e`:**
- Sexto banco PostgreSQL 17 completamente descartável, `entregas_payment_admission_qa`, inicializado por `scripts/qa/entregas-payment-admission-qa-v1.sql`. Reproduz os quatro corpos SQL relevantes lidos via `pg_get_functiondef`: `private.apois_test_cash_authorized`, `public.enforce_supported_order_payment_method`, `public.merchant_subscription_in_good_standing` e `public.enforce_merchant_subscription_on_order`. Cria os dois triggers reais apenas no banco sintético.
- Cenários: merchant QA ativo/aprovado com autorização de cliente e cash/pending é aceito; merchant comum sem assinatura e merchant comum com assinatura Mercado Pago aprovada continuam impedidos de cash; cliente não autorizado na conta QA, cash com `payment_status='paid'` fabricado, crédito não permitido e acesso de teste expirado são recusados sem inserir pedido; Pix continua aceito para merchant com assinatura legada válida, mas Pix com assinatura ausente é recusado.
- Preflight `database/review/20261103_entregas_cash_homologacao_READ_ONLY.sql` ganhou dois gates obrigatórios **para lançamento comercial integral**, sem alterar outros: `general_cash_checkout_for_regular_merchants` e `merchant_subscription_independent_of_retired_gateway`. Executado em read-only contra Entregas real: **11 gates listados, 10 exigidos, 7 exigidos pendentes** (cinco já conhecidos mais os dois de rollout). Corridas mantém cinco gates pendentes, total **12 bloqueios para o lançamento amplo**. A homologação restrita à conta QA pode avançar separadamente, sem confundir isso com lançamento público.
- CI [41747599002](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41747599002): banco descartável PostgreSQL 17 passou; consultar o link para o estado completo dos jobs WEB.

**Decisão de escopo e segurança:** nesta rodada a produção não foi alterada e nenhuma versão ampla de checkout cash ou substituição artificial da assinatura Mercado Pago foi implantada, nem colocada nas migrations de cash de homologação. Não aceitar dinheiro de todo estabelecimento sem definir primeiro a política de habilitação, cobrança/renovação da mensalidade, cobrança offline durante QA e bloqueio de inadimplentes. Os dois novos gates não justificam burlar o controle de receita. Não gerar APK final, não executar SQL de produção e não fazer merge até staging, Auth/JWT real e testes físicos.
