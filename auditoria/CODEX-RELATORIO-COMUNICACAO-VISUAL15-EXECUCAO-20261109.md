# APOIS — RV-15 | Relatório independente de execução — autenticação e reteste dirigido

**Data:** 09/11/2026  
**Entrada:** RELATORIO-VISUAL-15-APOIS-AUTENTICACAO-RETESTE-20261109(1).md  
**Repositório único de escrita:** `apoistecnologia-gif/apois-superapp`  
**Branch exclusiva:** `audit/continuacao-20261107`  
**HEAD inicial conferido:** `ceb3970031ddf9e834718c1bda7052318e6b57b7` (RV-14).  
**Status:** implementação de apresentação feita e testada por V8; **homologação real e política oficial de senha ainda pendentes**.

## 1. Integridade da base e ordem de montagem

O arquivo `.apois/source-lock.json` foi inspecionado antes das alterações e, após os commits desta rodada, continuou com SHA blob **`3f98789f28666ccc052175db10f138208dd0937b`**. Repositórios protegidos:
- Entregas: `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- Passageiro: `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`.
- Motorista/Admin: `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`.

O builder `scripts/build-isolated-module.mjs` copia as fontes pinadas para `.work/corridas`, aplica `harden-corridas-password-recovery.mjs` (redirect nativo, restauração PKCE/tokens/sessão) e demais hardeners. A RV-15 foi posicionada **depois** das correções anteriores RV-14 e dos hardeners existentes, **antes** de install/typecheck/compilação. O script já existente `fix-corridas-public-form-contrast-v1.mjs` foi adicionado explicitamente na sequência, pois o builder não continha a chamada. Ele é idempotente, atua somente em formulários públicos e CSS de placeholder; não substitui classes nem validações Auth.

Nenhuma fonte `sources/`, arquivo `.apois/` ou `supabase/` foi alterado; não houve merge, publicação, APK ou ação real em contas.

## 2. Novo CV-053 / VIS-054 — divergência de validação de senha

O código fixado do Passageiro foi lido diretamente:
- Cadastro `src/routes/_public.cadastro.tsx`: rejeita senha com menos de 8 caracteres, sem letras ou sem números, e orienta **mínimo de 8 caracteres, com letras e números**.
- Redefinição `src/routes/_public.redefinir-senha.tsx`: rejeita apenas `password.length < 6` e informa **pelo menos 6 caracteres**.
- Cliente Entregas não foi alterado ou generalizado indevidamente; o relatório externo indica 8 em ambos os seus fluxos.

Foi executada consulta read-only ao conector Supabase para o projeto `tbbzkrfupmqdywnzgnms`, identificado como **APOIS CORRIDAS - PRODUÇÃO**, em estado ativo, mas o retorno do projeto **não expõe os parâmetros da política de senha do GoTrue/Auth**. A auditoria local tampouco apresentou contrato aprovado ou evidência do servidor aceitando seis caracteres.

**Decisão técnica de contenção:** **NÃO corrigido sem contrato**. O patch não altera `password.length < 6`, `password.length < 8`, `signUp`, `updateUser`, política do serviço, sessão nem mensagens de validação local. A divergência segue registrada para análise de engenharia e confirmação da configuração implantada. Alterar regra efetiva como simples correção visual seria potencial regressão de segurança. O teste RV-15 afirma explicitamente que a inconsistência **ainda existe**, evitando falso "aprovado".

## 3. Novo CV-054 / VIS-055 — mensagens públicas de falha de Auth

**Antes:** `toast.error(error.message)` na recuperação e redefinição repassava ao usuário textos arbitrários do serviço.

**Implementado nas cópias geradas:** `scripts/templates/apoisPassengerPublicAuthError.ts` define função com classificação por código/mensagem/status para:
- muitas solicitações/rate-limit;
- falha de rede/conexão;
- e-mail inválido;
- senha fraca (na redefinição);
- token/link expirado ou inválido (na redefinição);
- fallback neutro e compreensível em português.

`scripts/fix-corridas-auth-visual15-v1.mjs` integra o helper nas duas rotas, substituindo apenas os dois toasts de falha do serviço e as mensagens genéricas no `catch`; registra os erros para diagnóstico no console sem reproduzir `error.message` como conteúdo público. Não expõe existência de conta, não inventa causa, não declara envio sem resposta do serviço, e não modifica `resetPasswordForEmail`, `updateUser`, navegação, `setSent(true)` ou fluxo de sucesso.

**Limite:** não foram realizadas chamadas de recuperação de e-mail, redefinição de credenciais, login ou uso de uma conta real.

## 4. Ampliações anteriores — VIS-032 / VIS-035 / VIS-004

- **VIS-032/CV-031:** `label htmlFor` ligado a `id` do E-mail na recuperação, Nova senha e Confirmar nova senha na redefinição; autofill `email`/`new-password` adicionado. Textos de campo, estados, handlers, tipos e valores mantidos.
- **VIS-035/CV-034:** botão Eye/EyeOff do campo Nova senha recebe `aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}`, `aria-pressed={showPassword}` e `aria-controls="apois-reset-password"`; a confirmação não é revelada.
- **VIS-004/CV-003:** acionador Eye tem mínimo `min-h-11 min-w-11`, 44px nominais, e foco visível, mantendo `onClick={() => setShowPassword(!showPassword)}`. Sua dimensão computada ainda exige browser/Android.

O overlay faz todas as transformações de rotas em memória e falha se uma âncora tiver cardinalidade diferente de 1; verifica idempotência, só escreve em `.work/corridas` depois de validar as transformações. O helper é copiado para a cópia gerada, não para a origem pinada.

## 5. Retestes dirigidos da auditoria anterior — seis casos, sem novos IDs

A rodada externa reexecutou sobre código-base e reproduziu os seis defeitos. Esta execução distingue **snapshot de origem** da **transformação montada pelo integrador**.

| ID | Reteste V8 executado na transformação real | Resultado e ressalva |
|---|---|---|
| **VIS-033/CV-032** | `patchAddressCard` (RV-11) sobre `enderecos.tsx` pinado; guarda de teclado e idempotência | Guarda do elemento alvo interno presente e aplicada; evento DOM/browser pendente |
| **VIS-040/CV-039 P1** | `patchMerchantRoute` (RV-12) sobre `merchant.tsx` pinado; formatador diferencia opções A/B do mesmo produto na comanda/card | Patch e diferença de itens aprovados em V8, **mas versão Merchant efetivamente distribuída, Central enriquecida e impressão real NÃO homologadas** |
| **VIS-041/CV-040** | `fix-entregas-coupon-metrics-v2` + `patchCouponStates` (RV-12); expressão de badge de futuro | Cupom futuro ativo = **Agendado**; presente ativo = **Ativo** no harness, browser/relógio real pendentes |
| **VIS-042/CV-041** | Mesmos geradores de cupons: `usageState` falho distinto de zero, exclusão local bloqueada e erro da lista separado do vazio | Verificação de fonte transformada aprovada; sem consulta/deleção/banco real |
| **VIS-051/CV-050** | Reexecutados handlers sintéticos RV-14, falha no aceite seguida por consulta válida | Mensagem de falha preservada, sem aceitar pedido real |
| **VIS-052/CV-051** | Resposta antiga após offline e respostas em ordem invertida | Aviso offline e resultado de consulta mais recente preservados em V8, React/browser pendentes |

A suíte sintética da RV-14, que inclui VIS-051/052, foi **reexecutada nesta rodada: 6/6 casos passando**. Asserção positiva não prova versão APK, UI renderizada ou teste físico.

## 6. Testes RV-15 realmente executados

1. **Leituras reais no GitHub:** último HEAD RV-14, matriz, lock, rotas de cadastro, recuperação e redefinição do Passageiro no commit pinado, hardener de callback, contrast script e ordem do builder.
2. **Consultas read-only ao Supabase:** projeto Corridas localizado e ativo; política específica de senha não disponível no retorno. Nenhuma alteração de infraestrutura.
3. **V8 em memória:** `harden-corridas-password-recovery.mjs` aplicado às rotas pinadas em filesystem virtual; `fix-corridas-public-form-contrast-v1.mjs` executado sobre cadastro/recuperação/redefinição e CSS virtual; RV-15 aplicado às duas rotas transformadas, **2/2 alterações aplicáveis e idempotentes**, callbacks nativos/PKCE presentes.
4. **Suíte `scripts/qa/test-corridas-auth-visual15-v1.test.mjs` executada em harness V8 com filesystem injetado:** **5/5 testes passando**: tradução pública/fallback, preservação dos métodos/sucesso, rótulos/controle Eye, reconhecimento do VIS-054 ainda em aberto, ordem do builder e lock.
5. **Retestes RV-11/RV-12:** guarda de teclado, opções A/B, badge Agendado e falha de usos V2+RV-12 verificadas com transformações reais sobre fontes pinadas, sem DOM.
6. **Suíte RV-14 reexecutada em V8:** **6/6 testes passando**, incluindo falha de claim seguida de refresh, offline tardio e respostas concorrentes.
7. **Comparação no GitHub:** arquivos alterados apenas no integrador, sem caminhos de origem protegida.

**NÃO executado:** `node --test` no checkout completo, `bun run typecheck`, lint, build, React/DOM/Chromium, acessibilidade física, TalkBack, APK, autenticação/e-mails reais, SQL, políticas Auth ou deploy. Os testes versionados foram integrados ao builder, mas **não passaram ainda no runtime Node real**.

## 7. Arquivos versionados nesta rodada

| Caminho | Finalidade |
|---|---|
| `scripts/templates/apoisPassengerPublicAuthError.ts` | Novo helper de mensagens em português |
| `scripts/fix-corridas-auth-visual15-v1.mjs` | Novo overlay idempotente/fail-closed |
| `scripts/qa/test-corridas-auth-visual15-v1.test.mjs` | Testes de erros, acessibilidade e contrato pendente |
| `scripts/build-isolated-module.mjs` | Monta contraste público, overlay RV-15 e teste antes do build |
| `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | CV-053 e CV-054, três ampliações e seis retestes |
| `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL15-EXECUCAO-20261109.md` | Relatório independente (este documento) |

