# APOIS — continuidade real da homologação (02/11/2026, fuso America/Fortaleza)

**Único repositório alterado:** `apoistecnologia-gif/apois-superapp` na branch `fix/entregas-homologacao-ajustes-20261030`.
**Último HEAD de código validado:** `404aa1bf39ccf0d93101f1ba83f09961f238402a`.
**Execução de preflight:** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41564251300 — **3/3 sucesso**, WEB-only, sem APK.
**Condição de homologação Android:** NÃO LIBERADA. Não houve merge, publicação, deploy manual, SQL DDL, estorno ou alteração de aprovação, estado de cliente ou saldo.

## Escopo e preservação

- Supabase Corridas: `tbbzkrfupmqdywnzgnms`; Supabase Entregas: `ptgkwyyolrdgnqketkjj`.
- Sem alteração dos repositórios-fonte protegidos, source-lock e submódulos. O diff final contém código de teste e um webhook de homologação, sem alterar o binário/fonte oficial.
- Migrações já aplicadas em Corridas `20261103013336` e `20261103013400` confirmadas no histórico; não reaplicadas.
- Gateway eletrônico escolhido: Safe2Pay; não reativar Asaas/OpenPix/Mercado Pago.

## Correção do webhook — somente versão preparada, não implantada

Arquivo `supabase/functions/safe2pay-webhook/index.ts` adicionado à branch a partir do conteúdo ativo. Corrige reenvio quando uma escrita intermediária falha, não confia em `processed_at` isolado, usa `event_key` idempotente, confere linhas realmente atingidas, mantém atualizações concorrentes condicionais, verifica se o domínio corresponde a método/estado e evita regravar um pedido/corrida já pago ou estornado.

**Prova:** `scripts/test-safe2pay-webhook-retry-v1.mjs` passou com **10 cenários simulados** no gate original `npm run audit:payment-boundary`, incluindo segredo inválido, falhas parciais, reenvio, atualizações de zero linhas, estado fora de ordem, estorno, discrepância de referência e falha ao concluir evento. O gate original de `package.json` foi mantido. A versão ativa nas duas Edge Functions foi reinspecionada e permanece com SHA `2f1e58d94c1dfe3990aba6a21b5157d0b147e190cc72425ea55290f40a16bf71`; nenhuma Edge foi redeployada.

**Bloqueio:** a solução preparada ainda usa várias escritas independentes e NÃO constitui atomicidade PostgreSQL entre transação, pedido/corrida e evento. Exige RPC/transaction revisada, conciliação com provedor, testes reais isolados e decisão explícita de deploy. **Não implantar a Edge Function como está.**

## Corridas: cadastro e vistoria

- Função ativa `apois_rpc_private.driver_complete_registration_v3` rebaixa o motorista aprovado em um UPSERT; comprovado em `pg_get_functiondef`.
- Proposta de proteção `database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql` segue **NÃO APLICADA**.
- Adicionado `scripts/test-driver-registration-guard-review-v1.mjs` e integrado ao preflight existente `scripts/audit-partner-preflight-v1.mjs`: verificações estáticas de lock `FOR UPDATE`, bloqueio `aprovado/suspenso/bloqueado` antes de alterar `users/user_roles/drivers`, sete fixtures de status e preservação de regras antigas. Gate aprovado em 41564251300. **Não é teste E2E PostgreSQL.**
- Consulta real sem alterações: **2** contas com papel `driver` sem linha em `drivers`; **3** motoristas `carros` aprovados sem linha de foto de inspeção (legados). Buckets `apois-inspections` privado, zero objetos; zero fotos, zero solicitações de correção e zero eventos de revisão na nova estrutura.
- Os três triggers de Stage2 (vistoria, snapshot frontal, correções) não constam ativos na tabela `drivers`; migração `20261031_vehicle_13_photos_STAGE2_ONLY_AFTER_APP_RELEASE.sql` permanece **não aplicada** para preservar cadastros legados. Fluxo de compressão/upload/revisão é verificável em código e bundle WEB, não em telefone real.

## Privilégios pendentes — NÃO ALTERADOS

**Corridas:** `public.get_asaas_subaccount_secret(uuid)` e `public.store_asaas_subaccount_secret(uuid,text)` possuem `EXECUTE` concedido a `anon` e `authenticated`. Sem chamadores de outras funções PostgreSQL identificados em busca somente de leitura. Revisão em `database/review/20261102_corridas_asaas_vault_rpc_privileges_REVIEW_ONLY.sql`.

