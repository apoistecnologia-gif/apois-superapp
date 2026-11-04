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
- CI [41747599002](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41747599002): **3/3 jobs WEB SUCCESS**, incluindo banco PostgreSQL 17 descartável, builds WEB e renderização anônima. Logs confirmam explicitamente os bloqueios de cash de merchant normal com assinatura legada, cash fabricado como paid, autorização QA expirada, métodos eletrônicos não habilitados e preservação do Pix legado.

**Retrato agregado de produção para planejar testes (consulta read-only de 03/11/2026):** quatro estabelecimentos ativos/aprovados, dos quais três marcados como abertos; **uma** autorização de cash QA habilitada e vigente; **zero** assinaturas legadas com `last_payment_status='approved'` e período vigente. A única autorização QA vence em **2026-12-01 02:59:59 UTC** (30/11/2026 às 23:59:59 em Recife), portanto não é preciso estendê-la neste momento. Estas são contagens, sem divulgar os titulares. Não usar a existência da conta QA como evidência de que checkout comercial esteja pronto.

**Decisão de escopo e segurança:** nesta rodada a produção não foi alterada e nenhuma versão ampla de checkout cash ou substituição artificial da assinatura Mercado Pago foi implantada, nem colocada nas migrations de cash de homologação. Não aceitar dinheiro de todo estabelecimento sem definir primeiro a política de habilitação, cobrança/renovação da mensalidade, cobrança offline durante QA e bloqueio de inadimplentes. Os dois novos gates não justificam burlar o controle de receita. Não gerar APK final, não executar SQL de produção e não fazer merge até staging, Auth/JWT real e testes físicos.

---

## Falhas de assinatura e permissão herdada em RPCs de checkout — correções staged (03–04/11/2026)

**Escopo desta rodada:** nenhuma migração foi aplicada em produção. O código do submódulo `sources/apois-entregas` (pinned SHA `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`) foi lido para localizar a intenção original, mas **não foi alterado**. Fluxos cash-only e mensalidade obrigatória permanecem separados.

### ENT-SEC-01 — assinatura com resultado fail-open

- **ANTES:** a função real `public.merchant_subscription_in_good_standing(uuid)` continha `WHEN NOT EXISTS(... merchant approved AND active) THEN true`. Isso devolvia verdadeiro para merchant ausente, pendente ou inativo, embora o checkout v2 já faça validação adicional. Uma função comum de elegibilidade não pode afirmar que estabelecimento inexistente/inativo está em dia.
- **CORREÇÃO:** nova migração manual e forward-only `supabase/entregas-forward-migrations/20261104010000_guard_merchant_subscription_fail_closed.sql` calcula `EXISTS(approved AND active) AND (entitlement QA temporário OU assinatura legada vigente/confirmada)`. Mantém as mesmas regras de cobrança e tolerância a QA, fecha o bypass inicial e retira EXECUTE anônimo da função `SECURITY DEFINER` enquanto preserva `authenticated`/`service_role`. **Não** habilita cash comercial, não cria mensalidades e não altera o provedor legado.
- **TESTE:** `scripts/qa/entregas-subscription-approved-assertions-v1.sql` aplica a migração só no sexto banco PG17 sintético, impede Pix/pedido por merchant não aprovado, inativo e de plano vencido, além de testar UUID inexistente, serviço permitido ao merchant pago e QA autorizado; confirma ACL anon negada. `scripts/qa/entregas-payment-admission-qa-v1.sql` foi tornado idempotente em relação aos roles PostgreSQL globais. Os logs de [41749258705](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41749258705) mostram **3/3 WEB SUCCESS**, incluindo os novos testes PostgreSQL.
- **PREVENÇÃO:** `scripts/verify-entregas-direct-order-contract.mjs` recusa remoção do `approved AND active`, da verificação de pagamento futuro e do `REVOKE PUBLIC,anon`; o read-only gate `merchant_subscription_rejects_unapproved_and_inactive` segue FAIL no Supabase real porque a migração não foi aplicada.

### ENT-SEC-02 — revogações antigas omitiam PUBLIC

- **ANTES:** a migração do submódulo pinado `supabase/migrations/20260809213849_harden_rpc_and_core_table_privileges.sql` declarava `create_order_atomic_v2` e `create_order_for_checkout_intent_v2` restritas ao backend, mas revogava somente de `anon, authenticated`. O catálogo real ainda mostra `=X/postgres`: **PUBLIC EXECUTE herdada** continua permitindo execução de RPCs por esses papéis, mesmo quando os grants diretos foram removidos. As funções são `SECURITY INVOKER` e também dependem de RLS, mas a ACL é uma barreira independente necessária.
- **CORREÇÃO:** migração manual `supabase/entregas-forward-migrations/20261104011000_checkout_rpc_service_role_only.sql` exige as três identidades reais e executa `REVOKE EXECUTE ... FROM PUBLIC,anon,authenticated` em `create_order_atomic` v1, `create_order_atomic_v2` e `create_order_for_checkout_intent_v2`; mantém `GRANT EXECUTE ... TO service_role`. O `create-order` Edge versionado usa `adminClient.rpc("create_order_for_checkout_intent_v2", ...)` com identidade do cliente validada. Nenhuma SQL de criação de pedido nem payload financeiro foi reescrito.
- **TESTE:** em banco descartável, `scripts/qa/entregas-checkout-rpc-acl-qa-v1.sql` reproduz o problema de permissões herdadas com funções dummy sem dados. A aplicação da migração é seguida por `scripts/qa/entregas-checkout-rpc-acl-assertions-v1.sql`, que exige ACL anon/auth negada nas 3 funções e EXECUTE service_role mantido, além de chamadas reais com cada role. As funções QA retornam somente texto `synthetic-*` e não criam pedidos.
- **PREVENÇÃO:** o verificador estático exige revogação explícita de `PUBLIC, anon, authenticated`; o gate read-only `checkout_rpcs_service_role_only` permanece FAIL no banco real. CI [41749934040](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41749934040) — **3/3 jobs WEB SUCCESS**; os logs comprovam a reprodução do erro original de `PUBLIC EXECUTE`, revogação nas 3 RPCs, erro 42501 para anon/authenticated e sucesso de execução com `service_role`.

