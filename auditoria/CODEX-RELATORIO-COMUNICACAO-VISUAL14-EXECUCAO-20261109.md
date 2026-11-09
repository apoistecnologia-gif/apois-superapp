# APOIS — RV-14 | Relatório independente de execução: estados de reconexão

**Data:** 09/11/2026  
**Entrada:** RELATORIO-VISUAL-14-APOIS-ESTADOS-RECONEXAO-20261109(1).md  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch escrita:** `audit/continuacao-20261107`  
**HEAD inicial confirmado:** `75d3c568fa2c7b364ce074a928e080ef3d55dd6c` (conclusão RV-13).  
**Auditor externo, somente leitura:** `audit/ecossistema-20261107`.  
**Estado:** RV-14 **implementada no integrador e parcialmente verificada**, **sem homologação real**.

## 1. Baseline e fontes protegidas

A branch autorizada foi conferida antes de qualquer escrita. A matriz e o relatório RV-13 estavam presentes com 48 registros CV-001–CV-048. O arquivo `.apois/source-lock.json` permanece no blob SHA **`3f98789f28666ccc052175db10f138208dd0937b`**:

| Fonte fixada | Commit (somente leitura) |
|---|---|
| apoistecnologia-gif/apois-entregas | `2f4606e0fb52dffb49f2e6aebbe921ce687ab625` |
| apoistecnologia-gif/say-hello-buddy-23-84b5dcbf | `7b047f75a1a919a5336c0df6e0d60b14b02f2618` |
| apoistecnologia-gif/movvi-go-connect | `9fc171050d8b5703540c49d19a8f1e9f5162775f` |

Sem alterações nos repositórios-fonte e sem mexer no arquivo de lock. Nenhuma alteração em SQL/RLS, Auth, servidores, presença, financeiro, Maps ou contratos RPC.

## 2. Qual componente o build realmente utiliza

A central de solicitações **não é importada diretamente de uma fonte publicada estática**. `scripts/harden-partner-available-calls-v1.mjs` escreve `src/components/ApoisAvailableCalls.tsx` nas cópias `.work/partner-motorista` e `.work/partner-entregador` e instala os botões/instâncias nas rotas dos dois papéis. O builder efetivo `scripts/build-partner-release.sh` executa esse gerador para ambos.

Por isso, RV-14 introduziu **overlay posterior** ao gerador, sem alterar o literal de origem, a extração dos componentes, seus contratos ou os repositórios pinados. Após os demais hardeners operacionais/visuais, o builder aplica `fix-partner-available-calls-visual14-v1.mjs` por papel, executa sua suíte de testes e exige o marcador `APOIS_CV14_AVAILABLE_CALLS_STATE_V1` no componente gerado.

No Passageiro, o builder `scripts/build-isolated-module.mjs` aplica `fix-corridas-active-ride-visual14-v1.mjs` na cópia `.work/corridas`, depois de todos os demais overlays Corridas RV-11 e antes da compilação. A verificação exige os dois marcadores de rota e cabeçalho.

A RV-14 não assume que o APK distribuído corresponde a esse novo build; não houve rastreamento de SHA de APK/deployment.

## 3. CV-049 / VIS-050 — tempo restante e dado envelhecido

**Antes:** a central exibia `Math.ceil(call.remaining_seconds/60) + " min"` mesmo para `remaining_seconds=1`; a lista era consultada a cada 15 s quando `navigator.onLine`, sem decrementar a apresentação entre consultas. A ausência de resposta recente não se refletia na interface.

**Depois:** a apresentação conserva o prazo reportado pela última RPC, guarda o instante da resposta e usa relógio local de 1 s enquanto a central está aberta/online. Exibe **segundos** quando restam menos de 60 s, e avisa **"Prazo estimado encerrado"** ao esgotar a estimativa local. Depois de 20 s sem atualização, a tela comunica a desatualização. O botão para assumir fica preventivamente desabilitado quando a estimativa local terminou ou a consulta está antiga; atualizar a lista restaura uma visão recente.

**Fronteira:** o relógio do dispositivo não modifica o prazo oficial, não evita corrida concorrente, não modifica o raio, não confirma disponibilidade e **não substitui a conferência atômica de aceite no servidor**. Mesmo uma chamada mostrada como disponível está sujeita ao resultado oficial da RPC. O bloqueio local pode ser mais conservador que a condição do servidor; homologar relógio/retomada e ergonomia.

## 4. CV-050 / VIS-051 — mensagem da falha de aceite

**Antes:** `claim.catch` definia `message` e chamava `await refresh()`, cujo sucesso executava `setMessage(null)`; dessa forma, uma consulta bem-sucedida eliminava o resultado insatisfatório de uma ação distinta.

