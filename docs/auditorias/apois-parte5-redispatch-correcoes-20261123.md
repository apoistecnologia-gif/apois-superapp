# APOIS — Parte 5: hardening do redispatch e recuperação de busca

**Escopo:** somente código preparado no GitHub e CI WEB. **Nenhum deploy, migration ou cron realizado.** Os projetos Supabase consultados foram os dois projetos de produção, com queries somente SELECT.

## Evidência no banco publicada em 23/11/2026

- \`apois_rpc_private.driver_reject_ride\` valida a oferta e delega a \`driver_reject_ride_candidate_legacy\`, que atualiza arrays de candidatos, ofertados e rejeitados, **sem inserir evento em \`audit_logs\`**. Se a chamada subsequente \`dispatch-ride\` falha, o recuperador antigo não identificava a recusa por evento.
- \`apois_rpc_private.driver_cancel_ride\` insere \`ride.driver_cancelled_for_redispatch\` para cancelamento operacional. A espera de 2 minutos e o estado de chegada são verificados pelo próprio banco no cancelamento por no-show.
- \`apois_rpc_private.driver_finish_ride\` retorna \`released_queued_ride_id\` ou \`promoted_queued_ride_id\`; a Edge Function publicada ainda não faz o dispatch da corrida liberada. A versão do repositório continua a fila, mas precisa ser implantada somente após \`dispatch-ride\`.
- \`public.rides\` possui \`candidate_driver_ids\`, \`offered_driver_ids\`, \`rejected_driver_ids\`, \`dispatch_attempts\`, \`request_expires_at\`, \`search_expires_at\` e \`queued_after_ride_id\`; o despachante faz CAS por \`dispatch_attempts\` e estado da corrida.
- O \`pg_cron\` de Corridas contém \`apois-expire-unaccepted-rides\` e \`apois-qa218-purge-passenger-demand\`, sem agendamento ativo de \`driver-redispatch-recovery\` no inventário. \`pg_net\` não estava instalado; **não se deve assumir que pg_cron pode chamar a função HTTP sem provisionamento seguro**.
- \`ride.driver_no_show_code_v1\` não consta em \`app_settings\` no banco publicado. A migração existente \`supabase/corridas-forward-migrations/20261109_report07_no_show_reason_code_QA_NOT_APPLIED.sql\` está marcada **não aplicada** e depende de teste em ambiente isolado.

## Correções efetivamente aplicadas na branch

1. **\`supabase/functions/driver-reject-redispatch/index.ts\`** — deixa de interpretar HTTP 200 \`{ok:false}\` como redispatch realizado.
2. **\`supabase/functions/driver-cancel-redispatch/index.ts\`** — aplica a mesma validação sem reexecutar a RPC já confirmada.
3. **\`supabase/functions/driver-redispatch-recovery/index.ts\`** — mantém replay de eventos de cancelamento e liberação da fila, e agora inspeciona buscas com oferta vencida, sem motorista atribuído, sem corrida reservada e antes do prazo final de busca. Deduplica, limita eventos, linhas e tentativas; valida novamente o estado antes de qualquer despacho; não repete rejeição, cancelamento ou finalização. Se o conjunto restante de candidatos se esgotou, faz busca nova sem reofertar os motoristas registrados como rejeitados ou já ofertados.
4. **\`scripts/audit-apois-production-readiness-v1.mjs\`** — exige explicitamente que o contrato de motivo \`ride.driver_no_show_code_v1\` seja verificado/ativado após migração protegida, antes da liberação do Motorista.
5. **\`scripts/qa/test-apois-redispatch-recovery-v2.test.mjs\`** — simula a execução do handler real com Supabase/HTTP mockados; cobre recusa sem evento, filas reservadas, corrida já aceita ou finalizada, oferta ainda ativa, resposta HTTP 200 lógica inválida, duplicidade e autenticação.

## Ordem obrigatória de homologação/rollout (não executada)

1. Congelar inventário de versões e registrar hash das quatro funções ausentes, da função de finalização e do código cliente. Ter rollback de cada Edge pronto.
2. **Homologar sem pagamentos reais** os cenários de aceite, recusa, cancelamento normal e no-show, com espera configurada e migração de reason code em banco descartável. Não alterar a política de no-show por suposição.
3. Publicar primeiro \`dispatch-ride\` **em ambiente de homologação**, conferir acesso somente por service role, RLS, CAS e Push. Testar concorrência e nenhuma autoatribuição.
4. Publicar \`driver-reject-redispatch\` e \`driver-cancel-redispatch\` na homologação; após retorno HTTP 200 \`ok:false\` ou timeout, a interface deve distinguir mutação confirmada de redispatch adiado, não cancelar de novo.
5. Publicar \`driver-finish-redispatch\` na homologação e testar corrida promovida, corrida liberada e falha de despacho após commit. A RPC de finalização não pode ser repetida pelo app após resposta perdida.
6. Publicar \`driver-redispatch-recovery\` na homologação; **somente depois** agendar chamada autenticada ao endpoint com segredo sob gestão do runtime, nunca exposto no repositório ou frontend. Cron a cada minuto é hipótese operacional a validar contra carga/quotas; não há agendamento ativo criado neste PR.
7. Executar migração do código de no-show com revisão DBA e aprovação; confirmar \`ride.driver_no_show_code_v1=true\` somente após commit e testes. Se falhar, no-show permanece bloqueado, demais cancelamentos preservados.
8. Repetir os testes em aparelho real com internet instável, background, dois motoristas tentando aceitar, e perda de resposta HTTP. Comparar logs, banco e notificações; executar gate de produção atualizado. Preparar janelas de reversão por função e verificar corridas em trânsito antes de cada etapa.
9. Repetir a sequência em produção **apenas com autorização de implantação específica** e plano de rollback executável. Não publicar webhooks Safe2Pay até migração atômica homologada, que é uma frente separada.

## Métricas que devem ser observadas

- Redispatch \`offered\`, \`no_candidate_yet\`, \`race_lost\`, \`offer_still_active\`, \`deferred\`; alertar para \`deferred\` sustentado.
- Recuperação: \`event_candidates\`, \`stale_candidates\`, \`checked\`, \`skipped\`, \`retried\`, \`deferred\`, \`scan_limited\`, \`attempt_limited\`; se os limites forem alcançados, não declarar recuperação completa.
- Falhas de FCM e registro de ofertas, latência até aceite, rejeições e tempo até próxima oferta; jamais expor PII ou chave service_role.

**Prontidão:** o novo código corrigiu os pontos identificados na branch e foi submetido ao CI, mas **o serviço não fica operacional até publicar e agendar a cadeia completa após homologação**.