### ENT-UX-01 — erros de checkout antes indistinguíveis de falha transitória

- **ANTES:** `supabase/functions/create-order/index.ts` tratava a recusa de assinatura e o bloqueio de método de pagamento como `ORDER_CREATION_FAILED` genérico; isso podia levar o usuário a reenviar um pedido que não pode ser aceito.
- **CORREÇÃO:** `mapOrderError` responde `409 / MERCHANT_UNAVAILABLE` para assinatura inativa, sem expor situação financeira do estabelecimento; responde `409 / PAYMENT_METHOD_NOT_CONFIGURED` para método bloqueado pela política de produção. O backend continua cash-only. O verificador estático trava os dois novos branches.

### Bloqueios e operação

Preflight read-only executado nos **dois** projetos: Corridas mantém **5/10 gates obrigatórios FAIL**, Entregas registra **9/12 FAIL** (3 aprovados, um gate informativo), num total de **14 impedimentos** aos critérios atuais de lançamento amplo. Os novos gates são `merchant_subscription_rejects_unapproved_and_inactive` e `checkout_rpcs_service_role_only`, ambos ainda FAIL em produção, pois a implementação está **somente no repositório**. Para produção ainda faltam decidir e implementar fonte de entitlement da mensalidade independente do Mercado Pago, opção comercial de cash para merchants comuns e migrações/RLS em staging, além dos testes físicos Android.

**Reversibilidade:** commits, scripts e migrações novas permanecem isolados nesta branch e podem ser revisados/revertidos antes da aplicação. A migração de ACL pode romper um cliente legado que invoque RPC diretamente; confirmar os clientes Android/Web realmente implantados antes de aplicá-la fora de staging. Submódulos e workflows protegidos devem continuar intactos. Não usar testes isolados como aprovação para implantação de produção ou APK.

---

## Complemento QA de cancelamento cash e ausência de estabelecimento de teste (03–04/11/2026)

### ENT-CASH-RECON-02 — cancelamento já concluído não pode ocultar registros financeiros posteriores

Na migração forward-only `20260905113000_allow_direct_cash_order_operations.sql`, a resposta terminal idempotente acontecia **antes** da guarda de reconciliação. Se aparecesse um registro incorreto em `payments` ou `refunds` vinculado a um pedido cash já cancelado, o retorno da função mascarava a inconsistência. O commit `93570b763f04ae08440dbaa2d2dbd977bfa3bcac` antecipou as checagens de pagamentos e reembolsos, aplicando-as também às chamadas repetidas; um estado terminal diferente de `payment_status='cancelled'` exige igualmente investigação. O caminho do Pix permanece inalterado. O teste `scripts/qa/entregas-cash-terminal-reconciliation-v1.sql` injeta somente registros sintéticos, exige erro SQLSTATE `55000` e comprova que um segundo cancelamento íntegro retorna o mesmo resultado sem reembolso.

**Evidência:** [GitHub Actions 41751405271](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41751405271), **3/3 jobs WEB SUCCESS**, incluindo PostgreSQL descartável.

### ENT-QA-TRIGGER-02 — reproduzir as proteções de dinheiro da produção

`scripts/qa/entregas-cash-qa-triggers-v1.sql` instala em PostgreSQL descartável cópias da lógica efetivamente consultada via `pg_get_functiondef` de `private.apois_test_cash_order_guard`, `private.apois_qa_no_real_payment` e `private.apois_mark_cash_test_order`. Testa autorização de cliente, bloqueio de `paid` e de conversão Pix, marcação do pedido como teste, campos `merchant_net/courier_earnings/platform_fee=0`, preparo, cancelamento e retry sem pagamentos ou reembolsos eletrônicos. O commit `dd355391edec46f3f642c145705f9efd72f3970b` acrescenta um `delivery_job` em oferta, uma oferta de entregador aceita, cancelamento pelo estabelecimento autorizado, proibição a outro tenant, encerramento do job e oferta, e exatamente um evento `merchant_cancelled` após o retry.

**Evidência da versão inicial dos gatilhos:** [GitHub Actions 41751652084](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41751652084), **3/3 SUCCESS**. A versão com oferta de entregador foi aprovada em [41752274863](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41752274863): **3/3 jobs WEB SUCCESS**; o log PostgreSQL confirma bloqueio cross-merchant, cancelamento da oferta e do serviço com evento único, reprodução da falha Pix sem merchant QA e correção pós-migração, sem criação de pagamentos ou reembolsos eletrônicos.

### ENT-QA-NULL-01 — ausência da conta especial de testes não pode derrubar Pix comum

A função ativa `private.apois_qa_no_real_payment` usa `IF NEW.merchant_id <> v_id THEN RETURN NEW`; se `v_id` for NULL porque o estabelecimento QA foi removido ou renomeado, a condição resulta em `NULL`, não `true`, e um INSERT de Pix de outro estabelecimento pode ser bloqueado pela proteção da conta de teste. O commit `3334c96d920433dd5f27dc80f59ddd794661514e` cria migração forward-only `20261104012000_qa_missing_merchant_guard.sql`, substituindo por `IF v_id IS NULL OR NEW.merchant_id IS DISTINCT FROM v_id THEN RETURN NEW`, sem afrouxar as demais condições de cash. A nova bateria primeiro reproduz o erro antigo com `slug` sintético ausente, depois aplica a função proposta e confirma que Pix comum é aceito mesmo sem a conta QA; restaura a referência e confirma o bloqueio de cash `paid` fabricado.

