# APOIS Motorista — QA280 | Diagnóstico, correções isoladas e homologação pendente

Data: 16/11/2026 (America/Recife). Base QA278: `df9a1ee55e7825a90ad50012c30f817783c33257`.

## Escopo e preservação

Somente Motorista/APOIS Parceiro. O Supabase consultado é `tbbzkrfupmqdywnzgnms`. Nenhuma migração, alteração financeira, mudança de PIN ou de regras de corrida foi executada. Entregador, branches de produção e a APK QA278 instalada permanecem sem alterações. Nenhum merge ou GitHub Actions foi executado.

Corrida de homologação já existente: `0ceba5e4-8a3a-4bdc-a343-35df7d98ad4f`. Mantida em `motorista_a_caminho`, não iniciada, não finalizada, sem `driver_arrived_at`. Registro de isolamento `private.apois_qa_motorista_rides` confirmado. Nenhum settlement, wallet transaction, Pix ou Safe2Pay relacionado à corrida foi observado.

## Evidência direta

- Último `drivers.last_location_at`: 16/11/2026 15:19:14 UTC (12:19 local), latitude/longitude a cerca de 2 metros do pickup.
- `drivers.updated_at` após a interrupção: 15:24:33 UTC; `is_online=false`.
- HTTP `driver_set_presence` 200 até 15:19:14 UTC; essas chamadas usaram o user agent da **WebView** (`supabase-js`).
- Às 15:24:31 UTC houve renovação de sessão 200; às 15:24:32 uma presença 401 seguida de respostas 200, incluindo duas chamadas do **serviço nativo Android** (`Dalvik`).
- Nenhum POST para `driver_mark_arrived` no intervalo analisado. A função oficial exige usuário autenticado, corrida atribuída, GPS recente e proximidade; não houve evidência de que tenha sido acionada.
- A chegada automática QA235 conta 3 leituras reais suficientemente precisas em >=6,5 segundos dentro de 85 metros. O pedido normal de localização do serviço Android define deslocamento mínimo de 5 metros, o que pode impedir novas leituras com o motorista parado.
- A API `driver_set_presence` considera apenas `em_viagem` no sinal `tracking_active_ride`; isso precisa de estudo de impacto independente antes de eventual migração SQL. O motorista de teste estava elegível (aprovado, assinatura teste permitida, KYC pronto).

## Correções da branch QA280

1. `scripts/install-partner-qa235-native-auto-arrival.mjs`: durante a aproximação ativa, heartbeat de 15s solicita um **novo** fix Android via `CurrentLocationRequest`, prioridade `PRIORITY_HIGH_ACCURACY`, idade máxima de cache **0ms**, timeout de 10s e exclusão de requisições simultâneas. Reutiliza os filtros de precisão/posição, a presença autenticada, as 3 leituras e a RPC oficial. Não cria serviço paralelo nem afeta Entregador ou GPS fora de corridas ativas.
2. `scripts/fix-partner-qa280-driver-active-gps-recovery.mjs`: no workspace descartável do Motorista, botão de recuperação durante corrida ativa quando a interface detecta OFFLINE/erro. Revalida sessão e atribuição da corrida no Supabase, exige fix GPS real com precisão <=65m, exige ACK do serviço Android e RPC `driver_set_presence` confirmando `is_online=true` antes de mudar o estado da interface. Sem chamadas de chegada, PIN, cancelamento, conclusão ou financeiro. Em falha, exibe erro e interrompe um serviço recém-iniciado se a RPC rejeitar.
3. `superapp/partner-shell/shared/ApoisPickupPin.tsx`: rótulo visual do deslizador abreviado para “Confirmar PIN e iniciar”, para evitar corte em telas estreitas. Validação de PIN de 4 dígitos e callback oficial são preservados.
4. `scripts/build-partner-release.sh`: aplica o reparo somente depois da montagem das alterações homologadas do Motorista, antes do seu build; preserva pipeline do Entregador.

## Testes realizados sem APK

- Execução isolada da transformação QA280 sobre fixture representativa do serviço Java: **10 de 10 verificações passaram** (heartbeat, GPS novo, precisão, ausência de sobreposição, gates, preservação do FGS).
- Testes persistidos de fonte de GPS: **3 passaram**, um teste de Java nativo gerado ficou **pendente** (projeto Android não materializado).
- Execução isolada da transformação de recuperação do Motorista sobre fixture JSX: **6 verificações passaram**.
- Testes persistidos de recuperação de interface: **3 passaram**, integração da rota gerada ficou **pendente** (workspace não materializado).

**Não executados:** TypeScript build integral, Gradle/Java build, testes instrumentados Android, homologação física de chegada, PIN e finalização. Não registrar esses como aprovados.

## Gates antes da próxima APK

1. Materializar workspace e Android com o procedimento de build já existente, sem GitHub Actions. Executar testes QA280 e verificar se o serviço Java final inclui o método `qa280RequestFreshPickupFix`.
2. Verificar compilation TypeScript, Android/Gradle, permissões e regressões de navegação externa, bolha e PIN. Nenhuma alteração no Entregador.
3. Reconfirmar o estado da corrida real e da proteção financeira QA279. Não instalar uma nova APK sobre QA278 até decidir se a corrida permanecerá preservada e como retomar com segurança.
4. Testar recuperação do GPS e chegada apenas com localização real no aparelho, seguindo uma instrução física por vez; obter prova da RPC/estado/notification. Validar isolamento financeiro antes de qualquer finalização.

A branch QA280 não está homologada nem pronta para distribuição enquanto esses gates não passarem.