**Entregas:** `public.dispatch_delivery_job_offers(uuid)`, `public.ensure_cancelled_paid_order_refund(uuid)`, `public.reserve_paid_order_merchant_net(uuid)` e `public.reverse_paid_order_merchant_reserve(uuid)` permanecem com `EXECUTE` amplo. Chamadores internos de dispatch/reserva envolvem funções `SECURITY DEFINER` (entre elas `merchant_request_courier`, `set_courier_online`, `reject_delivery_offer`, `dispatch_new_delivery_job`, triggers). **Não revogar indiscriminadamente sem E2E e rollback.** Revisão em `database/review/20261102_entregas_privileged_rpc_least_privilege_REVIEW_ONLY.sql`. As tentativas anteriores foram bloqueadas pelas ferramentas; não contornar.

## Histórico financeiro a conciliar, sem executar estornos

Na base Entregas, **2** pedidos cancelados e marcados como pagos possuem **2** pagamentos OpenPix registrados, total nominal **R$ 149,60**, de **16/08/2026**, com duas referências distintas, dois eventos `OPENPIX:CHARGE_COMPLETED` processados, e **0** registros de estorno. Não há prova suficiente para concluir recebimento efetivo, origem produção/teste ou reembolso externo. Precisa extrato da adquirente / conciliação documental; nenhum saldo, pedido ou pagamento modificado.

## Admin e homologação real

O build de Admin Corridas tem correções em workspace isolada e autorização privada de documentos preparada. A inspeção conectada do projeto Vercel QA identificado historicamente (`apois-corridas-admin-homologacao`, equipe antes documentada) retornou **404 project_not_found** nesta sessão; não é possível comprovar seu deploy atual ou realizar E2E autenticada. Não ajustar produção para resolver erro de preview sem confirmar conta/equipe/projeto.

O preflight 41564251300 comprova três jobs WEB (Cliente, Estabelecimento/Admin Entregas, Parceiro/Admin Corridas) e screenshots anônimos em navegador, não GPS real, push em background, Safe2Pay real, upload físico das 13 imagens, revisão Admin autenticada, PIN/corrida física ou tela de recuperação móvel.

## Próximos gates antes de APK

1. Resolver as seis RPC privilegiadas com revisão de funções chamadoras, permissões mínimas, rollback, intervenção autorizada e testes isolados.
2. Implementar e homologar conciliação Safe2Pay atomicamente no PostgreSQL; bloquear liberação do webhook staging enquanto ela estiver incompleta.
3. Aplicar a guarda do cadastro apenas após homologação PostgreSQL com diferentes estados, garantindo não rebaixar aprovados.
4. Testar o fluxo de 13 fotos no Android com conta de teste, Storage/Admin, reprovações/reenvios, notificações e compatibilidade legada antes de Stage2.
5. Validar Vercel QA com projeto/equipe realmente acessíveis, segredos apenas server-side e E2E de Admin; verificar telas e fluxo operacional em Android físico.
6. Validar OpenPix por prova externa antes de qualquer estorno, mantendo ledger/saldos intactos.

**Proibido afirmar liberação de APK enquanto os gates acima estiverem pendentes.**


---

## Continuação executada — 02/11/2026 (fuso America/Fortaleza; CI em 03/11 UTC)

**HEAD de código homologado:** `c0a0f87ca73ee222fa128a6e89e47415b4dd4f23`.
**CI oficial:** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41566914007 — **3/3 jobs SUCCESS**, todos WEB-only, sem APK, sem deploy.

### Safe2Pay: preparação transacional, produção intacta

- Corridas: `database/review/20261103_safe2pay_corridas_atomic_REVIEW_ONLY.sql`.
- Entregas: `database/review/20261103_safe2pay_entregas_atomic_REVIEW_ONLY.sql`.
- Edge QA: `supabase/functions/safe2pay-webhook/index.ts` substitui gravações REST independentes por **uma RPC** (`apois_safe2pay_apply_event_atomic`) que exige `service_role` e retorna erro não-2xx se função inexistente ou DB falhar. Shared secret continua validado antes da RPC. Não divulgar o segredo.
- Contratos preparados: `FOR UPDATE` na transação e pedido/corrida, event_key único, atomicidade PostgreSQL, proteção contra pagamentos de outro provedor, replays, eventos atrasados, detecção de estado terminal, chargeback e autorização tardia após failed/expired encaminhados para revisão humana e HTTP não-2xx. Nenhum reembolso, payout ou ledger é criado automaticamente.
- **Teste verdadeiro nesta rodada:** 14 cenários isolados **simulados** executados pelo gate financeiro existente, resultado `[PASS] 14 Safe2Pay isolated tests`. Isso é prova de contrato e de callback, **NÃO** é execução real do SQL em PostgreSQL, nem chamada ao provedor financeiro.
- Consultas no Supabase: nova RPC **não existe em produção** em Corridas nem Entregas; tabelas de eventos Safe2Pay com zero linhas no momento da leitura. **Não implantar webhook QA antes da aprovação, teste de transação DB real e aplicação ordenada da migration correspondente.**

