# APOIS — Relatório independente de execução — Comunicação Visual 09 (RV-09)

**Data:** 09/11/2026  
**Escopo:** Perfil, configurações, acessibilidade da exclusão e feedback pós-solicitação  
**Repositório:** apoistecnologia-gif/apois-superapp  
**Branch exclusivamente alterada:** audit/continuacao-20261107  
**Arquivo recebido e examinado integralmente:** RELATORIO-VISUAL-09-APOIS-PERFIL-EXCLUSAO-20261109(1).md  
**Numeração visual:** CV-027 / VIS-028 e CV-028 / VIS-029, prioridade P2.  
**Status real:** correção preparatória aplicada nos scripts de integração e verificada sinteticamente; **ainda não compilada ou homologada no aplicativo final**.

## 1. Estado inicial, evidências e restrições

A auditoria anterior RV-08 terminou em 26 achados CV-001–CV-026, com HEAD 0cd50a0602c3e43ad1096bc4310996f11284c68e. A referência do relatório externo a audit/ecossistema-20261107 **não** substituiu a branch autorizada. Não se reabriu nenhuma auditoria técnica ou visual concluída.

Inspeção exclusiva para leitura dos seguintes geradores e referências:
- scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs, no qual o diálogo é anexado ao fim de Motorista Configurações; preserva o RPC autenticado apenas após EXCLUIR;
- scripts/templates/PassengerAccountDeletion.tsx e scripts/harden-corridas-profile-account-deletion.mjs, incluindo serverConfirmed, completed e onConfirmed, sem reimplementar autenticação;
- scripts/harden-entregas-superapp-account-deletion.mjs, especificamente o literal requestAccountDeletion, que contém RPC seguida por signOut no mesmo try/catch;
- scripts/harden-partner-motorista-settings-cleanup.mjs, que já protege atalhos de segurança e configurações sem reintroduzir opções incompletas;
- scripts/build-partner-release.sh, scripts/build-isolated-module.mjs, scripts/build-merchant-panel.mjs e respectivas ordens de montagem;
- snapshot oficial de Motorista Configurações em movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f, somente para leitura.

O arquivo de bloqueio .apois/source-lock.json conservou o blob SHA **3f98789f28666ccc052175db10f138208dd0937b**. Os três commits de fonte pinados permanecem:
- Entregas 2f4606e0fb52dffb49f2e6aebbe921ce687ab625
- Corridas / Passageiro 7b047f75a1a919a5336c0df6e0d60b14b02f2618
- Corridas / Motorista/Admin 9fc171050d8b5703540c49d19a8f1e9f5162775f

Nenhuma fonte pinada ou backend recebeu escrita.

## 2. CV-028 / VIS-029 — resultado verdadeiro da solicitação no Cliente Entregas

**Causa confirmada:** no literal produzido por harden-entregas-superapp-account-deletion.mjs, o bloco requestAccountDeletion faz a sequência:

1. confirmação humana com EXCLUIR;
2. removeCustomerPushRegistration(true);
3. RPC request_own_account_deletion;
4. auth.signOut();
5. navigate para /login.

O mesmo catch continha a mensagem de falha da **solicitação** mesmo depois de a RPC retornar sem erro. Uma falha de signOut não desfaz, por si só, o aceite do backend.

**Correção visual implementada:** scripts/fix-apois-account-deletion-visual09-v1.mjs adiciona uma variável local **de comunicação** deletionRequestConfirmed, inicialmente falsa, que se torna verdadeira **somente após a resposta da RPC sem erro**. Preserva as chamadas, sequência, parâmetros, handlers, condicionais de confirmação e navegação. O catch agora diferencia:

| Resultado da execução | Comunicação |
|---|---|
| Cancelar / não digitar EXCLUIR | Não inicia RPC; nenhuma mensagem de erro |
| Falha antes de RPC, ou resposta da RPC com erro | “Não foi possível solicitar a exclusão da conta. Tente novamente.” |
| RPC sem erro, mas falha no signOut ou na etapa posterior de saída | “A solicitação de exclusão foi registrada, mas não foi possível concluir a saída da conta. Saia manualmente ou procure o suporte.” |
| RPC sem erro e saída/navegação concluídas | Comportamento de navegação original, sem alerta novo |

Não houve nova chamada automática, reenvio, rollback presumido, exclusão real ou transformação do contrato de autenticação. O fluxo atual já havia convertido a desativação em solicitação autenticada no builder Merchant; o RV-09 não incluiu essa conversão funcional em outros builders.

**Local gerado quando o builder roda:** .work/entregas/src/routes/perfil/dados-pessoais.tsx.