**Evidência:** [GitHub Actions 41752050309](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41752050309), **3/3 SUCCESS**. O read-only gate `qa_guard_missing_test_merchant_does_not_block_other_orders` segue vermelho no banco oficial porque a migração está somente no GitHub.

### Estado de produção e autorização

Em preflights SQL de **somente leitura**, Corridas permanece com 5 gates obrigatórios pendentes e Entregas com 10, total **15 gates** para os critérios atuais de lançamento amplo. O gate existente de `cash_cancellation_without_gateway_refund` agora exige também guardas de pagamentos e reembolsos no retry terminal; não é um gate extra. **Nenhuma migração foi aplicada em Supabase produção.** Não foram alterados código de submódulos `sources/`, workflows CI ou source-lock, e nenhum APK foi gerado. A simulação de banco descartável não substitui staging de esquema integral, JWT real ou testes físicos de Android.

---

## Corridas: troca de motorista com status inalterado e revogação do KYC (04/11/2026)

**Origem e escopo:** leitura direta de `pg_get_functiondef` no Supabase de Corridas `tbbzkrfupmqdywnzgnms`, exclusivamente SELECT. A produção dispõe de `trg_rides_driver_operational_stage_gate BEFORE UPDATE OF status, driver_id ON public.rides`, mas a função `private.enforce_driver_operational_stage_transition()` interrompe a validação quando `new.status IS NOT DISTINCT FROM old.status`. A função `apois_rpc_private.driver_set_presence` verifica KYC somente ao sair do offline para o online; a sessão já online não é revalidada no heartbeat. Ambos os problemas também existiam na migração forward-only versionada, antes desta rodada.

### COR-SEC-01 — evitar troca de motorista sem validação em corrida operacional

- **Falha demonstrada no contrato:** uma alteração somente de `driver_id` para motorista suspenso, bloqueado, sem KYC, offline ou NULL, mantendo `status='motorista_a_caminho'`, passava pela cláusula de retorno antecipado; isso ignorava a verificação de elegibilidade embora o gatilho real escute `UPDATE OF driver_id`. A execução do UPDATE em produção **não** foi tentada.
- **Correção:** em `supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql`, a função retorna cedo apenas quando a etapa não é operacional OU quando **ambos** `status` e `driver_id` permanecem iguais. A alteração de motorista em uma das etapas operacionais passa pelas verificações de existência de perfil, aprovação, suspensão, bloqueio, KYC e presença online.
- **Teste:** `scripts/qa/driver-presence-assertions-v1.sql` tenta cinco reatribuições inválidas na mesma etapa e confirma rollback da atribuição; as três fixtures de Corridas em `scripts/test-cash-postgres-isolated-v1.sh` passaram a reproduzir o evento real `BEFORE UPDATE OF status, driver_id`. CI [41753541382](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41753541382) **3/3 jobs WEB SUCCESS**, incluindo asserção explícita `Same-status driver reassignment`.

### COR-SEC-02 — KYC revogado durante sessão já online

- **Falha demonstrada no contrato:** `driver_set_presence` calculava `v_operationally_eligible` sem KYC; só conferia `driver_kyc_is_ready` quando `is_online` anterior era `false`. Um motorista já online podia continuar retornando elegibilidade mesmo com KYC revogado, embora a aceitação de corridas ainda tenha controles KYC independentes.
- **Correção:** a função staged recalcula `v_kyc_ready := coalesce(private.driver_kyc_is_ready(...),false)` a cada heartbeat e inclui o resultado no sinal `v_operationally_eligible`. Se a sessão anterior estava online, KYC deixou de ser válido e **não há viagem ativa**, o driver é retirado de disponibilidade pelo próprio backend, inclusive com heartbeat sem coordenadas novas, sem lançar exceção que desfaria o UPDATE. Uma nova tentativa de ativação continua recusada com `driver_kyc_incomplete`. Havendo viagem ativa, a presença online cai para `false`, mas um heartbeat **com coordenadas válidas** continua atualizando GPS e informando `tracking_active_ride=true`, evitando interromper acompanhamento de viagem já iniciada.
- **Teste:** `scripts/qa/driver-presence-kyc-revocation-v1.sql` cobre início online legítimo, revogação posterior de KYC, desativação da sessão anterior, rejeição de nova ativação, reaprovação e atualização GPS durante viagem ativa com nova revogação. O [CI 41753894625](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41753894625) concluiu **3/3 jobs WEB SUCCESS**. Versão endurecida para desativar mesmo sem coordenadas: [41754204065](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41754204065). Um verificador estático que impede reintroduzir as duas brechas foi incluído em `scripts/qa/verify-corridas-public-rpc-acl-v1.mjs`: [41754278163](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41754278163). Ambas as execuções concluíram com **3/3 jobs WEB SUCCESS**. Os logs da execução 41754278163 confirmaram a verificação estática das duas correções e as regressões PostgreSQL, sem erros.

### Pré-flight e fronteiras

O preflight somente leitura de Corridas ganhou dois gates obrigatórios `driver_stage_reassignment_preserves_eligibility_checks` e `driver_presence_rechecks_revoked_kyc`. Ambos permanecem em **FAIL no banco oficial**, porque as correções estão exclusivamente na migração do GitHub. Resultado agregado: **sete gates Corridas FAIL** (de 12 obrigatórios), somados aos dez gates Entregas FAIL (de 13), total **17 gates de lançamento pendentes**, sem alteração nos bancos. O aumento do número de gates reflete cenários adicionais descobertos, **não** regressões introduzidas em produção. O driver já aprovado e com KYC regular pode continuar online; autenticação, suspensão, bloqueio, status de corridas e pagamento cash não foram removidos.

Não foram alterados `sources/`, source-lock ou workflows. Nenhum APK, cobrança ou migração de produção foi executado. A etapa seguinte continua sendo testar as migrações no esquema real em staging, sob autorização de custo, antes do Android físico.

---

## Corridas — expansão de ofertas para motoristas ocupados: GPS, expiração e meio de pagamento (03/11/2026, horário de Recife)

