# APOIS — Relatório 11 | Recuperação de senha por e-mail e código

**Data:** 09/11/2026. **Entrada:** `RELATORIO-11-APOIS-RECUPERACAO-DE-SENHA-20261109(1).md`. **Novo achado:** INV-063 (P2).  
**Escopo autorizado:** `apoistecnologia-gif/apois-superapp` / **`audit/continuacao-20261107`**, sem criar ramo paralelo e sem tocar nas fontes protegidas, `main` ou produção.

## 1. Ponto de retomada e confronto com código real

Antes de alterar o código, foram lidos diretamente do GitHub na branch oficial:
- `.apois/source-lock.json` (blob `3f98789f28666ccc052175db10f138208dd0937b`): Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- `auditoria/CODEX-RELATORIO10-EXECUCAO-20261109.md` e matriz histórica `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md`: **62 achados** (A 0 / B 42 / C 16 / D 0 / E 1 / G 3).
- `scripts/fix-partner-motorista-recovery-otp-v5.mjs` (antes da correção, blob `35dd8ca5c532f61112aec8ae192c56579ee374db`), `scripts/fix-partner-motorista-recovery-v1.mjs`, `scripts/fix-partner-motorista-recovery-relay-v2.mjs` e a sequência de `scripts/build-partner-release.sh`.
- `src/routes/motorista.recuperar-senha.tsx` da fonte Motorista fixada: utilizada apenas para simular o gerador em memória, sem sobrescrevê-la.

O ramo `audit/ecossistema-20261107` mencionado no relatório do auditor não foi usado para escrita. O Relatório 11 investiga uma condição de apresentação/associação de destinatário, **não** prova bypass de autenticação.

## 2. INV-063 — P2 — e-mail do envio não corresponde ao e-mail exibido

### Antes

O formulário gerado aceitava edição do campo durante `loading` ou `verifying`. A ação `requestCode` capturava endereço A e iniciava `resetPasswordForEmail`; se o campo fosse alterado para B enquanto A estava pendente, o sucesso de A posteriormente acionava `setSent(true)`, `setCode("")` e `setLastRequestedAt(Date.now())`, tornando a tela de B aparentemente confirmada. `lastRequestedAt` era global ao formulário e impedia nova tentativa imediata.

### Correção realmente versionada

Alterado o **gerador existente** `scripts/fix-partner-motorista-recovery-otp-v5.mjs`, sem modificar a fonte pinada e sem gerar outra tela:
- O destinatário é capturado/normalizado no instante de solicitação (`trim().toLowerCase()`). A operação possui **identidade e geração**, conferidas antes de mostrar sucesso ou erro da resposta assíncrona.
- O campo de e-mail fica **desabilitado durante envio e verificação**, e o próprio `onChange` também recusa edições enquanto os locks síncronos estiverem ativos (defesa para eventos que antecedam a atualização do React).
- O sucesso mantém `sentTo` ligado ao endereço efetivamente solicitado; o aviso só é renderizado se o endereço exibido corresponder ao destinatário confirmado. Ao editar depois da conclusão, a confirmação e o código anteriores são limpos.
- Exceções e erros antigos **não** passam a ser exibidos para outro destinatário; uma mudança de geração invalida o efeito visual pendente. Uma operação de verificação OTP também captura o endereço e impede navegação/feedback de operação visualmente obsoleta.
- **Não** foi retirada a proteção de envio simultâneo; agora também existe lock síncrono por referência em envio e verificação.
- O prazo local **global** de 60 segundos entre solicitações aceitas foi **intencionalmente preservado**, inclusive quando a pessoa muda de endereço após uma solicitação concluída. Isso evita contornar o limite simplesmente alternando e-mails. O texto do erro informa explicitamente que o intervalo vale mesmo ao corrigir o endereço e que o servidor pode aplicar limites adicionais. Erros de rede/servidor sem envio confirmado não acionam indevidamente cooldown local.
- Um envio aceito pelo backend conta para o limite global mesmo se a resposta visual se tornar obsoleta, evitando spam. Ao fim do intervalo, B pode ser solicitado normalmente.

**Sem mudanças** na autenticação, `verifyOtp({ type: "recovery" })`, no requisito de sessão retornada pelo Supabase, no passo de atualizar senha, no relay de link/URL, nas cores dos campos ou na mensagem que não revela existência de conta (“Se a conta existir”). Nenhum token, e-mail real ou senha foi utilizado.

**Estado B — código implementado/versionado no gerador, homologação integral pendente.**

## 3. Arquivos e commits da fase

