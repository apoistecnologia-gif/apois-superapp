# APOIS — Homologação em dinheiro, sem Safe2Pay (03/11/2026)

**Decisão comercial do responsável:** Safe2Pay é o provedor eletrônico escolhido, mas o contrato/conta exige regularização antes de utilizá-lo. A homologação agora será **exclusivamente por pagamento em dinheiro direto**, sem Pix real ou simulado pela Safe2Pay, sem cartão via gateway, sem split eletrônico e sem disparar webhooks financeiros. A decisão NÃO aposenta nem substitui a Safe2Pay.

## Proteções absolutas

- Usar somente a branch \`fix/entregas-homologacao-ajustes-20261030\` de \`apoistecnologia-gif/apois-superapp\` até os testes serem aprovados.
- Os submódulos em \`sources/\` e o \`source-lock\` ficam pinados; alterações de homologação acontecem nas cópias de integração e hardeners da branch.
- Não rodar pagamentos reais, Pix, cartão, split, repasses bancários, manipulações de saldo, assinatura fictícia, cadastro/ordens/corridas de teste em produção ou migrações sem revisão e E2E isolado.
- Não promover Vercel Preview para produção, não alterar autenticação/RLS para dar acesso público, não desativar SSO e não gerar APK como "homologado" só porque o CI WEB passou.
- A opção dinheiro representa pagamento fora da APOIS. Em **Entregas**, um pedido `cash` mantém `payment_status=pending` porque a APOIS não verifica o dinheiro físico. Em **Corridas**, a solicitação começa `pending`, mas o gatilho de conclusão atual registra `payment_status=paid` como quitação operacional presumida ao encerrar a viagem, sem confirmação externa. Isso NÃO representa Pix/cartão nem saldo de carteira: `payment_provider=null`, `wallet_amount=0`, `platform_fee=0`. Confirmar o recebimento físico é parte do teste.
- Os motoristas recebem o valor integral da corrida diretamente. O estabelecimento responde pelos recebimentos dos pedidos e pelo repasse manual acordado com o entregador.

## Estado técnico verificado no banco real, somente leitura — 03/11/2026

### Corridas — Supabase \`tbbzkrfupmqdywnzgnms\`

- \`app_settings.finance.ride_electronic_payments_enabled = false\`: **PASS**.
- \`apois_rpc_private.driver_accept_ride\` possui boundary de método: **PASS estrutural**, não substitui E2E.
- \`apois_rpc_private.driver_set_presence\` verifica KYC: **PASS**, não fazer bypass.
- **P0/BLOCK:** quatro funções ainda mencionam \`private.driver_subscription_allows_rides(v_driver.subscription_status)\`, o gate legado de cobrança: \`apois_rpc_private.driver_set_presence\`, \`driver_accept_ride_candidate_legacy\`, \`driver_finish_ride\` e \`private.enforce_driver_operational_stage_transition\`. Podem interferir em online, aceite de oferta, estágio e fila de próxima corrida.
- A correção SQL pré-existente na branch é \`supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql\`. **Não aplicar em produção automaticamente**: testar assinatura, chamadores, KYC/ownership e corrida em PostgreSQL isolado antes.
- O gatilho real `public.handle_completed_ride_settlement()` foi examinado: ao finalizar uma corrida `cash`, registra `wallet_amount=0`, `platform_fee=0`, `payment_provider=NULL` e `payment_status=paid` como quitação física presumida. Não existe confirmação bancária. A forma de conferir recebimento e lidar com contestação deve ser testada antes da liberação.
- Run apenas-leitura: `database/review/20261103_corridas_cash_homologacao_READ_ONLY.sql` — 4 gates legados `false`; validação de não-creditamento cash na carteira e sinalização informativa da quitação automática.

### Entregas — Supabase \`ptgkwyyolrdgnqketkjj\`

- \`create_order_atomic\` suporta \`cash\` e inicia \`payment_status='pending'\`: **PASS**.
- \`platform_settings.courier_payout_mode='merchant_manual'\`: **PASS**. \`get_delivery_checkout_readiness()\` reconhece \`merchant_manual\`: **PASS**.
- **P0/BLOCK:** ainda não há as políticas genéricas previstas de leitura pelo membro do estabelecimento para \`orders\`, \`order_items\` e \`order_status_history\` de pedidos \`cash/pending\` (3 gates \`false\`). Em seu lugar existem políticas antigas "paid" e políticas específicas **APOIS test cash** usando \`private.apois_test_cash_orders\`; as exceções de QA não comprovam que todos os estabelecimentos podem operar com dinheiro.
- **P0/BLOCK:** \`public.merchant_reject_order(uuid,text)\` ainda restringe cancelamento comum a pedidos \`paid/refunded\`; não libera rejeição de pedido \`cash/pending\` para membro do estabelecimento (1 gate \`false\`). Não transformar \`cash\` em \`paid\` para contornar.
- A migração já versionada é \`supabase/entregas-forward-migrations/20260905113000_allow_direct_cash_order_operations.sql\`. **Não aplicar na produção antes do E2E isolado e revisão de RLS, permissões de membros, pedidos pagos/refund e reversão**.
- Configuração futura \`order_payment_provider='safe2pay_marketplace'\` permanece armazenada no banco: **não significa que cash precise chamar o provedor**. O checkout de integração só permite \`cash\`.
- Run da auditoria apenas-leitura: \`database/review/20261103_entregas_cash_homologacao_READ_ONLY.sql\` — 4 gates críticos \`false\`, 3 \`true\`, 1 informativo.

## Alterações de código e testes sem transações

- \`supabase/functions/create-order/index.ts\`: agora só aceita como resultado autoritativo de criação \`payment_method='cash'\` **e** \`payment_status='pending'\`. Estados \`paid\`, \`failed\`, \`cancelled\`, \`refunded\` e \`processing\` são inconsistências, nunca um sucesso de criação.
- \`scripts/verify-entregas-direct-order-contract.mjs\`: protege o novo contrato estrito.
- \`scripts/test-entregas-cash-create-order-isolated-v1.mjs\`: executa o **handler TypeScript real** com \`vm\` e cliente Supabase fictício, sem rede, sem credencial real, sem enviar cobranças. Casos: cash/pending, checkout entrega/retirada, dados autorizados do usuário, endereço salvo, Pix/cartão/carteira bloqueados, autenticação, itens, estados inesperados e erros.
- \`scripts/audit-payment-boundary.mjs\`: liga os testes acima ao CI WEB-only existente. Safe2Pay permanece com testes de regressão 100% simulados, sem interação externa.
- Os hardeners de Cliente Corridas já expõem recebimento direto \`cash\` e \`credit\`; para o teste físico escolher **somente dinheiro**, não alterar a capacidade futura de cartão direto.
- O Admin segue atrás de Vercel SSO. Visual da tela de login aprovado, mas E2E autenticado e serviço privado de documentos continuam pendentes; não inserir segredo \`service_role\` em frontend.

## Ordem da homologação CASH controlada (obrigatória)

**Etapa 1 — Bancos isolados (sem dados reais):** revisar e aplicar em staging separado as duas migrações listadas, preservando KYC/ACL. Testar via papéis de usuário realistas: cliente, estabelecimento, entregador, motorista aprovado, motorista não aprovado e admin. Confirmar que não existe alteração de saldos, \`payments\` ou reembolso automático.
**Etapa 2 — Cliente Entregas + Estabelecimento:** checkout somente em dinheiro; pedido \`cash/pending\`; lista, itens e histórico visíveis para o estabelecimento correto; outro estabelecimento não enxerga; aceitação/preparo/cancelamento sem reembolso de gateway; idempotência de reenvio.
**Etapa 3 — Entregador:** restaurante solicita entregador; distribuição/notificação e aceite, localização, entrega e conclusão; estabelecimento marca repasse manual e entregador confirma; uma confirmação não duplica saldo.
**Etapa 4 — Passageiro + Motorista:** selecionar dinheiro; valor calculado no backend; busca/aceite, PIN, rota até embarque e destino, voz, chegada e finalização; pagamento físico ao motorista e recibo **não eletrônico**; testar fila de próxima corrida sem assinatura antiga.
**Etapa 5 — negativos/segurança:** cancelamento, multa e bloqueio por dívida quando previsto, notificações, histórico, offline/reconexão, reabertura de app, acesso cruzado entre usuários, validações de 13 fotos e área de atuação.
**Etapa 6 — APKs de TESTE:** build Android de homologação assinado em ambiente QA, sem declaração de release; instalação em dispositivos reais, teste de login/Google/OTP, câmera, GPS/Google Maps, push e recuperação de sessão. Stage2 de 13 fotos somente depois de validar fluxo de upload/aprovação, conforme política anterior.

### Requisitos adicionais do motorista já fornecidos pelo proprietário

A lista \`OQUE PRECISA TER NO APP DO MOTORISTA.pdf\` solicita, entre outros: multas de cancelamento visíveis na carteira e bloqueio de novas corridas por dívida; botão voltar em menus e no Android; foto do motorista; PIN; rotas e voz até embarque/destino com possibilidade de desativar; oferta com dados e avaliação do passageiro, distância até embarque e destino, valor e KM; corrida sobre o mapa; próximo pedido próximo ao destino da viagem ativa; rating e carteira. **Não afirmar E2E aprovada com base em checagens WEB estáticas.**

## Decisões e dependências que ainda exigem alinhamento

- Em Entregas com **delivery em dinheiro**, definir quem recebe fisicamente do consumidor (entregador versus estabelecimento), como comprova e como acerta esse valor. Isso é diferente do repasse manual do estabelecimento ao entregador. Não pressupor que o entregador sempre recolha dinheiro.
- Mensalidade de motorista/estabelecimento: teste de uso do aplicativo não equivale a pagamento de mensalidade. Não ativar assinaturas fictícias nem marcar \`paid\` apenas para abrir a tela; usar contas e políticas de QA autorizadas.
- Sem regularização Safe2Pay, todo pagamento eletrônico integrado, split, webhooks de produção, estorno e conciliação continuam fora do escopo. Eles voltam a ser avaliados posteriormente.
- Admin Corridas Preview: documento privado tem fail-closed por ausência de \`CORRIDAS_SUPABASE_SERVICE_ROLE_KEY\`, exigindo solução isolada e autorizada; backend de fotos não foi validado em conta real.
- Testes remotos protegidos Vercel 403 exigem autorização da conexão, não desativação de SSO.
- Maps/GPS, push, upload da vistoria de 13 fotos, segurança real Auth e liberação Android ainda dependem de execução física/ambiente de staging.

**Status geral:** build WEB aprovado antes destas alterações; a homologação com dinheiro ainda está **BLOQUEADA** pelos 8 gates SQL observados, mesmo que os testes unitários de cash passem. Não anunciar pronto para produção ou liberar APK como final.
