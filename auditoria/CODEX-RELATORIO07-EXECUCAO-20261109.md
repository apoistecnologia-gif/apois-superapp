# APOIS — Relatório 07 | Cancelamento e redistribuição de corridas

**Execução:** 09/11/2026 · **Achados do arquivo de 08/11/2026:** INV-054, INV-055, INV-056 (P1).  
**Integrador autorizado:** `apoistecnologia-gif/apois-superapp` — branch `audit/continuacao-20261107`.  
**Fonte Motorista/Admin protegida:** `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`.  
**Supabase Corridas (somente leitura):** `tbbzkrfupmqdywnzgnms`.  
**Limite absoluto:** nenhuma publicação, merge, APK, chamada de corrida, disparo de push, migração ou escrita em produção.

## 1. Evidência de backend ativo — reconferida neste ciclo

O inventário **lido do Supabase** confirmou que `driver-cancel-redispatch`, `driver-reject-redispatch` e `dispatch-ride` **não estão publicados**. `driver-finish-redispatch` continua **ACTIVE, v12, SHA-256 `858b20388f8e8d97b9cac238dd95efcfc4e000c376fedb07d01154e2ba22123d`**; a implementação viva apenas chama `driver_finish_ride` e devolve `ride`.

A função privada implantada `apois_rpc_private.driver_cancel_ride(uuid,text)` foi lida, sem invocação. Consta a checagem de ausência por padrões `nÃ£o/nao/no-show`, **sem `não` corretamente acentuado**; também existem as proteções `no_show_requires_driver_arrival` e `driver_no_show_wait_not_elapsed`. O tempo de espera atual é derivado de `ride.driver_no_show_wait_minutes` (fallback 2 minutos). Nenhum desses limites foi reduzido.

A função `apois_rpc_private.driver_finish_ride(uuid)` atual retorna `released_queued_ride_id` e `promoted_queued_ride_id`; quando elegível, promove a próxima viagem, e, quando inelegível, libera a fila e insere o evento de auditoria `ride.queued_released_ineligible_driver`. `driver_reject_ride` usa a sessão do motorista e lista de ofertas. **Não foi executada nenhuma RPC mutadora**.

## 2. Resultado por achado

| Achado | Estado | Ação concreta e condicionantes |
|---|---|---|
| **INV-054 — endpoints ausentes** | **G — bloqueio de implantação/validação externa** | Mantidas e relidas as duas Edge Functions já preparadas e o `dispatch-ride` integrado; nenhum fallback direto no cliente que pudesse duplicar mudança de estado. O Motorista recebe erro específico para endpoint inexistente, em vez de esconder a falha. O dispatcher passou a proteger lotes ativos também em modo inicial e a usar compare-and-swap pelo contador `dispatch_attempts`. **Endpoints ainda ausentes do backend real; recusa/cancelamento não liberados.** |
| **INV-055 — fila liberada sem continuidade** | **C — implementação preparada, recuperação não homologada** | Criado `supabase/functions/driver-finish-redispatch/index.ts` com continuação explícita da corrida liberada, `mode:"initial"` para reconstruir candidatos, distinção `confirmed` versus `deferred` e ramo `promoted/not_required`. A finalização RPC continua exclusiva do backend. Criado consumidor limitado `driver-redispatch-recovery` (service-role somente) que relê eventos duráveis `ride.queued_released_ineligible_driver` e `ride.driver_cancelled_for_redispatch` e tenta novamente apenas corridas ainda em busca. Não há cron habilitado, deploy, teste transacional, nem garantia de recuperação ilimitada. |
| **INV-056 — motivo acentuado de ausência** | **C — cliente/Edge preparados, SQL não aplicado** | O cliente classifica motivo em `reason_code:"passenger_no_show"` ou `"other"`, sem alterar rótulos. A Edge interpreta código explícito (ou textos legados), confere o marcador server-side `ride.driver_no_show_code_v1`, **nega com 503 se a migração não estiver ativa**, e passa o código `APOIS_NO_SHOW_V1:` junto ao texto para o RPC. Migração SQL `QA_NOT_APPLIED` foi gerada a partir do corpo privado atualmente implantado; reconhece motivo corretamente acentuado, sem acento, legado e código estável, preservando no banco o texto legível e as validações originais de chegada/espera. **Migração não aplicada.** |

**Não alterar o estado para B/A por simples presença do código:** produção permanece com as funções ausentes/v12 e regra de no-show anterior.

## 3. Arquivos de código e QA versionados

