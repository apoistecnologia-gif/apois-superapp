# APOIS — Parte 4: integrações, segurança e paridade de produção
**Data da evidência:** 23/11/2026. **Tipo:** auditoria de leitura sobre GitHub e projetos Supabase atuais. **Código-base:** `fix/apois-parceiro-auditoria-20261123` e snapshots pinados. **Nenhuma mutação, publicação, consulta de dados pessoais ou emissão de pagamento em produção.**

## Definição de pronto
O fato de um arquivo aparecer no GitHub ou um build web passar **não comprova** que o código correspondente esteja publicado no Supabase. O novo gate `scripts/audit-apois-production-readiness-v1.mjs` só pode ser alimentado por inventário **recém-coletado do ambiente realmente implantado**. Um inventário antigo ou hipotético não autoriza produção.

## P0 — Corridas e redispatch
**CONFIRMADO NAS FUNÇÕES PUBLICADAS.** Em Corridas, `tbbzkrfupmqdywnzgnms`, a lista de 13 Edge Functions não contém `dispatch-ride`, `driver-reject-redispatch`, `driver-cancel-redispatch` ou `driver-redispatch-recovery`. O aplicativo Motorista utiliza as duas funções intermediárias para recusa e cancelamento. Os endpoints existem no **repositório**, não no inventário publicado.

A Edge Function `driver-finish-redispatch` publicada contém apenas a chamada RPC `driver_finish_ride`, sem tratamento de `released_queued_ride_id`. A RPC privada, por sua vez, pode devolver `released_queued_ride_id` ou `promoted_queued_ride_id`. A versão de repositório `supabase/functions/driver-finish-redispatch/index.ts` implementa `continueReleasedQueue`, mas está **pendente de implantação coordenada**.

O `pg_cron` de Corridas possui tarefas de expiração de corridas não aceitas e limpeza de demanda; **não foi encontrada tarefa ativa específica de recuperação de redispatch** na listagem de 23/11. Isso exige criação e teste controlado de consumidor idempotente, com limites de lotes, análise de estados e reexecução somente de tarefas pendentes. Não considerar o simples agendamento de expiração equivalente à recuperação.

**Não fazer:** fallback direto no cliente para `driver_reject_ride`/`driver_cancel_ride`, repetir automaticamente `driver_finish_ride` após timeout, atualizar `rides` por service role sem validação do ator, ou publicar uma Edge Function isoladamente sem seu despachante.

## P1 — Safe2Pay: divergência transacional
**CONFIRMADO NAS DUAS FUNÇÕES PUBLICADAS.** O webhook Safe2Pay em produção faz em etapas separadas o registro de evento, a atualização de transação, a atualização de `rides`/`orders` e a marcação de `processed_at`. Tem verificação de segredo, conferência da referência/valor e proteção de duplicidade; portanto **não está comprovada cobrança duplicada**. Existe, contudo, risco de inconsistência se ocorrer falha ou concorrência entre etapas.

A versão do repositório `supabase/functions/safe2pay-webhook/index.ts` exige a RPC `apois_safe2pay_apply_event_atomic`. **Ela não consta nas funções Postgres dos projetos Corridas nem Entregas**, verificados via `pg_proc`. Esta versão **não pode ser publicada agora**, pois responderia `503 atomic_reconciliation_not_confirmed` sem a migração correspondente.

**Ordem obrigatória:** (1) inventariar tabelas/constraints e compatibilidade real de pagamentos; (2) executar concorrência, replay e rollback em Postgres descartável; (3) revisar e homologar migração atômica e permissões da RPC; (4) aplicar primeiro a migração aprovada, projeto por projeto; (5) verificar a RPC; (6) publicar o webhook correspondente; (7) verificar idempotência com um mesmo evento, reordenação e falha de rede; (8) conciliar operações pendentes antes de liberar recebimentos. Nunca executar teste de cobrança real não autorizado.

## P1 — Segurança do Push Entregas
**CONFIRMADO NO CÓDIGO E NA FUNÇÃO PUBLICADA.** A configuração FCM Android tinha `visibility: "PUBLIC"`, permitindo que o conteúdo de notificação fique disponível em pré-visualizações da tela bloqueada, conforme configurações do aparelho. Modificado **somente no repositório** para `visibility: "PRIVATE"`, sem alterar conteúdo de mensagens, canal, package ID, RPC de claim ou pagamentos. A função publicada ainda precisa ser atualizada após homologação. Testar Android 13–16, com notificações permitidas, tela bloqueada, canal de oferta, cliques e retorno ao aplicativo.

## Controles constatados que devem ser preservados
- **Entregas:** `accept_delivery_offer` faz checagem de motorista elegível, trava oferta e entrega, impede dupla atribuição; `complete_delivery_with_pin` só conclui entrega designada no estado correto e aplica bloqueio temporário de tentativas.
- **Corridas:** `driver_accept_ride` usa controle de oferta válida, status e ator; `driver_finish_ride` é transacional e pode promover ou liberar próxima corrida.
- **Notificações Entregas:** `dispatch-push-outbox` verifica chave no servidor, usa claim `claim_notification_push_batch_v2` e mantém tarefa cron ativa `apois-native-push-outbox-retry`.
- **Permissões:** políticas RLS de `rides`, `drivers`, `delivery_jobs`, `delivery_offers` exigem vínculo do ator ou papel administrativo. Isso **não substitui** auditoria de todas as funções `SECURITY DEFINER`.
- **GPS/Mapas:** serviços Android de primeiro plano e navegação externa existem no código, mas a confirmação física por aparelho/versão Android e as restrições das chaves na consola Google Cloud permanecem **não avaliadas**.
- **IA/Agentes:** nenhum módulo IA/LLM operacional foi localizado pelos nomes de arquivos nas três árvores de código examinadas. Essa descoberta não prova ausência de chamadas externas ocultas: dependências e configuração não foram varridas integralmente.

## Portões de lançamento
**Motorista** só libera após publicação e integração dos quatro endpoints ausentes, confirmação de redispatch ao terminar corrida, consumidor de recuperação ativo e testes sintéticos de recusa, dupla oferta, cancelamento permitido, no-show, finalização, perda de resposta e retomada.

**Entregador** mantém status/pagamentos atuais: registrar cenários de aceite simultâneo, PIN incorreto/bloqueado, segundo plano, entrega finalizada e reconciliação manual; verificar canais FCM e privacidade no Android físico.

**Financeiro Safe2Pay** é gate **independente**: a migração atômica deve existir nos dois bancos antes de publicar a versão de webhook que depende dela. Não alterar pagamentos ativos como efeito colateral do lançamento do Motorista.

**QA exigido:** testes de concorrência com transações reais em banco descartável; latência/perda de pacote e repetição de webhooks/Push; testes instrumentados em Android com GPS, bateria, tela bloqueada, permissão negada/revogada e troca de app; testes de RLS como contas distintas de homologação; limites/rate limits do Google Maps e FCM; plano de rollback por módulo com backup, versão anterior da Edge Function e reconciliação de eventos em aberto.

## Comandos seguros
```bash
node --test scripts/qa/test-apois-production-readiness-v1.test.mjs
# Ao receber um inventário FRESCO, coletado sem secrets nem dados pessoais:
node scripts/audit-apois-production-readiness-v1.mjs ./inventario-verificado.json
```

**Status em 23/11/2026:** `NÃO PRONTO para lançamento completo`, em razão de pendências confirmadas de endpoints e redispatch, divergência de contratos de webhook e privacidade do Push ainda não publicada. Os patches de código permanecem em PRs de rascunho; nenhum deles implica deploy.