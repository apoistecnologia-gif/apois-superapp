# APOIS — Relatório 13 | Histórico local e seleção de destino

**Data:** 09/11/2026. **Fonte de auditoria:** `RELATORIO-13-APOIS-HISTORICO-LOCAL-E-SELECAO-DE-DESTINO-20261109(1).md`. **Achado novo:** INV-066 (P2).  
**Execução autorizada:** `apoistecnologia-gif/apois-superapp`, **`audit/continuacao-20261107`**. **Sem commit nos repositórios-fonte, merge, GitHub Actions, APK, produção, geocodificação real, conta ou migração.**

## 1. Continuidade confirmada

Antes das alterações, o GitHub foi consultado diretamente:
- `.apois/source-lock.json`, blob **`3f98789f28666ccc052175db10f138208dd0937b`**. Pinos preservados: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- `auditoria/CODEX-RELATORIO12-EXECUCAO-20261109.md` e matriz histórica: **65 achados** (A 0 / B 45 / C 16 / D 0 / E 1 / G 3).
- Snapshot Passageiro: `src/hooks/use-destination-history.tsx` (blob `c2efa4b46a520120d1d9523d69d98dc5ca3c2616`); `src/services/destinations/destination-storage.ts` (blob `ee188afaa21f3c4f34730e6c7d346ccbdfcf7d9c`); `src/services/destinations/recent-destinations-service.ts` (blob `ec19d0ea3f7176ea86738af8bd0ad04a1f561c21`); `src/services/destinations/favorites-service.ts` (blob `22879a691f9a576824ca6c02ef3b83cdc962f2e5`); e `src/routes/_authenticated.buscar-destino.tsx`.
- Transformações existentes: `harden-corridas-save-favorites-in-search.mjs`, `fix-corridas-passenger-destination-suggestions-v2.mjs`, `fix-report12-destination-map-v1.mjs`, `harden-corridas-superapp-storage.mjs` e `build-isolated-module.mjs`.

O relatório do auditor usa `audit/ecossistema-20261107` apenas como ramo de investigação. **Todas as gravações desta execução foram feitas na branch oficial `audit/continuacao-20261107`.** Nenhuma fonte pinada foi modificada.

## 2. Diagnóstico comprovado — INV-066 (P2)

No fluxo de busca, `handleSelectSuggestion` resolve detalhes válidos pelo Places, mas antes de `handleFinalSelection` grava o histórico por `useDestinationHistory.addToHistory` → `recentDestinationsService.addRecent` → `DestinationStorage.saveRecent` → `localStorage.setItem`. O `setItem` pode lançar por quota/armazenamento negado; como essa falha caía no `catch` geral de sugestão, **o destino válido não era aplicado** e podia surgir erro inadequado de detalhes.

O mesmo padrão ocorria no clique em histórico e, após Relatório 12, no caminho de confirmação pelo mapa. Persistir um **recente** é uma conveniência, não pré-requisito para selecionar destino/parada válido. Diferentemente, o botão explícito de **salvar favorito** deve garantir que a gravação ocorreu, não apenas que o callback foi chamado.

**Limite factual:** a falha foi reproduzida em código real com armazenamento simulado, não ocorreu necessariamente em um aparelho de usuário. Não há evidência de erro de cobrança, expedição de corrida para coordenadas incorretas ou vazamento entre contas.

## 3. Correção implementada na integração

### 3.1. Novo gerador `scripts/fix-report13-destination-history-v1.mjs`

Transforma **somente na cópia isolada Corridas**, preservando a estrutura existente:

**`src/hooks/use-destination-history.tsx`**
- `addToHistory` e `addFavorite` passaram a retornar `boolean`: `true` **após** a chamada de persistência terminar, `false` se não houver usuário autenticado. Erros de `getRecent`/salvamento/serviço continuam propagando para o tratamento específico do consumidor.
- Uma falha ao atualizar a lista React local por `refresh()` **depois de escrita confirmada** não é confundida com erro de gravação: ela não reverte o resultado de armazenamento já concluído. O estado visual pode exigir uma atualização posterior; isso permanece pendente de teste em dispositivo.
- Não modificou `DestinationStorage`, o limite de 20 recentes, a deduplicação nem regras de favoritos Casa/Trabalho/outros.

**`src/routes/_authenticated.buscar-destino.tsx`**
- Nova validação compartilhada de endereço: identificador, rótulo/endereço não vazios, números finitos, latitude -90 a +90 e longitude -180 a +180. Destinos inválidos não seguem para persistência/seleção.
- Nova `completeAddressSelection`: tenta **apenas o histórico** em `try/catch` estreito, sempre chama `handleFinalSelection(details)` para endereço válido e, se o histórico não foi salvo, exibe aviso **não técnico**: *“Endereço selecionado, mas não foi possível salvar no histórico deste aparelho.”* Não engole erros de Places, validação, Maps nem captura indiscriminadamente falhas da seleção principal.
- Reutilizada em **sugestão**, **histórico** e **mapa**, mantendo o mesmo tratamento de destino versus parada e a gravação de históricos quando disponível.
- `saveAddress` só emite sucesso Casa/Trabalho/Outro quando `addFavorite` retorna `true`. Se não houver sessão, a gravação falhar ou o local for inválido, informa o motivo funcional e mantém o modo de salvar, sem fingir que o favorito foi persistido.
- Na confirmação pelo mapa, falha de favorito deixa a escolha aberta para nova tentativa. Sucesso no mapa com histórico indisponível ainda aplica o destino ou parada **depois da validação real da posição e do endereço**, preservando as proteções INV-064 e INV-065.