- `scripts/fix-report07-driver-reason-code-v1.mjs` — transformação restrita ao workspace descartável do Motorista (o snapshot permanece imutável).
- `scripts/qa/test-report07-driver-reason-code-v1.test.mjs` — cenários de código e texto sem/ com acentos.
- `scripts/qa/test-report07-redispatch-v1.test.mjs` — asserts estruturais e mock da continuação de despacho após commit.
- `scripts/build-partner-release.sh` — chama transformação/testes do Relatório 07 após os demais hardeners do Motorista. **Este builder não foi executado e não deve ser usado para gerar APK antes da autorização final.**
- `supabase/functions/driver-cancel-redispatch/index.ts` — motivo codificado e gate fail-closed para ausência.
- `supabase/functions/driver-finish-redispatch/index.ts` — handler futuro de finalização com continuação.
- `supabase/functions/dispatch-ride/index.ts` — proteção de oferta já ativa e CAS de tentativa para reduzir oferta duplicada.
- `supabase/functions/driver-redispatch-recovery/index.ts` — recuperação limitada por eventos existentes em audit_logs, restrita a service_role.
- `supabase/corridas-forward-migrations/20261109_report07_no_show_reason_code_QA_NOT_APPLIED.sql` — função privada e marcador de prontidão preparados, **não executados**.

O wrapper de recusa `driver-reject-redispatch` foi preservado e não teve comportamento financeiro/eligibilidade substituído. Nenhum repositório-fonte nem módulo Entregas foi editado.

## 4. Verificações realmente executadas

1. **Leitura externa real (somente leitura):** inventário Edge Corridas, arquivo da função v12 implantada e corpos das três RPCs `driver_cancel_ride`, `driver_reject_ride`, `driver_finish_ride`, além da função interna de recusa. Conferida estrutura das colunas `rides.dispatch_attempts`, `audit_logs`, `app_settings` e chave primária de `app_settings.key`.
2. **Simulação JavaScript do patch no cliente fixado:** aplicação duas vezes do gerador real à cópia em memória; idempotência confirmada, **9 classificações sintéticas** de motivo passaram.
3. **Simulação JS de código da Edge:** extraído e executado o corpo real de `continueReleasedQueue` com fetch mockado. Cenários: sucesso, HTTP 503 e falha de rede; **15 verificações de lógica/contrato** passaram no conjunto de asserts. Nenhum `fetch` real ou RPC foi invocado.
4. **SQL:** geração controlada a partir da definição viva de `apois_rpc_private.driver_cancel_ride`, mantendo textualmente ramos de chegada, espera e cancelamento comum. Corrigido terminador SQL `$function$;`. **Não foi executado SQL de DDL** nem validação em PostgreSQL staging.
5. Os dois scripts Node de teste foram versionados e ligados ao builder, mas **não foram executados em Node no checkout completo**. Também não houve Deno check, lint, typecheck, bundle, E2E, Android ou evento financeiro.

## 5. Bloqueios e riscos residuais

- **Ordem de homologação obrigatória no futuro:** validar migration no banco de staging com rollback/fixtures; confirmar o marcador; testar Edge `dispatch-ride` e controle de serviço; validar o consumidor de recuperação; testar Edge de recusa, cancelamento e finalização com contas de teste e autorização explícita; somente depois reavaliar implantação.
- **Perda de resposta depois do commit:** o handler retorna `completion:unconfirmed` no erro da RPC e orienta reconsulta do estado, sem repetir o comando por conta própria. Não há reconciliação integral do retorno da finalização para todos os casos de resposta perdida. O evento de liberação durável permite tentativa de redispatch separada, mas **não prova** que o cliente recebeu confirmação.
- **Recusa sem fila de recuperação durável:** a RPC de rejeição consultada atualiza candidatos/ofertas, mas não registrou evento de auditoria do tipo usado pelo consumidor preparado. Se a Edge falhar depois da RPC e antes do despacho, ainda falta um mecanismo robusto para recuperá-la. **INV-054 continua bloqueado**.
- **Limites do consumidor:** varredura de eventos da última **6 horas**, até **200 linhas** por chamada, sem paginação/cursor próprio. `scan_limited` sinaliza abrangência parcial. A recuperação não está agendada/publicada, e esse recorte não é garantia operacional para grandes volumes.
- **Concorrência real:** a guarda de `dispatch_attempts` reduz a corrida de despacho e evita duplicação por respostas perdidas, mas ainda precisa de teste simultâneo real e rastreio de push/estado. A garantia de oferta única em toda a arquitetura não foi comprovada.
- **Ausência do passageiro:** validar em staging recusa antes da chegada, dentro e fora da espera de dois minutos, textos legados/mojibake e outros motivos; não alterar parâmetros comerciais nem históricos.
- **Avaliação:** hardener `harden-partner-motorista-rating-handoff.mjs` preservado, mas sem homologação end-to-end.
- **Produção:** nenhuma Edge publicada, SQL aplicada, cron criado, push enviado, corrida manipulada ou saldo alterado.

## 6. Reversão e continuidade

Os commits desta fase só alteram arquivos da branch `audit/continuacao-20261107`. Reverter os commits do Relatório 07 na branch é suficiente para desfazer o código preparado. **Não há rollback remoto**, porque nenhuma mudança foi executada em serviços de produção.

A matriz histórica de 53 achados deverá adicionar INV-054 **G**, INV-055 **C** e INV-056 **C**: **56 achados (A0, B37, C15, D0, E1, G3)**. Nenhuma classificação anterior muda.

**Relatório 07 processado no nível permitido.** Próximos relatórios podem seguir sem APK. A liberação de homologação física exige a frase expressa do responsável.