**Depois:** `claimMessage` retém o resultado da tentativa malsucedida como alerta específico. `refresh()` continua a atualizar a lista e seu erro próprio, mas não apaga `claimMessage`. Novo toque em Assumir limpa o alerta anterior; sucesso continua chamando `onAccepted()` e `onClose()` existentes. A mensagem não afirma sem prova que houve expiração ou outra pessoa assumiu. Não há reenvio automático do aceite.

**Fronteira:** contratos RPC e payloads `_ride_id`/`_job_id` preservados, sem confirmação artificial de corrida/entrega ou operação real.

## 5. CV-051 / VIS-052 — consulta obsoleta após offline/fechamento

**Antes:** `refresh` usava a prop `online` capturada e aplicava `setCalls`/`setMessage(null)` quando a resposta chegava, mesmo após efeito de offline limpar a lista e comunicar "Fique ONLINE". Respostas fora de ordem também podiam sobrescrever uma lista mais recente.

**Depois:** `useRef` mantém geração do ciclo de abertura/disponibilidade e sequência da consulta. Antes de aplicar dados, erro ou fim de loading, cada promessa verifica se ainda é a última consulta do mesmo papel, com modal aberto e parceiro online. Fechamento, offline, troca de papel ou nova consulta invalidam a anterior. Limpeza e mensagem offline são preservadas contra resposta atrasada. Polling de 15 s, foco/push/resume do Motorista e do Entregador, consulta server-side e controles oficiais de presença não foram removidos.

**Fronteira:** não foi feito novo endpoint, permissão, RPC, alteração de banco ou validação de elegibilidade apenas no frontend.

## 6. CV-052 / VIS-053 — carregamento da corrida do Passageiro

**Antes:** a ramificação `screenState==="loading" || screenState==="idle"` devolvia seis Skeleton visuais sem mensagem de status para leitor de tela.

**Depois:** a mesma ramificação informa `Carregando informações da corrida…` com `role="status" aria-live="polite"` e passa `aria-hidden="true"` para os seis Skeleton. Hook `useActiveRide`, `loadRide`, `refreshRide`, rotas, status `not_found/unauthorized/failed`, mapa e lógica financeira permanecem intocados.

**Fronteira:** precisa confirmar anúncio no TalkBack real e que a troca para conteúdo carregado não o repete indevidamente.

## 7. Ampliações de VIS anteriores — sem novos IDs

- **VIS-028 / CV-027 — modal ApoisAvailableCalls:** foco inicial em Fechar, contenção de Tab e Shift+Tab, Escape invoca fechamento, foco retorna ao acionador. Não confundir com Radix Dialog ou alterar seu primitive.
- **VIS-004 / CV-003 — alvos de toque:** botão Fechar da Central ganha altura mínima de 44 px; Atualizar corrida do Passageiro passa de 36×36 para mínimo 44×44 px. Callback e disabled do botão mantidos.
- **VIS-039 / CV-038 — corte de instruções:** descrição do banner de reconexão e subtítulo do `RideStatusHeader` trocam `truncate` por quebra de linha `break-words` com entrelinha legível. Não altera ETA/status do cabeçalho nem encerra achado anterior de endereços longos em Entregas.

## 8. Arquivos alterados