A auditoria comparou o corpo real de `public.append_nearby_busy_driver_candidates()` e o trigger `rides_append_nearby_busy_candidates BEFORE UPDATE OF candidate_driver_ids` do Supabase Corridas (consultas estritamente **read-only**) com a migração forward-only do Superapp. A função original filtra `last_location_at>=now()-120 seconds`, mas **não exige limite superior de GPS** e verifica apenas `current_lat/current_lng IS NOT NULL`. Também pode acrescentar motoristas em solicitações de corrida expiradas e ofertas de pagamento eletrônico que a função `apois_rpc_private.driver_accept_ride` rejeita. No PostgreSQL, coordenadas numéricas fora da faixa podem representar posições trigonometricamente equivalentes (por exemplo, latitude `350.6` e `-9.4`).

### COR-OFFER-01 — GPS futuro e coordenadas inválidas

- **Antes (código confirmado em produção):** faltavam `d.last_location_at<=now()+interval '30 seconds'`, limites de latitude/longitude tanto do motorista quanto da origem, e validação no próprio gatilho que expande motoristas ocupados.
- **Correção:** `supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql` exige GPS do motorista dentro de `[-34,6]` e `[-74,-32]`, origem dentro da mesma faixa e relógio GPS entre `now()-120s` e `now()+30s`; preserva os demais filtros de KYC, aprovação, bloqueio, suspensão, categoria, corrida `em_viagem`, distância máxima e fila já reservada.
- **Teste:** sétima base PostgreSQL 17 isolada, `ride_busy_candidates_qa`. `scripts/qa/extract-corridas-busy-candidates-sql-v1.mjs` extrai a função **real do arquivo staged**, executada como trigger `BEFORE UPDATE OF candidate_driver_ids`, e `scripts/qa/corridas-busy-driver-candidates-v1.sql` verifica motorista ocupado válido, GPS no futuro (rejeitado), desvio legítimo de 20s (aceito), latitude/longitude envoltas em 360° (rejeitadas), origem fora de limites, GPS vencido, KYC revogado, suspensão, bloqueio, categoria incompatível, rejeição explícita e reserva de próxima corrida. [CI 41758214988](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41758214988): **3/3 jobs WEB aprovados**.

### COR-OFFER-02 — janela da corrida encerrada

- **Antes:** o gatilho podia acrescentar candidatos mesmo com `request_expires_at<=now()`, enquanto `driver_accept_ride` recusaria a aceitação.
- **Correção:** o filtro retorna `NEW` sem acrescentar ofertas quando a janela está vencida; preserva `request_expires_at IS NULL`, que continua sendo admitido pelo contrato de aceitação.
- **Teste:** pedido sintético expirado, driver ocupado válido, nenhum novo `offered_driver_id`; pedidos válidos continuam aceitos. [CI 41758504161](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41758504161): **3/3 jobs WEB aprovados**.

### COR-OFFER-03 — ofertas incompatíveis com pagamento configurado

- **Antes:** a expansão de ofertas não verificava `payment_method` nem `service_details->>'payment_flow'`, embora a função de aceitação de corrida rejeite Pix e gateways aposentados. Consulta **agregada e sem PII** ao Supabase Corridas mostrou registros `credit`/fluxo vazio, `cash`/fluxo vazio e `pix`/fluxo `mercadopago_marketplace`.
- **Correção:** o gatilho permite apenas os mesmos meios diretos que `driver_accept_ride` permite nesta fase: `cash`, `dinheiro`, `money`, `credit`, `credit_card`, `cartao_credito`. Bloqueia `safe2pay%`, `mercadopago_marketplace`, `asaas`, `pagbank` e `openpix`. Isso evita oferecer corridas impossíveis de aceitar **sem bloquear pagamentos em cartão diretamente ao motorista**.
- **Teste:** na base PostgreSQL 17 sintética, Pix e cash com fluxo Safe2Pay não são oferecidos; cartão direto é oferecido normalmente. [CI 41758801080](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41758801080): **3/3 jobs WEB SUCCESS** — PostgreSQL 17 sintético, builds Cliente/Estabelecimento, renderização anônima e verificação de contratos aprovados. Logs confirmam explicitamente bloqueio de Pix/provedor aposentado e aceitação de cartão direto, GPS futuro, coordenadas envoltas, ofertas vencidas e preservação da corrida cash.

### Proteção de regressão, release e dependências

`scripts/qa/verify-corridas-public-rpc-acl-v1.mjs` e o extrator SQL verificam estaticamente limites GPS, tempo, expiração, KYC e as regras de pagamento. `database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql` ganhou dois gates obrigatórios: `busy_driver_offers_require_bounded_fresh_gps` e `busy_driver_offers_reject_retired_payments`. **Nenhuma migração foi aplicada em produção.**

No retrato atual do preflight read-only, **Corridas: 9/14 gates obrigatórios FAIL; Entregas: 10/13 FAIL; total: 19 gates de lançamento pendentes**. A contagem aumentou porque novos requisitos de segurança foram identificados, não porque o código em produção mudou. Foi confirmado que **não há branches de Supabase em nenhum dos dois projetos** na consulta `list_branches`. Criar staging pode gerar custos e requer autorização explícita, antes de aplicar qualquer migração. Os testes isolados continuam sem esquema integral, JWT real, produção, dinheiro ou APK Android.

**Arquivos restritos preservados:** `sources/`, source-lock, workflows; nenhuma mudança de contrato financeiro, autenticação, permissão de produção ou dados reais.

---

### COR-PRESENCE-INELIGIBILITY-20261104 — Revogação administrativa também deve limpar presença online

**Problema adicional encontrado na migração staged:** a lógica anterior limpava o `is_online` antigo somente quando o KYC era revogado. Motoristas suspensos, bloqueados ou não aprovados com `is_online=true` persistido tentavam enviar um heartbeat e recebiam uma exceção antes do `UPDATE`; a sessão antiga não era removida. A aceitação de corridas ainda tem proteções adicionais, mas o estado de disponibilidade permaneceria inconsistente.