| Arquivo | Operação | Evidência |
|---|---|---|
| `scripts/fix-partner-motorista-recovery-otp-v5.mjs` | Alterado | `fb022519633085c274991158c9c202650071ac53` |
| `scripts/qa/test-report11-recovery-otp-v1.test.mjs` | Novo: 7 testes de unidade sintéticos, sem rede, usando gerador com fixture temporária | `9a2c9a22a3016362a3173dee913f2aa71d0eee85` |
| `scripts/build-partner-release.sh` | Alterado: conecta suíte `node --test` após o gerador OTP v5 na sequência futura de montagem | `57d1a38ef9962a3527b5725399601850da197905` |
| `auditoria/CODEX-RELATORIO11-EXECUCAO-20261109.md` | Criado | Este documento |
| `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` | Atualizado somente com INV-063 | Histórico integral preservado |

Nenhum diretório `.work` foi versionado; a alteração vive no gerador já usado pelo builder existente e não altera o roteamento de callback.

## 4. Validações técnicas efetivamente executadas

### Simulação do gerador sobre fonte pinada

A versão alterada do script foi interpretada no runtime JavaScript V8 com `readFileSync`/`writeFileSync` interceptados em memória. A fonte fixada foi copiada apenas em memória com o marcador da transformação anterior que o pipeline normalmente aplica. O gerador produziu o componente OTP esperado, sem rede ou filesystem de produção.

**12/12 verificações estruturais** passaram: marcador novo, associação do destinatário, prevenção de resposta obsoleta, preservação do cooldown, input bloqueado em atividade, apresentação de aviso só para destinatário correto, `verifyOtp` com e-mail capturado, backend obrigatório, texto neutro de privacidade, contraste e ausência de fallback obsoleto. Os dois callbacks TSX extraídos tiveram sintaxe JS avaliada após remoção apenas da anotação de tipo da assinatura.

### Cenários funcionais com mocks

Foram extraídos do **componente gerado real** `requestCode`, `verifyCode` e `onChange` do campo de e-mail e exercitados isoladamente no runtime V8 com `supabase.auth`, `navigate`, relógio e setters de estado sintéticos. **13/13 verificações aprovadas**:
1. A pendente não permite edição para B.
2. Sucesso de A permanece associado a A.
3. Após conclusão, mudança para B limpa a confirmação de A.
4. Limite global de 60 segundos aplica-se de forma explícita após A.
5. Após o intervalo, envio real da fixture para B é permitido.
6. Sucesso obsoleto não exibe confirmação errada, mas preserva contagem de envio aceito.
7. Falha de rede obsoleta não aparece no novo endereço.
8. Falha de envio não cria cooldown fictício.
9. Tentativa idêntica após falha é permitida.
10. Dois submits simultâneos disparam uma só operação.
11. Alteração do e-mail durante verificação pendente é impedida.
12. Verificação utiliza o e-mail original, depende de sessão simulada válida e só então navega.
13. Erro de verificação obsoleto não aparece nem navega.

**Nota:** a simulação reproduz os callbacks, não os ciclos de renderização React, teclado físico, WebView ou o serviço real do Supabase. Não houve envio/recebimento de e-mail.

### Preparado, NÃO EXECUTADO

A suíte Node com **7 testes** foi versionada e ligada ao script de build para ser executada em uma próxima montagem autorizada. **Não foi executado `node --test` no checkout do repositório; não foi iniciado o builder.** Não houve `tsc`, Vite, APK, dispositivo Android, WebView, chamadas reais de `resetPasswordForEmail`/`verifyOtp`, alteração de template Auth, atualização de senha, login real, envio de mensagens ou publicação. Não confundir sintaxe e lógica simulada com homologação completa.

## 5. Riscos pendentes e reversão

- O limite global de 60 segundos é conservador: se A foi aceito e a pessoa corrigir para B depois de concluído, precisa aguardar o prazo para B. Isso é proposital para não criar mecanismo de spam por rotação de e-mails e **não representa prova dos limites efetivos no Supabase**.
- Testar em React e Android: edição/teclado desabilitados enquanto solicita/verifica, resposta fora de ordem, reconnect, 429, falha, OTP inválido/expirado, sessão Auth e retorno após redefinição.
- O template do provedor precisa ser validado em homologação autorizada para assegurar que contém código, juntamente com expiração, rate limit e acesso pelo Android. Não presumir que todos os e-mails sejam entregues.
- Reversão por revert dos commits do gerador/teste/builder nesta branch. Sem rollback de banco, e-mails ou credenciais, porque não houve operações reais.
- As dependências anteriores — principalmente INV-054 (G), INV-055/056 (C) e INV-061 (C, SQL ainda NÃO APLICADO) — permanecem intocadas.

## 6. Consolidação

Novo achado INV-063 = **B**. Os **62 achados anteriores permanecem sem reclassificação**.

**Total após Relatório 11: 63 achados — A 0 / B 43 / C 16 / D 0 / E 1 / G 3.**

**Bloqueios:** NÃO gerar APK, NÃO fazer homologação física, NÃO implantar SQL `QA_NOT_APPLIED`, NÃO alterar produção e NÃO fazer merge, até a frase exata de autorização: **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
