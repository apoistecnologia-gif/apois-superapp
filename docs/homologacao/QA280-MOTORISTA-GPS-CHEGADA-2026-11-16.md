# APOIS Parceiro — Homologação QA279 → QA280 (Motorista)

**Data:** 2026-11-16, Petrolina/PE. **Escopo:** Motorista somente.
**Baseline imutável QA278:** `df9a1ee55e7825a90ad50012c30f817783c33257`.
**Branch isolada:** `fix/apois-parceiro-qa280-motorista-gps-chegada-20261116`.
**Fonte do Motorista:** `movvi-go-connect` pin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.

## Dados reais — somente consultas SQL (13:45, 16/11/2026, -03)

- Corrida QA279 registrada no isolamento `private.apois_qa_motorista_rides`.
- Status permanece `motorista_a_caminho`. Sem chegada registrada, sem início, conclusão ou cancelamento.
- Motorista `is_online=false`; última posição de servidor em 12:19:14 -03; distância armazenada ao embarque de aproximadamente **2,2 m**.
- Pagamento `cash`, `pending`; `cancellation_fee=null`.
- Zero registros relacionados encontrados em `ride_settlements`, `cancellation_fees`, `driver_wallet_transactions` e `safe2pay_ride_transactions`.
- **Não foi executado SQL de alteração.** Não confirmar PIN, chegada ou conclusão até validar proteções e o aplicativo físico.

## Diagnóstico de código

1. O `DriverLocationService` fonte utiliza `.setMinUpdateDistanceMeters(5f)`; a QA235 invoca `qa235CheckPickupArrival(location)` somente quando chegam callbacks reais do GPS. Motorista imóvel pode não receber leituras suficientes para as três amostras com separação mínima de 6,5 s. O heartbeat original não chama o detector de chegada. **Defeito estrutural confirmado; causa exclusiva do incidente físico ainda não demonstrada por logcat.**
2. `driver_set_presence` do servidor permite `_online=false` durante `motorista_a_caminho`; proteção especial de operação ativa considera somente `em_viagem`. O fail-safe nativo pode desligar a presença; o painel padrão ONLINE/OFFLINE fica oculto durante corrida ativa.
3. A RPC `driver_mark_arrived` existe, autentica o motorista, exige corrida na fase correta e localização recente no banco, retornando status de chegada. O código nativo anterior descarta erros HTTP/exceções sem diagnóstico, impedindo distinguir falha do FGS, GPS, sessão ou rejeição pelo servidor sem logs do aparelho.

## Correções QA280 apenas no código, sem APK

- `scripts/install-partner-driver-location.mjs`: ao gerar apenas o serviço Android **Motorista**, converte o limiar 5 m → 0 m; continua exigindo GPS real, prioridade HIGH_ACCURACY e intervalo mínimo original. Não altera serviço do Entregador.
- `scripts/fix-partner-qa280-active-ride-gps-recovery-v1.mjs`: injeta controle de recuperação na UI de corrida ativa. Se OFFLINE local, reutiliza o fluxo original de ativação; se ONLINE local, solicita localização recente/precisa, retoma FGS nativo, atualiza operação/etapa e verifica `driver_set_presence` com resposta de confirmação. Sem `callStart`, `callComplete`, cancelamento ou desligamento nativo na rotina.
- `superapp/partner-shell/shared/ApoisPickupPin.tsx`: escopa ajuste de quebra de linha apenas ao diálogo PIN, preservando texto integral e gesto original.
- `scripts/build-partner-release.sh`: inclui o novo patch Motorista e dois testes `node --test` estáticos em posições específicas, depois dos hardeners anteriores.
- Testes adicionados: `scripts/qa/test-partner-qa280-stationary-arrival-v1.test.mjs` e `scripts/qa/test-partner-qa280-active-gps-recovery-v1.test.mjs`.

## Proteção QA279 — conferência sem alterações

- Triggers de isolamento encontrados em `rides`, `ride_settlements`, `ride_pix_payments`, `cancellation_fees` e `driver_wallet_transactions`; `private.apois_qa_financial_guard` bloqueia lançamentos vinculados à corrida marcada.
- `handle_completed_ride_settlement` possui retorno antecipado para `private.apois_qa_is_ride(new.id)`.
- **Pendência:** não foi encontrado trigger `apois_qa_financial_*` na tabela `safe2pay_ride_transactions`; nenhuma transação existe para a corrida atual, que usa dinheiro. Validar dependências financeiras e possíveis caminhos de escrita antes de qualquer teste de finalização, sem modificar a proteção existente automaticamente.

## O que foi validado e o que NÃO foi

- Confirmado por consulta: baseline SHA, escopo diff limitado ao Motorista/build/testes/PIN; Supabase real, QA marker, estado intacto e ausência de registros financeiros listados.
- Inspeções estáticas de guardas do GPS, RPC, PIN e fluxo de build; parsing JavaScript de patchers/testes sem execução de side effects.
- **Não executado:** `node --test` completo em checkout com submódulos, TypeScript typecheck, Gradle/compilação Android, logcat, testes E2E físicos, confirmação de PIN, início/fim, regressão do Entregador. Não marcar homologação concluída.
- **Nenhuma GitHub Action, merge, alteração em banco ou APK realizada.** A QA278 segue instalada e a corrida QA279 foi preservada.

## Próximo gate

Reproduzir `node --test` e `bun run typecheck` em checkout completo com fonte pinada, compilar/validar serviço nativo, auditar lacunas financeiras antes da finalização e depois analisar logs físicos do Android. Não instalar QA280 por cima da QA278 até haver estratégia de continuidade para a corrida ativa.