### Motorista e vistoria: correção real apenas em geradores de workspace

- `scripts/fix-partner-driver-vehicle-photo-upload-v1.mjs`: introduz `registrationAttempted` antes da chamada de cadastro. Se houver resposta ambígua da rede, não apaga documentos que talvez já tenham sido registrados no servidor. Se a falha acontecer **antes** da tentativa de cadastro, limpa arquivos novos ainda sem vínculo, inclusive fotos de vistoria. Reenvia **uma única vez** a RPC idempotente das 12 imagens adicionais e preserva as fotos após commit, sem reescrever origem protegida.
- `scripts/verify-apois-vehicle-incidents-v1.mjs` e `scripts/verify-apois-13-photo-driver-pendencies-v1.mjs` ampliados para exigir a fronteira segura de limpeza e repetição. Build WEB do Parceiro/TypeScript passou pelo CI.
- `scripts/fix-partner-admin-vehicle-inspection-v1.mjs`: botão de aprovação individual fica desabilitado se a foto assinada não estiver disponível.
- Arquivos SQL somente para revisão: `database/review/20261103_corridas_inspection_front_storage_guard_REVIEW_ONLY.sql` (exige objeto frontal existente e pertencente ao motorista) e `database/review/20261103_corridas_admin_inspection_review_storage_guard_REVIEW_ONLY.sql` (exige foto existente/pertencente ao motorista antes de aprovar no backend). Ambos preservam os contratos e funções existentes; **não foram aplicados**.
- Persistem três motoristas legados aprovados sem fotos de vistoria e duas contas com papel motorista sem linha em `drivers`; nenhum registro alterado. Stage2 não aplicada; testes reais de câmera, upload, correção, push e Admin autenticado continuam pendentes.

### Acesso Vercel e segurança existente

- Equipe conectada `team_shDkxHdc4ARgsiLdRaLSz0zA` consultada diretamente: a listagem por `apois` e por `apois-corridas-admin` retornou **0 projetos** acessíveis, inclusive o projeto antigo e a prévia QA; portanto não há como certificar prévia READY nem realizar E2E autenticado nessa conexão. Não criado/recriado projeto e nenhuma produção publicada.
- ACLs Corridas Asaas (2 RPCs) e Entregas privilegiadas (4 RPCs) continuam com `EXECUTE` para `anon`/`authenticated` — confirmado por leitura nesta rodada. **Operação de revogação segue bloqueada por salvaguardas anteriores; não contornar.** Requer intervenção humana autorizada, teste de chamadores internos e rollback.
- Dois pedidos históricos OpenPix cancelados/marcados como pagos (R$ 149,60 registrados, sem estornos) permanecem **não conciliados externamente**. Não criar estorno, alterar saldos ou supor pagamento efetivo.

### Gate atual e próximos bloqueios

**NÃO PRONTO PARA APK:** dependências críticas de ACL, homologação PostgreSQL Safe2Pay, aplicação da guarda de cadastro aprovado, Stage2 com compatibilidade legada, E2E das 13 fotos e Android real, integração de mapas/push e acesso ao Vercel QA. O preflight WEB 3/3 garante apenas build/controles WEB e testes locais. Não autoriza publicação.

**Garantias desta rodada:** nenhum merge, APK, deploy, migration em produção, alteração de saldo, status de motorista ou pagamento, source-lock, fonte protegida ou submódulo.

---

## Continuação — 03/11/2026 UTC / 02/11/2026 Fortaleza — P0 integridade real antes dos APKs

**Escopo:** somente `apoistecnologia-gif/apois-superapp`, branch `fix/entregas-homologacao-ajustes-20261030`. Nenhuma mudança em `sources/`, source-lock, submódulos, produção Supabase/Vercel, APK, status de motoristas, estornos ou ledger.

### Confirmado por leitura de produção (não por simulação)