**Ponto de atenção de integração:** scripts/build-merchant-panel.mjs executa harden-entregas-superapp-account-deletion.mjs antes do overlay. Já scripts/build-isolated-module.mjs no modo entregas não mostra chamada explícita a esse hardener, embora contenha outras transformações de conta e segurança. Não é possível afirmar por esta evidência qual pacote Cliente Entregas está publicado. Não foi introduzida alteração de desativação/autenticação no builder distinto apenas para “uniformizar” o fluxo: a compatibilidade deve ser verificada pela engenharia e pela identificação do artefato distribuído.

## 3. CV-027 / VIS-028 — gestão de foco nos diálogos de exclusão

**Causa confirmada na base lida:** os dois diálogos personalizados (Motorista V4 e PassengerAccountDeletion) já tinham role="dialog", aria-modal="true" e aria-labelledby, mas não continham gestão explícita do foco, contenção de Tab/Shift+Tab, isolamento do fundo e restauração de foco. O relatório não prova defeito físico do TalkBack nem substitui homologação.

**Correção implementada sem redesenho funcional:**
- Novo template scripts/templates/useApoisDeletionDialogFocus.ts, instalado apenas nos workspaces descartáveis .work/partner-motorista/src/lib e .work/corridas/src/lib quando seus respectivos modos são montados.
- Hook React useApoisDeletionDialogFocus(open) que foca **Cancelar** ao abrir; usa o nó do diálogo como fallback de foco, intercepta Tab/Shift+Tab para manter navegação interna e delega Escape **somente** ao Cancelar habilitado, sem tocar na confirmação destrutiva.
- Enquanto o diálogo está aberto, irmãos de sua cadeia DOM recebem inert e aria-hidden, com restauração exata dos atributos prévios quando fecha; também há redirecionamento de focusin externo e retorno ao elemento acionador ao fechar.
- Motorista mantém a ação V4 de handleDeleteAccount (abrir puro), confirmDeleteAccount (RPC apenas depois de EXCLUIR), mensagem de escopo compartilhado Corridas e aviso sobre retenções. A nova ref está no botão Cancelar, sem foco inicial na ação destrutiva.
- Passageiro mantém seu estado serverConfirmed/completed, RPC com retorno ok, tratamento de corrida ativa, onConfirmed e fechamento pré-existentes. A nova ref inicial aponta para o botão acessível de cancelar.

O gerador não altera SQL/RLS, Supabase, token, sessão, eventos de conta, estado de corrida, callbacks de exclusão, guarda de EXCLUIR ou configuração existente. As mudanças são exclusivamente na apresentação/modal.

## 4. Arquivos criados ou modificados

| Tipo | Caminho | Motivo |
|---|---|---|
| Novo | scripts/templates/useApoisDeletionDialogFocus.ts | Hook de foco/isolamento para os dois modais próprios |
| Novo | scripts/fix-apois-account-deletion-visual09-v1.mjs | Overlay fail-closed e idempotente nos três modos motorista/passageiro/entregas |
| Novo | scripts/qa/test-apois-account-deletion-visual09-v1.test.mjs | Testes Node versionados com geradores reais, mocks de RPC/signOut e simulação DOM |
| Modificado | scripts/build-partner-release.sh | Aplica CV-027 no Motorista depois do V4/hardeners e antes de typecheck |
| Modificado | scripts/build-isolated-module.mjs | Aplica CV-027 no Passenger após o template de exclusão ser montado |
| Modificado | scripts/build-merchant-panel.mjs | Aplica CV-028 na rota Entregas após hardener existente e antes da compilação |
| Modificado | auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md | Acrescenta CV-027 e CV-028, preservando as linhas anteriores |
| Novo | auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL09-EXECUCAO-20261109.md | Registro independente desta rodada |

Os três builders passaram a incluir o comando para a **mesma suíte Node** como gate de regressão e checagem de marcadores após a transformação.

**Commits relevantes de criação/integração registrados no GitHub:**
- 47dd136b714231c8b42de0baa7420e4d00c49e2e — novo hook.
- 02cab10ea1b40ca954d43b90c3e87c8c81c20606, revisado em 4818110129bd308c4f38f75f874be990469b6617 e c402fad69d518054651dee0ac3234b7708b109e3 — overlay e robustez de reaplicação.
- c52dc3c02f521ec10f46d14850a116dbf82117f7, ampliado em 5f2d1ee25c2ebb0a2569c9bf0e1b18fa0b2a17a1 — suíte Node e simulação de teclado.
- 870edb4ba22a50c26438f1e3ffd8ae9bcd51d323 / c69076317ab19639101bd288436bb95e4940597e — montagem Parceiro e gate Node.
- c09feb0e0f2beb508e93d2e722f78a323936f576 / f8a5d1baca5fb6b7c37dff97b66a4f176c27504d — montagem Passageiro e gate Node.
- 4696bead6e62723b192c2de4efa607057c5aadcb / eea90e64d0eb2d54e96628a28c3ca9d5a0b11e41 — montagem Merchant e gate Node.
- b8ec15bfec28ef4d587768adcbab3ec018b4618e — matriz CV-027–CV-028.