**Correção implementada:** `20260905162500_remove_retired_driver_subscription_gates.sql` agora limpa o cache online para **qualquer** motivo que faça `v_operationally_eligible=false` (KYC, suspensão, bloqueio ou desaprovação) quando não há corrida ativa. Isso funciona sem novo GPS. Caso haja corrida `em_viagem`, a localização ainda pode ser transmitida, porém a disponibilidade permanece `false`. Novas tentativas de ativação continuam recebendo os erros existentes correspondentes. `scripts/qa/driver-presence-ineligibility-revocation-v1.sql` executa o SQL staged real em PostgreSQL 17 sintético e cobre suspensão, bloqueio, desaprovação, persistência após COMMIT e GPS durante viagem suspensa.

**Evidência:** [GitHub Actions 41760373823](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41760373823), **3/3 jobs WEB SUCCESS**, inclusive os testes de regressão em PostgreSQL 17. Não implantado em produção.

### DB-CATALOG-20261104 — Verificação gratuita de pré-requisitos do esquema oficial

Foram criados dois inventários executáveis **somente de leitura**:

- `database/review/20261104_entregas_forward_schema_compatibility_READ_ONLY.sql` — **68/68** verificações passaram no Supabase oficial de Entregas `ptgkwyyolrdgnqketkjj`.
- `database/review/20261104_corridas_forward_schema_compatibility_READ_ONLY.sql` — **52/52** verificações passaram no Supabase oficial de Corridas `tbbzkrfupmqdywnzgnms`.

Os scripts verificam **metadados de catálogo**, não dados pessoais ou financeiros: tipos das colunas principais das migrações forward-only, funções necessárias, gatilhos ativos, os papéis de acesso e as tabelas com RLS esperadas (Entregas). Os resultados foram obtidos por `SELECT` exclusivamente. Um guard `scripts/qa/verify-forward-schema-preflights-v1.mjs`, conectado ao executor PostgreSQL descartável, rejeita substituições por DDL/DML nos arquivos de pré-flight.

**Distinção importante:** `120/120` significa que os objetos **necessários identificados** existem com os tipos esperados. **Não significa**: cópia completa do esquema, compatibilidade de todos os constraints/triggers, aceitação de uma migração por `CREATE OR REPLACE`, deploy validado, JWT real, aplicação em produção, nem comprovação de cobrança de mensalidades. Também não garante que as políticas RLS pós-migração funcionem em todas as combinações de atores e estados.

A sessão local disponível nesta revisão dispõe de `git`/`node`, mas **não** possui `docker`, `psql`, `pg_dump` ou CLI Supabase. Por isso, a execução SQL isolada continua sendo feita no GitHub Actions, com Docker PostgreSQL 17, e não foi criado nenhum projeto ou branch Supabase de custo adicional. Não foi realizado clone integral sem PII dos bancos. Uma futura homologação integral deve partir do esquema oficial versionado/backup **somente estrutural** em ambiente descartável, sem copiar clientes, corridas, pedidos, dados pessoais ou credenciais para o repositório. A implantação real permanece bloqueada até aprovação específica.

**Não modificado:** banco de produção, `sources/`, source-lock, workflows CI, cobrança de mensalidades, provedores externos ou APKs.

---

### COR-SEC-03 — ACL administrativa e Pix legado (04/11/2026 UTC)

O diagnóstico `get_advisors(type=security)` do Supabase Corridas identificou `anon_security_definer_function_executable` em diversos RPCs. Parte dos alertas corresponde a funções-gatilho ou verificações internas legítimas; **não é correto** declarar que toda função sinalizada possui exploração demonstrada. Foram isoladas seis funções `public` que tinham `has_function_privilege('anon',oid,'EXECUTE')=true` e cujo fluxo real foi inspecionado via `pg_get_functiondef` (SELECT de catálogo):

- `public.admin_get_dashboard_metrics()`
- `public.admin_get_finance_summary(timestamptz,timestamptz)`
- `public.admin_provision_staff(uuid,public.app_role,text)`
- `public.admin_set_driver_approval(uuid,text,text)`
- `public.admin_set_driver_suspension(uuid,boolean,text)`
- `public.activate_prepaid_pix_ride(uuid,text)`

As cinco funções administrativas delegam a `apois_rpc_private`, cujos corpos existentes exigem `auth.uid()` e `private.has_permission()`. A ativação de Pix legado exige `auth.role()='service_role'`. Assim, os controles internos continuam relevantes: a presença de `EXECUTE` para `anon` era exposição desnecessária de superfície de API, **não evidência de que anônimos já conseguiam alterar dados**.

**Migração staged:** `supabase/corridas-forward-migrations/20261104031000_restrict_sensitive_admin_and_pix_public_rpc_acl.sql` revoga `PUBLIC,anon` das cinco funções administrativas, preservando EXECUTE explícito somente para `authenticated,service_role`; na ativação Pix legada revoga `PUBLIC,anon,authenticated` e concede apenas a `service_role`. Não altera função, transação, usuário, senha, configuração financeira, valor ou autorização de acesso dos administradores autenticados.

**Testes sintéticos:** `scripts/qa/corridas-sensitive-rpc-acl-fixture-v1.sql` cria assinaturas equivalentes (corpos deliberadamente artificiais), reproduz `PUBLIC EXECUTE` padrão; a migração REAL é executada e `scripts/qa/corridas-sensitive-rpc-acl-assertions-v1.sql` comprova ACL por função e papel, recusa de execução anônima e manutenção do acesso de `authenticated` e `service_role`. Este teste **não substitui** execução no esquema integral, autenticação JWT nem chamadas administrativas reais. A checagem estática `scripts/qa/verify-corridas-sensitive-rpc-acl-v1.mjs` mantém o contrato no CI. O preflight de catálogo Corridas passou **58/58** dependências, incluindo estas seis novas assinaturas.