- Ativas, sem redeploy: Corridas `safe2pay-webhook` v13 SHA `2f1e58d94c1dfe3990aba6a21b5157d0b147e190cc72425ea55290f40a16bf71`, Entregas v10 mesmo SHA; ambas `verify_jwt=false` e autenticação por `SecretKey` própria.
- Ativas: `safe2pay-create-ride-pix` Corridas v14 SHA `de5d152ec393b7af12f2b1cc7ff90a550d3b0029a7b80ed1f49e7c11d2cdb76f`; `safe2pay-create-order-pix` Entregas v10 SHA `fc7876c2a39092dd03da191b3c25740cb2a39821a29ca2c44cac19d3a211880d`.
- Corridas `safe2pay_ride_transactions`: 0 registros; Entregas `safe2pay_order_transactions`: 0 registros; sem dev branches disponíveis nos dois Supabases oficiais.
- **Defeito extra:** o fluxo de criação de cobrança Pix também atualiza status fora de uma transação atômica quando a Safe2Pay responde autorizado imediatamente; em Entregas a atualização original de `orders` nem valida erro/zero linhas, e em Corridas `rides` não exige linha realmente alterada. Não é suficiente corrigir só o webhook.
- Tabelas e constraints reais foram conferidas: `provider_transaction_id` é bigint nas duas, `event_key` único, `payments` Entregas é tabela financeira separada, com outras possíveis origens. O ledger do estabelecimento (`reserve_paid_order_merchant_net` / reversão) não é automaticamente reconciliado pela proposta atual. **Bloqueia release financeiro até verificação completa**, não inventar estornos ou lançamentos.
- Duas RPCs legadas Asaas (Corridas) e quatro RPCs privilegiadas (Entregas) continuam executáveis por `anon` e `authenticated`. Os SQLs de revisão de revogação não foram aplicados porque ferramentas já haviam imposto bloqueios de segurança. Não contornar.
- A equipe Vercel conectada `team_shDkxHdc4ARgsiLdRaLSz0zA` retornou zero projetos ao pesquisar APOIS. Exige acesso à equipe correta do Admin Corridas.

### Correções de branch **não aplicadas em produção**

1. `supabase/functions/safe2pay-webhook/index.ts`: rejeita valores financeiros ausentes/nulos, bool/objetos ou centavos fracionários; desconhecidos de Safe2Pay (por exemplo 5, 7, 8, 12, 14, 15, 19) tornam-se pendência para conciliação, não falso sucesso `2xx`.
2. `database/review/20261103_safe2pay_{corridas,entregas}_atomic_REVIEW_ONLY.sql`: desconhecidos, chargeback após estorno, estorno sem autorização prévia e autorização tardia após failed/expired ficam registrados para revisão, sem marcar pedido/corrida como quitado; Entregas protege até quando o status local está inconsistente com pagamento confirmado por outro provedor.
3. `database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql`: adicionada segunda defesa no `ON CONFLICT DO UPDATE WHERE`, além do `FOR UPDATE` antecipado, para não rebaixar motorista caso o status mude por aprovação concorrente. Testes estáticos das duas proteções ampliados. **Ainda não aplicada**.
4. `supabase/functions/safe2pay-create-order-pix/index.ts`: cópia da função ativa de Entregas apenas em staging, com shared adapter em `supabase/functions/_shared/safe2pay.ts`; pagamento inicialmente autorizado passa pela RPC transacional, conflito de gravação não é ignorado, reuso de pedido pago por outro provedor não é identificado falsamente como Safe2Pay, reuso de transação autorizada exige conciliação, expirados concorrentes exigem checagem de linha e divergências de valores são bloqueadas. Não fazer deploy sem aplicação e teste da RPC de Entregas.
5. **Corridas `safe2pay-create-ride-pix`**: a tentativa de registrar a cópia corrigida da função integral na branch foi **BLOQUEADA pelas salvaguardas da ferramenta**; respeitado o bloqueio, não houve novo envio ou tentativa de contorno. A fonte ativa permanece com escrita não atômica no pagamento inicial. Isso **bloqueia homologação financeira e geração do APK** até canal autorizado resolver e testar.
6. `scripts/test-safe2pay-webhook-retry-v1.mjs`: teste de callback e contratos sem pagamentos reais, expandido para 23 verificações simuladas/estáticas com o novo fluxo Entregas, estornos fora de ordem e validação financeira; a proposta SQL ainda exige E2E PostgreSQL real e rollback em ambiente isolado.

**Documentação Safe2Pay consultada:** https://developers.safe2pay.com.br/reference/status-transacional e https://developers.safe2pay.com.br/docs/webhooks-overview (reenvio com intervalo de 5h e máximo 5 novas tentativas). Os eventos pendentes precisam de reconciliação própria; reenvio do provedor não é garantia de processamento definitivo.

### Dependências que precisam de intervenção humana autorizada