O gerador **não** cria outra base de dados, outro destino nem um fluxo paralelo. Usa os serviços, callbacks e identidade visual anteriores. Antes de qualquer escrita na cópia, exige marcadores e âncoras únicas e verifica que todos os contratos estão presentes; falha sem adaptação silenciosa se scripts anteriores divergirem.

### 3.2. Reconciliação de isolamento no builder

Ao ler o `scripts/build-isolated-module.mjs`, observou-se que o **hardener já versionado** `scripts/harden-corridas-superapp-storage.mjs` não estava listado na sequência principal deste builder. A fonte pinada ainda usava chave de sessão `sb-...` no `DestinationStorage`, enquanto o `adapt-corridas-current.mjs` já isolava a sessão Auth como `apois-superapp-corridas-auth-v1`. Para **preservar a correspondência de identidade afirmada no relatório de auditoria**, o builder agora invoca esse hardener depois de `adapt-corridas-current` e **antes** dos demais fluxos; ele adapta o leitor para a chave isolada, com formatos de sessão previamente suportados. Também ajusta a chave local de dispositivo push, finalidade já prevista pelo script antigo.

Essa é uma ligação de código existente, **não um armazenamento novo**. Não foi demonstrado isolamento entre contas reais; isso requer teste de troca de usuário no produto montado. A invocação foi ensaiada em memória contra o arquivo de storage pinado e o padrão de chave push pinado, sem gravar sessão real.

O Relatório 13 roda **após** `fix-report12-destination-map-v1.mjs` e os testes do Relatório 12, **antes** da captura de baseline funcional do mapa. `node --test scripts/qa/test-report13-destination-history-v1.test.mjs` foi conectado ao mesmo ponto. A proteção de pureza visual anterior, o snapshot de Maps/GPS e a proteção final de comparação **não foram removidos**.

## 4. Testes e evidências

### Executados nesta sessão — V8 com fontes e mocks

- **5/5 transformações encadeadas sem falha:** hardener de storage existente → favoritos existentes → feedback de autocomplete existente → gerador Report12 → novo gerador Report13. As transformações foram executadas com conteúdo pinado real e filesystem interceptado **somente em memória**. Apenas os marcadores anteriores estritamente necessários ao mapa e à busca foram representados em memória; não houve `build-isolated-module` completo.
- **11/11 contratos de compatibilidade** em comparação anterior: Report12/13 coexistem, `addToHistory` declara retorno de êxito, guarda de favorito em sugestão e histórico continua, modo mapa e `completeAddressSelection` coexistem, falha de histórico isolada e mensagens específicas disponíveis.
- **14/14 testes de regressão reais da suíte versionada executados em runtime V8 adaptado, sem Node test runner**: seleção por sugestão válida + quota falha, controle com escrita bem-sucedida, erro real de detalhes não disfarçado, destino inválido, histórico com coordenada corrompida, modo parada, favorito falhando/sem sessão, favorito salvo com sucesso, mapa com falha de histórico, mapa com falha de favorito, retorno do provider após falha de refresh, falha ao gravar/missing session, JSON corrompido/leitura negada e deduplicação/limite 20 do serviço original.
- Não foram enviadas solicitações reais a Supabase/Google Maps, nem tocado `localStorage` do usuário.

### Versionados mas NÃO executados no checkout/Android

A suíte Node de **14 testes** foi gravada e ligada ao futuro builder. **Não** houve invocação efetiva de `node --test` no checkout, `bun run typecheck`, Vite, compilação React, renderização de UI, teste Android/WebView ou troca de contas reais. Testar em hardware: quota, acesso negado, cache/histórico corrompido, UX de aviso, seleção de parada/destino em sugestão, histórico e mapa, e persistência/visibilidade de favoritos entre sessões.

**Não realizado:** APK, publicação, merge, request de corrida, pagamento, rollback de produção, API paga, deploy Supabase ou migrations `QA_NOT_APPLIED`. Nada disso pode ser inferido a partir de V8 isolado.

## 5. Arquivos versionados e reversão

- `scripts/fix-report13-destination-history-v1.mjs` — **novo**; alteração do provider e handlers na cópia isolada.
- `scripts/qa/test-report13-destination-history-v1.test.mjs` — **novo**; 14 testes de regressão com fixtures, sem rede.
- `scripts/build-isolated-module.mjs` — **modificado** para invocar o hardener de sessão existente e o Report13/testes, sem remover gates antigos.
- `auditoria/CODEX-RELATORIO13-EXECUCAO-20261109.md` — relatório.
- `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` — somente acréscimo do INV-066 e novo resumo.

Reverter os commits dessa fase na branch remove o gerador/testes e a ligação ao hardener, preservando os arquivos-fonte fixados. Como nada foi aplicado no produto de usuários ou banco vivo, **não há rollback de dados de produção** nesta execução.

## 6. Classificação e pendências

**INV-066 = B** — código corrigido/versionado com mocks funcionais, pendente validação no checkout e homologação física.

**65 achados anteriores preservados, +1 INV-066 = 66 achados: A 0 / B 46 / C 16 / D 0 / E 1 / G 3.**

Dependências anteriores intactas, especialmente **INV-054 G**, **INV-055 C**, **INV-056 C** e **INV-061 C** (a migração `QA_NOT_APPLIED` de exclusão continua **não aplicada**). Não declarar lançamento pronto; falta autorização expressa antes da homologação final: **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