**Evidências:** [GitHub Actions 41762630268](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41762630268), **3/3 jobs WEB SUCCESS**, incluindo PostgreSQL 17 isolado e builds WEB. O preflight de liberação Corridas passou a ter **15 gates obrigatórios**, dos quais **10 FAIL na produção** (um novo gate obrigatório `sensitive_admin_and_pix_rpc_acl_restricted` ainda aguarda aplicação da migração). Entregas mantém **10/13 FAIL**: total atual **20 gates obrigatórios FAIL**. A alteração não foi aplicada em produção.

Referência de remediação do próprio Supabase Security Advisor:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### BILLING-BLOCKERS — Assinaturas mensais não podem ser liberadas com provider aposentado

**Fato confirmado via catálogo de Entregas:** `public.merchant_subscriptions` possui a restrição `merchant_subscriptions_provider_check: CHECK (provider = 'mercadopago')`. Isso significa que registrar uma assinatura com outro provider, qualquer que seja ele, falharia antes da integração, mesmo se a API e o pagamento já estivessem prontos. O provedor futuro de cobrança recorrente ainda precisa ser escolhido e integrado; **não foi autorizado criar contrato, creditar assinaturas fictícias ou remover essa restrição sem o fluxo financeiro correspondente**. A exigência comercial do estabelecimento continua **R$ 69,90/mês**.

**Fato confirmado em Corridas:** `private.driver_subscription_allows_rides(text)` atual verifica apenas se o status textual é `active`, `ativa` ou `teste`; ele não verifica comprovante de pagamento nesta função. A migração staged `20260905162500_remove_retired_driver_subscription_gates.sql` remove essa dependência legada das operações, mas **não implementa um novo comprovador de mensalidade independente**. Portanto, **esta migração não deve ser implantada em produção como desbloqueio comercial de motoristas**. Antes do deploy, é obrigatória uma decisão aprovada sobre provider, evidência de pagamento, prazo de vigência, exceções de teste, expiração, cobrança R$ 49,90/mês e fail-closed. Preservar esta regra é obrigação de lançamento, não opcional.

**Nenhuma alteração feita:** constrangimentos de provider em produção, flags financeiras, registros de assinatura, pagamentos, submódulos, workflows, branch main, bancos de produção ou APKs. Os testes atuais permanecem úteis para validar a proteção operacional, mas **não** homologam cobrança mensal nem autorizam publicação.

---

### 04/11/2026 — Corridas: bloqueio explícito contra perda da mensalidade R$49,90

A leitura real, estritamente somente SQL `SELECT`, encontrou `public.driver_memberships`, `public.driver_membership_charges` e `public.app_settings.finance.driver_monthly_fee_cents=4990`. A tabela de mensalidades restringe `monthly_fee_cents = 4990`, a de cobranças restringe `amount_cents = 4990`, ambas têm RLS ativo e políticas de **leitura própria** para motoristas autenticados; não há políticas de escrita `INSERT/UPDATE/DELETE` para motorista. Ambas as tabelas estão **sem qualquer linha** neste momento (0 memberships e 0 charges). A tabela de memberships aceita somente os provedores históricos `asaas` e `mercadopago`, não existindo um fluxo atual confirmado de emissão e conciliação de pagamentos das mensalidades. A função legada `private.driver_subscription_allows_rides(text)` continua aceitando somente o **texto** `active/ativa/teste`, sem recibo, período pago ou cobrança conferida.

**Falha material previamente detectada:** a migração staged `supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql`, se aplicada no estado anterior, retiraria todos os bloqueios ligados à mensalidade das operações dos motoristas, enquanto nenhuma verificação independente de pagamento foi implementada. Os testes PostgreSQL anteriores exercitavam deliberadamente a parte operacional **sem mensalidade** e não garantiam o contrato comercial.

**Correção preventiva efetiva:** a migração agora inicia com `DO $apois_driver_monthly_billing_release_hold$ ... RAISE EXCEPTION 'APOIS_DRIVER_MEMBERSHIP_RELEASE_BLOCKED...' USING ERRCODE='55000'`. Essa trava **é incondicional**, impede executar a migração inteira mesmo em tentativa manual ou automatizada e não altera qualquer sistema existente. Exige uma futura correção revisada e autorizada, com provider definido e ativo, callbacks idempotentes, verificações server-side do pagamento mensal de R$49,90 e do prazo de validade, tratamento de estorno/cancelamento e testes negativos de acesso. Não existe bypass de testes ou autorização baseada só em `subscription_status`.

**Prova de falha segura:** `scripts/test-cash-postgres-isolated-v1.sh` tenta executar o arquivo **inteiro sem modificação** em um banco PostgreSQL 17 descartável e exige erro SQLSTATE `55000` com marcador específico antes que qualquer função operacional seja substituída. Se a execução completar, falhar por outro motivo ou modificar os RPCs, o CI falha. `scripts/qa/verify-driver-monthly-release-hold-v1.mjs` também fixa a ordem dessa trava. A validação operacional sintética das funções extraídas continua sendo executada **somente para diagnosticar segurança/funcionalidade**, sem liberação comercial.

**Diagnóstico read-only versionado:** `database/review/20261104_corridas_driver_monthly_billing_READ_ONLY.sql`, executado no projeto Corridas oficial, registrou **4 dos 6 gates obrigatórios cumpridos** (preço, restrições de 4990 centavos nas duas tabelas, RLS) e **2 dos 6 pendentes** (helpers/RPCs sem evidência obrigatória de pagamento). Os dois indicadores informativos de memberships e cobranças confirmadas são falsos, pois as tabelas estão vazias. Esse diagnóstico não comprova pagamentos nem serve como autorização para produção.

**Contrato imutável de negócio:** mensalidade motorista **R$49,90**; mensalidade estabelecimento **R$69,90**. A restrição do provedor de estabelecimentos continua inalterada. Os gates de deploy permanecem bloqueados, e os aplicativos Android ainda não estão homologados.