- **Vercel:** conceder acesso à equipe/projeto corretos do Admin Corridas na conexão. Compartilhar URL ou nome do projeto, nunca tokens.
- **Supabase staging:** autorizar orçamento/custo de branches descartáveis, ou disponibilizar uma instância isolada sem dados de produção, para validar transações RPC/trigger/RLS e simular falhas/reversões reais sem alterar pagamentos.
- **RPC ACL:** após testes isolados, operador autorizado deve revisar assinaturas/chamadores e aplicar os scripts de segurança no SQL Editor correto com rollback e testes de regressão. NÃO executar scripts REVIEW_ONLY indiscriminadamente em produção.
- **APKs:** aguardar resolução dos P0 acima, ledger Safe2Pay, login Admin Vercel, vistoria 13 fotos física e testes Android.

**Situação do último preflight:** ver execução GitHub Actions 41569097271 e checar o resultado conclusivo, não inferir sucesso por status in_progress. Nenhum merge ou release foi autorizado.


## Retificação verificada — acesso à Vercel (03/11/2026)

O relato anterior de "zero projetos acessíveis" foi causado pela consulta com filtro de equipe, e não pela inexistência de projetos. Na integração atual, **list_projects sem filtro teamId** retornou 8 projetos APOIS, todos do workspace \`mariajuvelina403-7231s-projects\` (teamId \`team_shDkxHdc4ARgsiLdRaLSz0zA\`). A captura enviada pelo usuário coincide com essa relação. **Não é necessário conectar outra conta Vercel**, salvo mudança futura de permissões.

- Admin Corridas existente: projeto \`apois-corridas-admin\`, ID \`prj_hQLbIy31b8lbvhQU0iz6U6u38Srq\`, domínio \`admin-corridas.apoisbrasil.com.br\`, último deploy retornado \`dpl_GzYiV4R4wVDrXHJ3KVFWSaNhAvJE\` READY, preview não equivale a teste autenticado.
- Admin Corridas homologação: projeto \`apois-corridas-admin-homologacao\`, ID \`prj_aiE8SAZZsN0qflEmMAw9qrcirQNx\`, última implantação retornada \`dpl_FTYiDQY2idiFjFM3tLUa5z2UyRxc\` ERROR, para commit \`3fc9563e6a139f0cf102e8280d7bccad12248e66\`.
- Erro retornado pelo detalhe da implantação, sem inferir causa específica: código \`ENOENT\`, comando \`cd .. && bash scripts/build-admin-vercel-preview.sh && mkdir -p admin-preview/dist && cp -a dist-admin-preview/. admin-preview/dist/\` encerrou com exit 1.
- Repositório possui \`admin-preview/vercel.json\` com esse comando e \`scripts/build-admin-vercel-preview.sh\`. Portanto, a falha pode ocorrer em um passo interno e não está provado que falte o script.
- Metadados de variáveis na Vercel homologação confirmam **nomes cadastrados no Preview**: \`APOIS_PREVIEW_GITHUB_TOKEN\`, \`CORRIDAS_VITE_SUPABASE_URL\`, \`CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY\`, \`CORRIDAS_WEB_MAPS_API_KEY\`, \`VITE_SUPABASE_URL\`, \`VITE_SUPABASE_PUBLISHABLE_KEY\`. Valores não foram lidos/descriptografados nem testados; existência do nome não comprova validade do token ou configuração.
- Tentativas de obter eventos/build logs por integração Vercel retornaram 404 para a implantação, mesmo com escopo explícito e hostname. Não contornar; pedir ao responsável apenas o conteúdo do **Build Logs** dessa implantação, nunca tokens ou valores de variáveis.
- Não houve mudança de deploy, domínio, SSO, configurações ou variáveis. Não reabilitar produção antecipadamente.

---

## Continuação verificada — 03/11/2026 — Vercel reservada e correções independentes

**Código validado:** `b16d47f44e056e17d7d132d90e6a2329a420daca`.
**GitHub Actions:** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41572311458 — `3/3 SUCCESS`, WEB-only. Evidências explícitas do job `audit-web-only`: `[PASS] 8 isolated driver review mail regressions` e `[PASS] 7 runtime pre-Auth vehicle photo cases`. Nenhuma conta real, e-mail ou upload foi produzido.

### Vercel: PENDENTE POR COTA, NÃO BLOQUEAR OUTRAS FRENTES

O log fornecido pelo proprietário identificou com precisão `scripts/build-admin-vercel-preview.sh: line 53: cmp: command not found`. Submódulos foram sincronizados e baixados sem falha impeditiva. A correção já aplicada na branch substituiu `cmp` por `node -e` que compara os dois arquivos privados byte a byte; script `scripts/verify-partner-portability.mjs` exige que a proteção permaneça. O preflight GitHub 3/3 passou no commit `ac9767f3234e8048bd4221cb64d6abfc4b3b57c8`.

A criação de nova implantação exclusivamente Preview no projeto `apois-corridas-admin-homologacao` (`prj_aiE8SAZZsN0qflEmMAw9qrcirQNx`) recebeu `402 api-deployments-free-per-day` (cota da conta esgotada, retry informado após um dia). **Reservar Vercel, sem novos deploys, sem trocar conta, sem promoção, sem alterar domínios.** Uma execução pronta no GitHub não é prova de implantação READY. Projeto principal `apois-corridas-admin` deve permanecer preservado.

### Motorista — correção implementada no gerador isolado, não na fonte protegida

Em `scripts/fix-partner-driver-vehicle-photo-upload-v1.mjs`, o pré-requisito dos 12 slots extras (13º slot frontal já obrigatório em documents) é comprovado **antes de `ensureAuthenticatedAccount`**. Exige exatamente uma foto por slot no bucket privado `apois-inspections` e payload não vazio. Impede o caso em que a documentação incompleta cria conta Auth para depois falhar. Preservadas limpeza segura antes da tentativa de cadastro, persistência após commit ambíguo e retry limitado da RPC de vistoria. O teste executa a função TypeScript preparada em VM com 7 cenários negativos/positivos e bloqueia side effects Auth sem documentos completos. O teste positivo apenas chega ao stub Auth, não cadastra motorista.

Arquivo de teste: `scripts/test-driver-registration-preauth-v1.mjs`, executado pelo gate atual `scripts/verify-apois-13-photo-driver-pendencies-v1.mjs`.

### Outbox e e-mail de correção — confirmação segura de persistência

A Edge `apois-driver-review-mailer` **já está ACTIVE v4 em Corridas** e a definição ativa tem o defeito de sucesso falso se a gravação do aceite falhar. A correção foi preparada somente em `supabase/functions/apois-driver-review-mailer/index.ts`: exige ID de recibo do provedor, executa atualização condicional `queued/failed`, lê o registro atualizado e retorna 503 se não houver confirmação; não produz sucesso artificial.

A RPC pública protegida `apois_admin_can_dispatch_driver_correction_mail(uuid)` está ativa e limita execução a staff autenticado com `users.manage`, mas atualmente não permite consulta idempotente de outbox já aceita. Foi preparado o SQL independente `database/review/20261103_corridas_mailer_outbox_idempotent_read_REVIEW_ONLY.sql` para preservar RBAC e permitir leitura de aceite previamente concluído, sem novo envio. **NÃO APLICADO.** A migration histórica de notificações foi restaurada à versão anterior; não reexecutar.

Teste `scripts/test-driver-review-mailer-reconciliation-v1.mjs`: 8 cenários isolados (auth inválida, autorização negada, sucesso persistido, erro de gravação, zero linhas, recibo ausente, erro de provedor, repetição sem segundo envio). **Sem rede/Resend real.**

Consulta apenas de leitura no Corridas: `apois_driver_correction_email_outbox` e `apois_vehicle_inspection_photos` sem registros no momento da verificação. Nenhum e-mail ou dado do usuário alterado.

### P0 ainda impedem Android

As duas funções `get_asaas_subaccount_secret` e `store_asaas_subaccount_secret` ainda têm EXECUTE por anon/authenticated em Corridas. As quatro RPCs privilegiadas de Entregas seguem pendentes. O Safe2Pay atômico está apenas em REVIEW_ONLY, a criação de cobrança Corridas permanece bloqueada por salvaguardas da ferramenta e os estornos históricos OpenPix permanecem não conciliados. É necessária homologação PostgreSQL isolada/rollback e intervenção autorizada antes de revogar permissões ou implantar rotinas de pagamento e cadastro. 13 fotos requerem teste físico e compatibilidade legada.

**Nenhum merge, APK, release, SQL DDL, saldo, status ou implantação de produção foi executado nesta etapa.**

---

## Continuação comprovada — 03/11/2026 — Safe2Pay, outbox e revisão de segurança

**Último código homologado:** `b96f33550c2d0ae26c0a4d0260fe16e4889ba2ad`.
**CI WEB (sem APK):** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41573350788 — **3/3 SUCCESS**.

### Correções reais na branch, sem deploy

- `supabase/functions/safe2pay-webhook/index.ts`: corrigida a expressão regular que rejeitava texto decimal válido como `12.50`. Continua rejeitando formatos inválidos, centavos fracionários e payload sem segredo; verificado com o código da Edge em VM e mocks.
- `database/review/20261103_safe2pay_corridas_atomic_REVIEW_ONLY.sql` e `database/review/20261103_safe2pay_entregas_atomic_REVIEW_ONLY.sql`: estorno de transação já autorizada, mas com pedido/corrida sem estado prévio `paid` ou `refunded`, passa a registrar `refund_without_paid_domain_manual_review`, sem fabricar transição financeira. **REVIEW ONLY, NÃO APLICADO.**
- `supabase/functions/apois-driver-review-mailer/index.ts`: quando Resend rejeita o envio, a resposta `failed` só é confirmada após `UPDATE ... RETURNING` condicional em outbox; falha de gravação, concorrência ou zero linhas causam `503` (não há falso estado persistido). Proteção anterior para aceite do provedor foi mantida.
- `scripts/test-safe2pay-webhook-retry-v1.mjs`: **27 cenários isolados** passaram no job Estabelecimento, cobrindo ambos os produtos, rollback simulado, string decimal, dinheiro fracionário, refund com domínio pendente, chargeback e estados fora de ordem.
- `scripts/test-driver-review-mailer-reconciliation-v1.mjs`: **10 cenários isolados** passaram no job Parceiro/Admin, incluindo falha de persistência após sucesso **ou** rejeição do provedor. Os **7 cenários pré-Auth** das 12 fotos complementares também passaram, sem criar contas ou fazer uploads.

**Provas:** job Estabelecimento registrou `[PASS] 27 Safe2Pay isolated tests`; job `audit-web-only` registrou `[PASS] 10 isolated driver review mail regressions`, `[PASS] 7 runtime pre-Auth vehicle photo cases` e verificação de 13 fotos.

### Alertas Supabase — triagem read-only

- Advisors de segurança em ambos os projetos foram consultados sem DDL. Há avisos amplos de funções `SECURITY DEFINER` executáveis por `anon` e `authenticated`; **nem todos significam acesso indevido**. Por exemplo, `public.activate_prepaid_pix_ride` tem guarda interna `auth.role() = 'service_role'`, e o resumo financeiro em Corridas verifica `auth.uid()` + `private.has_permission('finance.read')`. Não revogar essas chamadas indiscriminadamente.
- **Os seis privilégios P0 anteriormente identificados continuam pendentes**: duas RPC Asaas em Corridas e quatro financeiras/dispatch em Entregas. Requerem intervenção autorizada, verificação de chamadores, rollback e teste em ambiente PostgreSQL isolado. Não houve contorno dos bloqueios.
- Advisors também indicam `Leaked Password Protection Disabled` nos dois projetos. Esse recurso depende da disponibilidade do plano Supabase (documentação atual: Pro ou superior). Não alterar Auth sem avaliar impacto em login e cadastro. Referência: https://supabase.com/docs/guides/auth/password-security

### Bloqueios e limites

A implementação atômica Safe2Pay ainda não foi testada em PostgreSQL isolado nem publicada, e **a conciliação do ledger do estabelecimento continua pendente**. Não usar builds WEB como comprovação de pagamento real. A Vercel Admin Corridas continua reservada até a cota de novos deploys ser liberada; nenhuma nova tentativa. Não há autorização para APK, merge, publicação ou alteração de produção.

---

## Continuação executada — 03/11/2026 — bloqueio Safe2Pay, preço efetivo e estabilidade da auditoria WEB

**HEAD de código aprovado:** `d1181af3feee1b2e77cdf6404fcfb19e42f185c3`.
**GitHub Actions:** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41576613333 — **3/3 SUCCESS WEB-only**. Não foram executados APK, merge, deploy de produção ou alterações nos Supabases.

### P0 financeiro — inconsistência confirmada nos bancos reais

1. O banco **Entregas** tem `safe2pay_order_transactions`, `payments` e `wallet_transactions` distintos. O SQL revisado `database/review/20261103_safe2pay_entregas_atomic_REVIEW_ONLY.sql` **ainda não cria/reconcilia `payments`, nem reserva `merchant_net`** via `reserve_paid_order_merchant_net`. A função ativa de reserva usa idempotency key `order-merchant-funded:<order_id>`, e a tabela `payments` exige `idempotency_key` único e oferece índice único parcial `(provider,provider_charge_id)`. Não é seguro inventar lançamentos ou publicar o callback sem harmonizar essas estruturas. A correção transacional continua **NÃO LIBERADA** para produção e exige testes isolados com ledger/rollback.
2. Ambos os SQLs revisados agora comparam valores recebidos e armazenados com o valor autorizado pelo domínio: `orders.total` em Entregas; `rides.passenger_charge_cents` em Corridas, com fallback à estimativa para legados, usando a mesma referência empregada pela RPC ativa `activate_prepaid_pix_ride`. Inconsistências retornam exceção (transação abortada), impedindo pagamento insuficiente ou valores com fração de centavo. **Review only, não aplicado**.
3. `supabase/functions/safe2pay-create-order-pix/index.ts` na branch não marca uma cobrança como expirada somente pelo relógio local; se um QR antigo ultrapassar seu TTL, retorna `409 safe2pay_expiry_requires_provider_reconciliation` e NÃO cria outro Pix enquanto a instituição não confirmar o encerramento da cobrança. Evita cobrança duplicada após pagamento tardio. A Edge ativa de produção **não foi modificada**.
4. O teste `scripts/test-safe2pay-webhook-retry-v1.mjs` inclui preço divergente nas duas verticais, preservando replay/chargeback/refund seguro. Run `41576341268` confirmou **29 testes isolados Safe2Pay aprovados**, mas não substitui PG E2E real.

### Gate independente de produção

Foi criado `scripts/verify-safe2pay-production-readiness-v1.mjs`, exposto em `package.json` por `npm run verify:safe2pay-production-readiness`. É um teste **intencionalmente fail-closed (exit 1)** enquanto faltarem reconciliação canônica em `payments`, reserva/reversão no ledger, caminho de cobrança inicial Corridas ainda bloqueado e SQLs de revisão não aprovados. O comando **não é executado como bloqueio de builds WEB**; em `scripts/audit-payment-boundary.mjs` apenas se verifica que o gate continua bloqueando financeiramente. O CI `41576341268` confirmou `WEB-only QA passed; separate financial release gate correctly blocks incomplete ledger reconciliation`. A aprovação do WEB não autoriza APK/release.

### Auditoria do Entregador — falso negativo cronométrico investigado

As execuções `41575899551` e `41576026941` falharam no teste anônimo `entregador-login: registration click did not change the page` na largura de 390 px, depois de uma espera fixa de 600 ms. O código-fonte PINADO `sources/apois-entregas/src/routes/register.tsx` tem guarda de rota assíncrona `beforeLoad` que espera `supabase.auth.getSession()`; a rota original `src/routes/login.tsx` utiliza `<Link to="/register">`. A hipótese foi de tempo de navegação insuficiente no teste, não de falha funcional comprovada no aplicativo.

Foi reforçado **somente o teste** em `scripts/audit-browser-public-v1.mjs`: espera até 6 segundos por mudança real de rota, campo de nome e telefone para Entregador/Cliente; para Motorista exige campo do veículo. Em caso de falha ainda registra rota e controles e reprova o CI. A execução `41576613333` terminou **3/3 jobs SUCCESS**, incluindo a auditoria do Entregador em múltiplas resoluções. **Nenhuma fonte protegida ou lógica de navegação foi alterada para mascarar o resultado.** Ainda falta E2E autenticado e físico Android.

### Segurança Supabase: risco antigo confirmado novamente, sem alteração

As RPCs públicas `get_asaas_subaccount_secret(uuid)` e `store_asaas_subaccount_secret(uuid,text)` em Corridas continuam com EXECUTE para `anon`, `authenticated` e `service_role`. Leitura do corpo real não encontrou checagem `auth.uid()` nem `private.has_permission`: a primeira lê o valor descriptografado do Vault e a segunda cria/substitui segredos. Nenhuma outra função PostgreSQL referenciando essas RPCs foi encontrada em busca delimitada. **Prioridade P0 de intervenção humana autorizada** sobre o arquivo já preparado `database/review/20261102_corridas_asaas_vault_rpc_privileges_REVIEW_ONLY.sql`; as ferramentas antes bloquearam aplicação. Não contornar bloqueio e não divulgar valores. As quatro RPCs financeiras/dispatch de Entregas continuam com EXECUTE público e também não foram modificadas.

### Estado operacional

- Nenhum estorno, ledger, saldo, aprovação, sessão, conta Auth, e-mail ou Edge Function de produção foi modificado.
- Vercel Admin Corridas continua reservada por cota de deployments; sem novas tentativas.
- Branch `fix/entregas-homologacao-ajustes-20261030`, sem alterações em `sources/`, `source-lock`, submódulos, workflows, branches protegidas.
- **APKs NÃO LIBERADOS** até fechamento dos P0 financeiros/ACL e homologação Android real.
