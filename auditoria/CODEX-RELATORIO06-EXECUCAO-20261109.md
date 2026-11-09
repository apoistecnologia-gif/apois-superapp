# APOIS — Relatório 06 | Histórico e recibos do Motorista

**Execução:** 09/11/2026. **Fonte recebida:** Relatório 06 de 08/11/2026, INV-052 e INV-053 (ambos P2).  
**Repositório de integração:** `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.  
**Snapshot Motorista/Admin:** `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`, protegido.  
**Lock:** `.apois/source-lock.json` conferido; os três pins permaneceram iguais. Relatórios 01–05 não foram apagados.

## Achados e estado após implementação

| Achado | Estado | Correção versionada | Validação restante |
|---|---|---|---|
| **INV-052** | **B — implementado; sem homologação integral** | `scripts/fix-report06-motorista-receipt-v1.mjs` é aplicado após o hardener existente. `finiteNonNegative` conserva `null`/`undefined`/vazio como indisponíveis e mantém zero legítimo; `final_price` ausente deixa usar `estimated_price` válido. Etiqueta o preço estimado sem alegar pagamento confirmado. Distância e duração ausentes não viram zero. Na lista, a mesma regra elimina números falsos. | `node --test` de checkout, TypeScript, renderização real com jsPDF, layouts/textos longos e UI Android. |
| **INV-053** | **B — implementado; sem homologação integral** | `scripts/fix-report06-motorista-history-period-v1.mjs` atua **depois** de `fix-motorista-history-cursor-v1.mjs`, sem substituí-lo. Primeira página e páginas anteriores passam a consultar período no servidor; continuam cursor `(created_at,id)`, identidade autenticada, limite de 50+1 e deduplicação. Resumo consulta independentemente até 500 linhas por lote, sem exigir abertura das páginas do histórico; contabiliza período e separa bruto da carteira. | Typecheck, PostgREST autenticado em staging, RLS, período antigo, mudanças concorrentes, atualização de preço/status, fuso e interface real. |

## Regras preservadas e detalhes

- **Motorista próprio:** as consultas permanecem condicionadas a `driver_id` derivado de `loadDriverProfile()`; após carregar páginas e agregados há verificação de identidade. Nenhum ID arbitrário vindo do usuário é utilizado.
- **Datas:** o filtro servidor usa `completed_at` quando existente ou `created_at` caso contrário, como na lista anterior. Hoje, 7 e 30 dias usam limites do dia local; personalizado é inclusivo até 23:59:59.999. São gerados timestamps ISO para o PostgREST.
- **Ordenação:** histórico preserva `created_at DESC, id DESC`; mais páginas continuam 50 por vez. Resumo usa lotes read-only de 500 linhas, ordenados de modo determinístico. Não foi criado RPC nem migration.
- **Custo e integridade:** o resumo tem teto defensivo de **10.000 corridas por solicitação**. Caso o limite seja atingido, um aviso diz expressamente **Resumo parcial**; não apresenta o total como completo. A página de histórico não força download ilimitado de todos os cartões.
- **Busca textual:** permanece na lista carregada; um aviso informa que o resumo corresponde a **todo o período** e não à busca textual. Esta é uma limitação consciente, não um total silenciosamente parcial. A busca textual em todo o histórico ainda precisará de estratégia server-side para resultado global.
- **Concorrência:** consultas paginadas do resumo não compartilham snapshot transacional entre lotes. Inserções/atualizações durante a leitura podem exigir reconsulta; isso precisa ser observado em staging.
- **Dinheiro:** valor bruto da viagem não é saldo de carteira. Nenhuma cobrança, carteira, ledger, settlement ou dado financeiro foi modificado.
- **PDF:** hardener de identidade e recebimento direto, já existente, permanece antes do patch. Estimativa fica rotulada como tal, nunca como pagamento confirmado. Não foi criado recibo fiscal novo.

## Arquivos de integração versionados

| Arquivo | Mudança |
|---|---|
| `scripts/fix-report06-motorista-receipt-v1.mjs` | Novo patch incrementado de recibo, idempotente |
| `scripts/qa/test-report06-receipt-v1.test.mjs` | Novo teste Node de conversão numérica extraída do código real |
| `scripts/fix-report06-motorista-history-period-v1.mjs` | Novo patch da paginação já existente, filtro servidor, resumo de período, alertas e campos ausentes |
| `scripts/qa/test-report06-history-period-v1.test.mjs` | Novo teste Node com fixture pinada e 0/1/50/51/500 viagens |
| `scripts/build-partner-release.sh` | Execução explícita dos novos patches e gates após seus predecessores |
| `scripts/harden-motorista-history-recovery.mjs` | Compatibilidade de idempotência com dependências de reload por período |

Nenhum arquivo do snapshot `sources/` foi editado; nenhum arquivo de APOIS Entregas foi alterado.

## Verificação de execução efetiva

**Conferido no GitHub:** source lock, matriz de 51 achados, execução do Relatório 05, rota pinada de histórico, gerador PDF pinado, hardener de recibos, recovery, cursor OBS-011 e ordem real da build Parceiro. Verificado que o hardener de recibo é importado por `harden-partner-motorista-payment-policy.mjs`.

**Executado em runtime JavaScript isolado, com leitura do código real pinado e filesystem simulado:**

1. INV-052: gerador real aplicado à fonte pinada com os rótulos do hardener anterior; patch presente e **10 casos numéricos** verificados (ausentes, zero, positivos, negativos, NaN e infinito).
2. INV-053: executados os scripts reais `harden-motorista-history-recovery` → `fix-motorista-history-cursor-v1` → `fix-report06-motorista-history-period-v1` em cópia em memória. **Primeira e segunda passagem sem erro**; 7 verificações estruturais passaram.
3. Extraídos do resultado gerado os corpos de conversão, limites de período, filtro do PostgREST e agregado. **Cinco conjuntos sintéticos (0, 1, 50, 51, 500 corridas) passaram**, com canceladas, estimado, final zero e final ausente. O período personalizado antigo e o cursor nas duas ramificações de data passaram na simulação.
4. Detectada e corrigida uma falha no próprio teste do agregado: a extração inicial não incluía a inicialização do acumulador. A extração corrigida foi reproduzida com resultado aprovado.

**Não executado:** testes `node --test` versionados no checkout completo; `bun install`; TypeScript/typecheck; lint; build Vite; renderização de PDF; chamada Supabase real ou staging; testes de React; Android/APK; produção; migrações; mensagens; pagamentos e movimentações. Testes de V8 são sintéticos, **não equivalem a aplicação funcionando em produção**.

## Riscos residuais e próximos gates

1. Rodar gates Node/TS/Vite em checkout com `sources/` pinados, sem criar APK; corrigir qualquer erro real de tipagem antes de liberar a fase final.
2. Conferir no **backend de homologação** a interpretação do filtro PostgREST, RLS, 51/500+ registros, datas em fuso Recife, tentativas interrompidas, concorrência entre páginas e limite explícito de 10.000. O uso de offset no agregado pode observar alterações concorrentes; requer controle/QA de consistência.
3. Verificar PDF renderizado e recibos com campos ausentes/textos longos no momento permitido. Comparar valores do cartão, detalhe e PDF usando o mesmo fixture.
4. Preservar as pendências INV-044–046, INV-050 e os bloqueios anteriores; nenhuma migração `QA_NOT_APPLIED` aplicada.

## Retorno à matriz

Acrescentar **INV-052 B** e **INV-053 B**, sem reclassificar os 51 anteriores. **Total: 53** (A 0 / B 37 / C 13 / D 0 / E 1 / G 2). O critério para A continua exigindo compilação e E2E de homologação.

**Reversão:** reverter apenas os commits incrementais do Relatório 06 nessa branch. Como nenhum serviço externo/banco foi alterado, não existe rollback remoto a executar.

**Gates preservados:** sem merge, APK, homologação física, deploy, migração nem escrita em produção. A continuação aguarda o Relatório 07 ou posterior, e somente a frase de autorização específica permite homologação final.