---

### FIN-ACL-20261104 — privilégio TRUNCATE indevido em tabelas de mensalidade

**Achado real, somente leitura, Supabases oficiais:** a revisão de `pg_class`, `pg_policies`, `has_table_privilege` e do catálogo confirmou **cinco** tabelas financeiras em dois bancos com RLS ativo, políticas SELECT apenas para usuário/estabelecimento próprio ou administrador e, ao mesmo tempo, privilégios `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` concedidos amplamente a `anon` e `authenticated`. São:

- Corridas: `public.driver_memberships`, `public.driver_membership_charges`.
- Entregas: `public.merchant_subscriptions`, `public.merchant_subscription_payments`, `public.merchant_subscription_events`.

**Risco:** RLS cobre DML por linha, mas não substitui os privilégios de tabela nem protege `TRUNCATE`; não foi executada nenhuma tentativa de `TRUNCATE` ou alteração na produção, nem foi demonstrado acesso arbitrário via REST. Trata-se de concessão excessiva comprovada no catálogo. A orientação oficial do Supabase enfatiza que grants e políticas RLS precisam ser configurados separadamente: https://supabase.com/docs/guides/database/postgres/row-level-security .

**Correções preparadas, sem deploy:**
1. `supabase/corridas-forward-migrations/20261104043000_restrict_driver_membership_financial_table_acl.sql` revoga privilégios amplos das duas tabelas para `PUBLIC/anon/authenticated`, concede apenas `SELECT` a `authenticated` e retém permissões completas para `service_role`.
2. `supabase/entregas-forward-migrations/20261104044500_restrict_merchant_subscription_financial_table_acl.sql` aplica o mesmo padrão às três tabelas de assinaturas, pagamentos e eventos. Todas as políticas RLS SELECT anteriores permanecem intactas, inclusive visualização de todas as assinaturas por administradores autenticados autorizados.

**Testes executados em PostgreSQL 17 descartável:** os scripts `scripts/qa/corridas-driver-monthly-table-acl-fixture-v1.sql`, `scripts/qa/corridas-driver-monthly-table-acl-assertions-v1.sql`, `scripts/qa/entregas-merchant-subscription-acl-fixture-v1.sql` e `scripts/qa/entregas-merchant-subscription-acl-assertions-v1.sql` reproduzem grants excessivos e políticas RLS de leitura em identidades sintéticas, aplicam os arquivos SQL de migração reais, negam acesso anônimo, `TRUNCATE` e `UPDATE` autenticados, preservam leitura do próprio motorista/estabelecimento, e preservam leitura de dois estabelecimentos por administrador autenticado. A existência de políticas no esquema simplificado não é equivalente a homologação integral do Supabase Auth ou REST.

**Evidências CI:** [41765399833](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41765399833) — Corridas 3/3 jobs WEB SUCCESS. [41765926316](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41765926316) — Entregas **3/3 jobs WEB SUCCESS**. Logs verificaram explicitamente leitura própria por estabelecimento, leitura administrativa autorizada, negação de `UPDATE`/`TRUNCATE` e preservação dos registros sintéticos. Verificadores estáticos `scripts/qa/verify-corridas-monthly-table-acl-v1.mjs` e `scripts/qa/verify-entregas-subscription-table-acl-v1.mjs` foram ligados ao runner descartável.

**Gates read-only:** foram adicionados `driver_monthly_tables_least_privilege` e `merchant_billing_tables_least_privilege` aos preflights oficiais. Com as migrações ainda não aplicadas, ambos devem continuar FAIL. Leitura mais recente dos preflights: **Corridas 11/16 gates obrigatórios FAIL; Entregas 11/14 FAIL**, **22 gates pendentes** no total. A elevação do número de gates representa a descoberta de duas novas exigências, não regressões de produção.

**Mantido:** preço mensal dos motoristas R$49,90; preço dos estabelecimentos R$69,90; regra de assinatura obrigatória; constraint histórica dos provedores; ausência de pagamentos inventados; migração operacional Corridas com HOLD incondicional; sem alterações em bancos produtivos, interfaces, submódulos, workflows ou APKs. Ainda será preciso validar ACLs e acessos reais com API/JWT e esquema completo em homologação antes de implantar.


---

## Continuação autônoma — 04/11/2026: reversão do desvio de mensalidade e regressão

**HEAD de referência lido antes das alterações:** `821b8f89802a22e1c98eefa28078eb2b8fbbd82a`, sete commits além de `c405e8e0990268872033949e2ed531ab3fc1863a`. Os sete commits introduziam motorista **R$59,90** e uma estrutura adicional de cobrança de entregadores, incompatíveis com a autorização atual de **R$49,90/mês para motoristas** e **R$69,90/mês para estabelecimentos**, sem criação de novos recursos pagos.

**Correção e integridade:**
- `e52e83c7d9237994bf65586ad019b87348fada3a`: reversão não destrutiva dos sete commits, preservando histórico e restaurando exatamente a árvore de arquivos de `c405e8e`. Nenhum force-push, merge, source-lock ou submódulo modificado.
- `c380264704b484f55593a9e56584c64e7c3f0109`: adicionado guard de regressão de R$49,90 em `scripts/qa/verify-driver-monthly-release-hold-v1.mjs`.
- `25599df0980d4e732ab0bb1edf750d24f3199da8`: guard ajustado para comparar o marcador exato de bloqueio financeiro. Comparação com `c405e8e` mostrou somente esse arquivo de QA diferente após a reversão.