## 5. Testes efetivamente executados e limites

**Executados:**
1. Inspeção do código pinado, das strings geradas, do template Passageiro, das rotas de build e da matriz.
2. Aplicação isolada em V8 do patch real sobre PassengerAccountDeletion.tsx, handler Entregas extraído do gerador e modal/handler Motorista V4 reconstruídos a partir das strings reais do gerador. A idempotência foi verificada e um detalhe de expressão multilinha corrigido antes do registro final.
3. Mock em V8 do handler de Entregas, sem Supabase conectado, com sete caminhos: sucesso; signOut retornando erro; signOut lançando exceção; falha da RPC; falha pré-RPC; confirmação errada; cancelamento. Em todos foi mantida a quantidade/ordem de chamadas esperada e a mensagem compatível com o resultado.
4. Simulação isolada de eventos de DOM/teclado do **hook real**, após remover as anotações TypeScript apenas no harness: oito verificações bem-sucedidas (foco inicial em Cancelar, fundo inerte/oculto, Tab circular, Shift+Tab circular, Escape não destrutivo, captura de foco externo, restauração dos atributos do fundo e retorno ao acionador).
5. Parsing V8 dos novos scripts JavaScript e verificação dos pontos de montagem, sem executar os builders ou acessar serviços.

**Não executados:** node --test do checkout integral, montagem full com bun, TypeScript typecheck, lint, build web, ReactDOM real, Playwright/browser, testes reais de teclado, TalkBack/WebView, conexão ao Supabase, RPC, exclusão de conta, signOut de usuário real, APK, deploy ou publicação. **A presença do novo teste Node nos builders não equivale a teste aprovado em release.** Os testes descritos acima são sintéticos com mocks e não removem a necessidade de homologação.

## 6. Pendências de engenharia e homologação

- Confirmar qual build Cliente Entregas realmente chega aos usuários. A existência do hardener de exclusão no builder Merchant não prova sua presença no fluxo separado build-isolated-module.mjs entregas. **Não foi alterada a integração funcional de autenticação/exclusão.**
- Reavaliar com engenharia o alcance real da exclusão da conta compartilhada Motorista/Passageiro, regras de corrida ativa, períodos de retenção e estados administrativos. O RV-09 não altera ou certifica as regras.
- Executar os gates Node e typecheck/lint/build completos, teste de diálogo com foco teclado real, Safari/WebView Android e TalkBack; avaliar foco inicial, cancelamento, estado busy, restauração do acionador, tecla Escape, teclado virtual, fonte ampliada e layouts 320/360/390/412 px e paisagem.
- Validar o feedback pós-RPC **somente com mocks de UI ou contas explicitamente descartáveis autorizadas para QA**, não com contas reais em produção.
- Observar que a interface mantém a possibilidade manual de pressionar novamente após erro de signOut, pois o controle funcional existente não foi alterado. O texto não incentiva reenvio e informa ao usuário que a solicitação já foi registrada. Eventual proteção funcional contra novo clique exige decisão própria de engenharia.

## 7. Consolidação e conclusão

**28 registros visuais independentes CV-001–CV-028** (26 anteriores + 2 deste RV-09). VIS-001 continua alias de INV-047; VIS-007/CV-006 permanece retificado.

**67 achados técnicos históricos intactos:** A 0 / B 46 / C 17 / D 0 / E 1 / G 3.

**Não executados:** merge, deploy, publicação, APK, operação destrutiva, escrita em Supabase, alteração de SQL/RLS, alteração do source-lock ou dos três repositórios-fonte.

**Estado final:** CV-027 e CV-028 **implementados na preparação**, com evidências isoladas; homologação e compilação permanecem pendentes. Próxima numeração disponível: CV-029.


**Ajuste final de compatibilidade TypeScript:** após a primeira gravação do relatório, o helper de foco foi corrigido em `2c1ab0372780249b94e425a9bb6499d85986ed30`: a verificação de botão desabilitado no retorno de `querySelectorAll<HTMLElement>` passou a usar `hasAttribute("disabled")` (disponível em `HTMLElement`) em lugar de `.disabled` (não declarado em `HTMLElement` genérico). Não houve alteração de comportamento ou teste físico; a compilação integral continua pendente.
