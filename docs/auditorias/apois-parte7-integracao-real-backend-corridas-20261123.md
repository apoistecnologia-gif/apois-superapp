# APOIS — Parte 7: integração real do backend Corridas (23/11/2026)

Projeto Supabase: APOIS CORRIDAS - PRODUÇÃO, ref `tbbzkrfupmqdywnzgnms`, região `sa-east-1`.
Escopo: despacho de corridas, recusa, cancelamento operacional, no-show, finalização com fila, recuperação automática, GPS, segurança e preço confirmado no servidor. Não habilita checkout ou qualquer débito financeiro.

## Inventário publicado e verificado
| Função | Versão | JWT na gateway | Papel |
|---|---:|---|---|
| `request-ride` | 21 | sim | Criação/retentativa chama `dispatch-ride` com service role; evita segunda notificação |
| `dispatch-ride` | 2 | sim | CAS de `dispatch_attempts`, estado, assinatura, suspensão, GPS, própria identidade e Push |
| `driver-reject-redispatch` | 1 | sim | RPC autenticada do motorista; despacho posterior, falha posterior vira `deferred` |
| `driver-cancel-redispatch` | 1 | sim | Preserva no-show/espera e redespacho dos cancelamentos operacionais |
| `driver-finish-redispatch` | 14 | sim | Finaliza a corrida uma única vez, promove ou redistribui a próxima da fila |
| `driver-redispatch-recovery` | 2 | não (verificação de capacidade Vault no handler) | Recebe chamadas server-to-server do cron ou chave service role; recusa chamada sem credencial |
| `send-ride-push` | 5 | sim | Serviço de push publicado preexistente, utilizado pelo despachante |

## Migrações aplicadas somente a Corridas
- `apois_dispatch_candidate_trigger_guard_20261123`: substitui o corpo de `append_nearby_busy_driver_candidates` com exclusão do passageiro, assinatura e suspensão, validade do GPS e exclusão de ofertas adicionadas sem notificação. Preserva enriquecimento de candidatos ocupados sem saltar o despachante.
- `apois_redispatch_cron_vault_auth_20261123`: cria uma credencial aleatória exclusiva em `vault.secrets`, sem expor o valor em GitHub/SQL/cron; cria `apois_redispatch_cron_token_valid` somente para `service_role`.
- `apois_enable_pg_net_for_redispatch_20261123`: instala `pg_net` (verificado `0.20.4`).
- `apois_redispatch_recovery_cron_v1_20261123`: cria job `apois-driver-redispatch-recovery` (jobid 3) ativo `* * * * *`; somente referência ao Vault no SQL.
- `apois_report07_no_show_reason_contract_20261123`: habilita `ride.driver_no_show_code_v1=true` após testes de chegada/espera; continua 2 minutos e mantém mudanças operacionais sem alterar dinheiro.

## Evidências de validação
- CI WEB + PostgreSQL isolado: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45117445334 e https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45116702599 (sucesso). Testes SQL reais: candidato autoofertado, GPS, já oferecido/rejeitado, cron Vault e no-show com chegada e tempo.
- Chamada HTTP direta do cron ao `driver-redispatch-recovery` verificada com `HTTP 200` e `{ok:true, checked:0, deferred:0}`; `cron.job_run_details` mostrou execuções `succeeded`, respostas assíncronas do `pg_net` com HTTP 200.
- Sete requisições POST sem autenticação retornaram HTTP 401 para `request-ride`, `dispatch-ride`, as três ações de Motorista, `driver-redispatch-recovery` e `send-ride-push`.
- Inventário do banco: `ride.driver_no_show_code_v1=true`, espera `2`, flag `finance.ride_electronic_payments_enabled=false`; `cron.job` ativo, 1 segredo de capacidade Vault. Não foram criadas corridas fictícias no projeto de produção.
- Nenhum APK/Android gerado/publicado nem programa de pagamento Safe2Pay alterado. Testes físicos de Motorista, Passageiro e Push ainda não executados.

## Ordem e reversão operacional
1. Se o cron passar a falhar ou gerar carga inesperada, desabilitar imediatamente: `SELECT cron.unschedule('apois-driver-redispatch-recovery');` ou definir `active=false` em `cron.alter_job` após conferência do jobid. Não colocar a chave service role em `cron.job.command`.
2. Se `request-ride` v21 introduzir regressão, restaurar v20 preservada em `docs/auditorias/rollback/20261123_request-ride-production-v20.ts`; v19 também foi preservada. Sempre testar fluxo de compra e preços.
3. Se `driver-finish-redispatch` v14 introduzir regressão, restaurar v13 preservada em `docs/auditorias/rollback/20261123_driver-finish-redispatch-production-v13.ts` após interromper novas ofertas de fila. Conferir corridas em andamento.
4. Para reverter `driver-redispatch-recovery` v2 ao antigo contrato service-only, desligar cron primeiro. O antigo código está na branch `fix/apois-dispatch-integridade-20261123` e o despacho v1 também.
5. Reversões de RPC/no-show ou do gatilho não são simples DROP de tabela: restaurar as definições anteriores sob migração revisada e teste de regressão (consultar snapshots de migração/backups do projeto). Não excluir dados históricos ou pagamentos.

## Pendências para lançar os aplicativos
- Mesclar e publicar os clientes dos PRs #14–#18 após revisar a cadeia de dependências; o backend sozinho não atualiza APKs instalados.
- Homologar corrida real com dois motoristas, rejeição, cancelamento, redispatch, corrida seguinte, falta de internet, Google Maps/Waze, Push FCM e PIN em Android físico.
- Safe2Pay continua desabilitado; migração financeira atômica/controle de wallet e conciliação do Entregas pendentes em trilha separada.
- Revisar métricas de erro, `scan_limited`, `attempt_limited`, tentativas de reoferta e limites/custos de invocação a cada minuto.

**Estado:** a cadeia de Edge Functions e o agendamento de Corridas estão efetivamente publicados em produção e tiveram autenticação verificada. Isso não equivale a homologação completa do aplicativo Android nem do financeiro.