| Caminho versionado | Motivo |
|---|---|
| `scripts/fix-partner-available-calls-visual14-v1.mjs` | Novo overlay idempotente/fail-closed para ambos Parceiros, estados, prazo e foco |
| `scripts/fix-corridas-active-ride-visual14-v1.mjs` | Novo overlay para carregamento e reconexão do Passageiro |
| `scripts/qa/test-partner-available-calls-visual14-v1.test.mjs` | Seis testes Node versionados com harness de corpos assíncronos |
| `scripts/qa/test-corridas-active-ride-visual14-v1.test.mjs` | Quatro testes Node versionados de apresentação e regressão |
| `scripts/build-partner-release.sh` | Vinculação posterior ao gerador e testes nos dois papéis |
| `scripts/build-isolated-module.mjs` | Vinculação e testes do Passenger Corridas |
| `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | CV-049–CV-052 e ampliações |
| `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL14-EXECUCAO-20261109.md` | Relatório de execução (este arquivo) |

## 9. Testes efetivamente realizados

1. **GitHub, leitura real:** conferência do HEAD inicial da RV-13, source-lock SHA, matriz, scripts dos geradores, regras server-side já existentes, snapshot do Passageiro, `RideStatusHeader` e ordem dos builders.
2. **Execução do overlay da Central em V8 sobre o componente literal extraído do gerador real:** script compilado em V8, transformação idempotente verificada, rejeição de deriva da âncora, preservação de chamadas server-side, mesmo código utilizado por Motorista/Entregador. Corrigidos dois erros do código de implementação durante a sessão (delimitador do template e exigência de atributo acessível) antes de consolidar a execução.
3. **Harness V8 das funções assíncronas extraídas da implementação:** **6/6 casos passando**, incluindo prazo de 1 s, falha de `claim` seguida de sucesso de `refresh`, resposta atrasada após offline, duas respostas em ordem invertida, segurança de foco e presença dos contratos RPC.
4. **Overlay do Passageiro sobre rota/header do commit pinado:** transformações idempotentes; a primeira versão do teste detectou que havia seis Skeleton e não cinco. Contagem corrigida e reexecutada.
5. **Harness V8 da suíte Passageiro com fixtures pinadas:** **4/4 casos passando**, incluindo status acessível, os seis Skeleton ocultos, refresh intacto, subtítulo quebrável, estados de erro existentes e ligação ao builder.
6. **Comparação final do GitHub até a gravação da matriz:** apenas sete arquivos de implementação/QA/matriz alterados; nenhum caminho `sources/`, `.apois/` ou `supabase/`; source-lock no blob SHA original.

**Limites rigorosos:** foram executados testes sintéticos em V8 sobre código real e fixtures, **não** `node --test` no checkout completo. Tampouco houve `bun run typecheck`, lint, build, renderização React, estilos computados, dispositivo Android, TalkBack, E2E, login real, alteração de disponibilidade, aceite de corrida/entrega, backend remoto, publicação, impressão ou APK. O fato de o script Node estar versionado e integrado aos builders **não significa que foi executado como Node com dependências reais**.

## 10. Gates e pendências

A próxima execução autorizada de build **sem publicação e sem gerar APK** deve executar os testes versionados, TypeScript, lint e bundle apenas em ambiente de teste isolado, com credenciais adequadas. Só então homologar com mocks controlados: parceiro fica offline durante RPC, fecha e reabre, inverte a ordem das respostas, falha ao assumir, perde conexão, retoma aplicativo, temporiza chamada próxima do prazo, e leitor de tela navega pelo modal. No Passageiro, verificar status de carregamento/reconexão e textos extensos em 320/360/390/412 px, teclado, fonte ampliada e Android/TalkBack.

**Continuam pendentes as RV anteriores:** CV-037 (tema Claro/Escuro/Auto Motorista), CV-038 (endereços longos), CV-039 P1 (adicionais e comanda na Central Merchant realmente distribuída) e CV-030 (não aplicável ao contrato pinado salvo evidência contrária). A RV-14 não os encerra.

## 11. Commits anteriores ao relatório

- `2c2f54bb21cece424f9b7e5ab46a2d2427ff53b4` — overlay Partner inicial.
- `83da2655b66ac15fbd8f3b020d4628d2d08d2b4f` — delimitador do template corrigido.
- `ca9b3d7d6b6d2f1176e558f9a97a455f4426b1d0` — anúncio acessível de consulta.
- `ec213263804a87ac2ff4ac7ce0902b3d4023d81a` — overlay Passageiro.
- `c8b93a6f0fa22412a001b8707b1a9dc6dfc7a3ba` — contagem dos Skeleton corrigida.
- `c1365fd852f55c90b3cc3a101686533d8593ffdd` — suíte Partner.
- `a87d97770cb8fe9f5b5c1f335fe3ada10ef5b4ce` — extração de tipo do harness corrigida.
- `57fb8286bed94ea43a07b49adb8df00ebdd06fdc` — suíte Passageiro.
- `6a36187303fdc6c40aff9cc1ddd302e8e19a8a72` — builder Parceiro.
- `b7c4769b46442a2ead755d4d52302dc29be255bd` — builder Passenger.
- `d8ee70be7559f7fbf8cc262dd186b26a1ab012d0` — proteção de tipos na contenção de foco.
- `f85126e41ed5c2e614192e5f38eda7e3315c4cd5` — matriz consolidada.

Todos ocorreram apenas na branch autorizada; nenhum merge, deploy, publicação ou APK.

## 12. Conclusão

**52 registros CV-001–CV-052** (48 anteriores + quatro novos; três ampliações sem duplicação). **67 achados técnicos históricos preservados** (A=0, B=46, C=17, D=0, E=1, G=3). Próximo registro visual disponível **CV-053**.

O relatório de auditoria traz **risco demonstrado no código**; esta execução entrega overlays reversíveis e testes de lógica em memória, mas **não comprova homologação do aplicativo montado**. Somente a autorização expressa do usuário permitirá gerar APK e iniciar homologação final.