### Commits de implementação anteriores a este relatório
1. `4b94176d2563624c3761da97d9339f3db94db2eb` — helper público de erro.
2. `080fb0fb6060b9d5a49c042c8e61cb1ae630f2df` — overlay inicial.
3. `0d2a35a2fe8203927d9be221b4b7e6300bb1a317` — âncora do campo de confirmação corrigida após execução sintética.
4. `bc6e07f57c8bcaec7b7cfaaf8b2d2b7ddfb1e5ec` — suíte de regressão versionada.
5. `fffab03cdeeae7884380a0eb17d81fe78e9d5104` — builder com contraste e gates.
6. `6bec4c78b5ebddecb06596065759a71b7296b70a` — matriz de auditoria atualizada.

## 8. Estado final, pendências e proibição de homologação

**54 registros visuais CV-001–CV-054** (52 anteriores + 2 novos). **VIS-054/CV-053 permanece pendente** de confirmação do contrato oficial de senha; **VIS-055/CV-054 foi implementado**, sujeito a validação de UI real. Matriz técnica histórica: **67 achados**, A=0, B=46, C=17, D=0, E=1, G=3. Próximo identificador **CV-055**.

Persistem CV-037 (tema Motorista), CV-038 (endereços longos), CV-039 P1 (adicionais da Central Merchant e impressão), CV-030 (não aplicável ao contrato de banco pinado até prova contrária), e testes Node/typecheck/lint/build/Android/TalkBack. **Não gerar APK, não fazer merge e não publicar em produção**, conforme a regra de homologação final.