**Confirmação SQL em produção SOMENTE-LEITURA, 04/11/2026:**
- Supabase Corridas `tbbzkrfupmqdywnzgnms`: `finance.driver_monthly_fee_cents=4990`; duas constraints financeiras correspondem a **4990**; **0** linhas de memberships e **0** de charges no instante da leitura.
- Supabase Entregas `ptgkwyyolrdgnqketkjj`: `merchant_monthly_amount_cents=6990`; as tabelas de nova mensalidade de entregador não existem.
- Preflights de liberação oficiais executados integralmente como `SELECT` sem mutação: **Corridas 5/16 obrigatórios PASS e 11/16 FAIL**; **Entregas 3/14 PASS e 11/14 FAIL**; portanto **22 gates obrigatórios pendentes**. Gates falhos não foram ocultados ou marcados como aprovados.

**Validação:** [GitHub Actions 41801092863](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41801092863) — **3/3 jobs WEB SUCCESS** após o guard, incluindo PostgreSQL 17 descartável, builds web de cliente, estabelecimento, parceiro, verificação das restrições de cobrança e renderização pública isolada. Log registra `[PASS] Corridas driver fee is pinned at R$49.90; no new paid membership unlock`, `[PASS] Full staged Corridas migration fails SQLSTATE 55000` e `[PASS] Billing data unchanged and R$49.90 constraint preserved`.

**Restrições e pendências preservadas:** nenhum pagamento real, Pix, saldo, cobrança, pedido, corrida ou aprovação criado/alterado em produção; nenhuma migração/Edge aplicada, deploy produtivo, APK/AAB, PR merge, nova infra paga ou alteração a `sources/`/source-lock. CI verde não equivale a E2E real Android ou schema integral Supabase. A homologação de liberação permanece **BLOQUEADA** até staging compatível, autenticação/RLS testadas integralmente, mensalidades verificadas por provedor aprovado, testes de dinheiro com contas QA autorizadas, 13 fotos, GPS, push, PIN, navegação e dispositivo físico.


---

## Concorrência real de aceite e ACL de administração financeira — 04/11/2026

**Alvo único:** \`apoistecnologia-gif/apois-superapp\`, branch de homologação. O trabalho não modifica \`sources/\`, submódulos, source-lock, workflow ou qualquer serviço de produção.

**Corridas — concorrência entre dois motoristas autenticados em PostgreSQL real isolado:**
- Commit [a2a848f](https://github.com/apoistecnologia-gif/apois-superapp/commit/a2a848f280dc27432d4584615b956d23b092038c): criados \`scripts/qa/ride-acceptance-race-fixture-v1.sql\`, \`scripts/qa/ride-acceptance-race-assertions-v1.sql\` e \`scripts/qa/test-ride-acceptance-race-v1.sh\`; integrados ao runner PostgreSQL 17 existente.
- O teste cria **dois motoristas sintéticos** aprovados, online, com KYC sintético e GPS recente, e **uma única corrida cash direta** oferecida a ambos. Duas conexões \`psql\` independentes disputam a mesma corrida: a primeira mantém uma transação aberta; a segunda é observada por \`pg_stat_activity\` em espera de \`Lock\`. Após o commit da primeira, a segunda deve receber \`ride_offer_unavailable\` e não deixar atualização residual em \`candidate_driver_ids\`. O teste falha caso ambos aceitem, caso não haja espera de lock ou caso o perdedor receba erro diferente.
- Evidência: [GitHub Actions 41803412293](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41803412293) — **3/3 jobs WEB SUCCESS**. A concorrência rodou em PostgreSQL 17 descartável, não em Supabase produção. Não substitui testes com JWT, esquema completo, RLS/locks reais da produção ou dispositivos Android.

**Entregas — ACL mínima de RPCs administrativas financeiras:**
- Leitura de catálogo **exclusivamente SELECT** no Supabase Entregas \`ptgkwyyolrdgnqketkjj\` comprovou que cinco funções públicas \`SECURITY DEFINER\` tinham permissão \`EXECUTE\` para \`anon\`, apesar de seus corpos verificarem \`public.current_user_is_admin()\`: \`admin_settle_payout\`, \`admin_update_platform_setting\`, \`admin_create_fee_rule\`, \`admin_update_fee_rule\` e \`admin_set_fee_rule_active\`. Isto é exposição desnecessária de superfície, **não demonstra** que anônimos já conseguiam alterar pagamentos, tarifas ou configurações.
- Commit [b662836](https://github.com/apoistecnologia-gif/apois-superapp/commit/b6628366dfde9229e41de82683dd6031428d1e0b): migração **não aplicada** \`supabase/entregas-forward-migrations/20261104060000_restrict_critical_admin_finance_rpc_acl_NOT_DEPLOYED.sql\` revoga EXECUTE de \`PUBLIC/anon\` somente nessas cinco funções, preservando \`authenticated\` e \`service_role\`. Não modifica nenhum corpo, saldo, transferência, tarifa nem configuração.
- Novos fixtures e assertions PostgreSQL 17, com **corpos sintéticos sem efeitos**, verificam assinatura e defaults originais, ACL após a migração, manutenção do \`pg_get_functiondef\` e tentativa de chamada de payout negada a \`anon\`. O CI de [41803901659](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41803901659) registrou **PASS no passo PostgreSQL descartável**; a conclusão agregada de builds/renderização WEB ainda estava pendente no instante desta anotação.
- A função real \`admin_settle_payout\` foi examinada por catálogo e aceita mudança administrativa de estado para \`paid\` com identificador textual de provedor, além de alterar o ledger. Embora haja validação interna de administrador, o teste de ACL **não comprova liquidação bancária nem autenticidade de recibos de provedor**. Essa integração financeira permanece fora da fase cash e requer revisão específica, sem marcar pagamentos como concluídos.

**Restrições preservadas:** motorista R$49,90/mês; estabelecimento R$69,90/mês; pagamento eletrônico desabilitado; nenhum PIX, payout, saldo, pedido, motorista ou estabelecimento de produção alterado. Não criados recursos pagos, Supabase staging, deploys, APKs ou merges. O bloqueio de homologação por gates PostgreSQL e testes Android permanece até validação separada.

**Referência Supabase Security Advisor:** https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
