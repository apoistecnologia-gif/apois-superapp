# APOIS — RV-07: execução da auditoria visual financeira

**Data:** 09/11/2026  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Branch exclusivamente alterada:** `audit/continuacao-20261107`  
**Entrada:** `RELATORIO-VISUAL-07-APOIS-FINANCEIRO-20261109(1).md`  
**Registros novos:** CV-023 / VIS-024 e CV-024 / VIS-025 — ambos P2.  
**Status:** correção preparatória aplicada em geradores e ordem de build; sem homologação de produto real.

## 1. Escopo e integridade

A investigação teve como base os geradores efetivos e as fontes pinadas, exclusivamente em leitura. O arquivo `.apois/source-lock.json` foi confirmado no blob `3f98789f28666ccc052175db10f138208dd0937b`; não foi modificado. Os repositórios-fonte protegidos também não receberam escrita:

- `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`
- `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`
- `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`

A rodada começou depois do RV-06 na branch autorizada (`473be812caa9a392cada624fb163d7ea01264b9a`). Foram analisados os scripts `harden-motorista-finance-boundary.mjs`, `fix-partner-driver-new-monthly-price-v1.mjs`, `harden-partner-motorista-direct-earnings.mjs`, `harden-partner-entregador-finance.mjs`, `fix-partner-courier-membership-disclosure-v1.mjs`, `harden-entregas-merchant-direct-finance.mjs`, `neutralize-entregas-superapp-legacy.mjs` e os três builders efetivos. Também foram lidos os componentes originais pinados de mensalidade do Motorista e do Estabelecimento, sem confiar em seu conteúdo legado como artefato de release.

## 2. CV-023 / VIS-024 — mensalidade do Motorista

**Antes (confirmado pelo gerador):** `subscription_status` recebe fallback interno `inactive`. O cabeçalho exibia `Mensalidade inativa` para `pending`, `processing`, status desconhecido e consulta sem `driver`. Falha de leitura podia produzir alerta de erro e legenda de inatividade simultâneos. O status `teste` e os estados `paid/active` possuem apresentações específicas que deveriam ser mantidas.

**Depois (overlay visual):**

| Condição visual, sem mudança no estado gravado | Texto apresentado |
|---|---|
| `active`, `ativa`, `ativo`, `paid`, `pago` | Mensalidade ativa |
| `teste` | Homologação ativa |
| `pending`, `pendente` | Pagamento pendente |
| `processing`, `processando` | Pagamento em processamento |
| `inactive`, `inativa`, `inativo` com dado confiável | Mensalidade inativa |
| Status desconhecido/ausente, `driver` indisponível ou falha de consulta | Situação da mensalidade indisponível |
| Atualização em curso com cartão anterior montado | Consultando mensalidade… |

O indicador visual verde somente aparece quando a consulta é confiável e a expressão **preexistente** `operational = paidActive || homologation` é verdadeira. Foi acrescentado um cartão neutro, somente de apresentação, quando o status não pode ser confirmado. A ordem da aprovação e as condições oficiais de acesso **não** foram alteradas; não houve mudança em `refresh`, na consulta Supabase ou nos callbacks.

A atualização contratual `fix-partner-driver-new-monthly-price-v1.mjs` permanece separada e executada **antes** deste overlay no pipeline Parceiro. A exibição de valores por `contractMonthlyFee` continua intacta: valores anteriores R$ 49,90 e novas contratações R$ 59,90 conforme o contrato e a consulta existente; erros continuam ocultando preço não confirmado.

**Arquivo gerado afetado somente quando os builders forem rodados:** `.work/partner-motorista/src/routes/motorista.assinatura.tsx` no Parceiro e `.work/motorista/src/routes/motorista.assinatura.tsx` no Motorista standalone.

## 3. CV-024 / VIS-025 — status da mensalidade do Estabelecimento

**Antes (confirmado pelo literal `subscriptionSource`):** o gerador de `MerchantSubscriptionGate.tsx` tinha dicionário apenas para `paid`, `authorized`, `pending`, `paused`, `cancelled` e `canceled`; no `default` retornava `Status: ${value}`, expondo código técnico, ou afirmava mensalidade não ativada sem distinguir falta de dado.

**Depois:** os seis estados conhecidos e seus rótulos foram preservados byte a byte. O único fallback público agora é **Situação da mensalidade indisponível**, inclusive se o valor estiver ausente. Não se supõe pagamento confirmado e a propriedade `provider_status` permanece disponível no dado recebido; nenhum diagnóstico técnico preexistente é removido. Não foram alterados `onRefresh`, `onLogout`, `current_period_end`, o cartão de R$ 69,90, avisos de gateway indisponível ou outras ações.

**Arquivo gerado afetado somente quando o builder for rodado:** `.work/entregas/src/components/MerchantSubscriptionGate.tsx`.

## 4. Arquivos versionados e ordem de aplicação

1. **Novo:** `scripts/fix-apois-financial-status-visual07-v1.mjs` — transformações idempotentes e fail-closed para os dois geradores, com parâmetros `motorista` e `merchant`.
2. **Novo:** `scripts/qa/test-apois-financial-status-visual07-v1.test.mjs` — testes Node usando os literais reais dos geradores, execução isolada de traduções, estados desconhecidos e verificações de preservação e ordem.
3. **Atualizado:** `scripts/build-partner-release.sh` — aplica CV-023 **depois** do gerador de preço por contrato e **antes** de typecheck/build.
4. **Atualizado:** `scripts/build-motorista-module.mjs` — aplica CV-023 ao builder standalone **depois** do boundary e **antes** de typecheck/build.
5. **Atualizado:** `scripts/build-merchant-panel.mjs` — aplica CV-024 **depois** de `neutralize-entregas-superapp-legacy.mjs` e dos demais transforms, **antes** de typecheck/build; inclui importação explícita de `readFileSync` para o gate.
6. **Atualizado:** `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` — adiciona CV-023/024 sem renumerar ou editar linhas anteriores.
7. **Novo:** este relatório `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL07-EXECUCAO-20261109.md`.

**Commits de implementação efetivamente registrados:**
- `127f5990da65d7709b4b21a2df5cb445aa4cf135` — patch CV07
- `94be5c2952c3d57d198acea674aac1a81d367ae0` — suíte Node
- `7d1af921e6037160c536780c35b4eb496df5b5d8` — builder Parceiro
- `ff40fe6c0cf030611e51c7e090359f5f4e1efd3a` — builder Motorista standalone
- `460031340ea34f4c4a1a4928c8cd8e7e364b69ec` — builder Estabelecimento
- `0e6e9d900f56ac0565195e4294473a4af12c8789` — import de leitura no builder Estabelecimento
- `a436cf3b97861dcea1b20e7e523c38b524564579` — matriz histórica

O commit de criação deste próprio relatório ocorre depois da gravação e é conferível no GitHub.

## 5. Testes executados e não executados

**Realmente executado:**
- Inspeção remota dos geradores, fonte protegida e builders, com confirmação da ordem dos scripts.
- Avaliação isolada de **dois literais integrais de JSX gerado** diretamente dos scripts remotos, usando V8; aplicação em memória das funções transformadoras efetivamente versionadas (não uma reconstrução meramente descritiva).
- Avaliação de **21 cenários de comunicação**: 10 estados brutos do Motorista, 3 condições de ausência/erro/carregamento e 8 valores de status Merchant. As traduções corresponderam às regras descritas, o fallback não expôs códigos e o overlay foi idempotente.
- Verificação estática de preservação de callbacks de atualização, presença das mensagens de gateway indisponível, preço por constante original, ausência de escrita de pagamento/SQL e confirmação do arquivo source-lock.

**Não executado:** o `node --test` versionado em um checkout integral, a cadeia completa `build-partner-release.sh`/`build-motorista-module.mjs`/`build-merchant-panel.mjs`, `bun install`, typecheck/lint/build, testes de React/DOM/Chrome/WebView, TalkBack, Android real, pagamentos, consultas financeiras autenticadas ou movimentação de valores. A inclusão da suíte no builder **não significa** que ela já tenha passado em Node nessa branch. Os resultados V8 são verificações sintéticas, não homologação.

## 6. Preservações, limitações e acompanhamento técnico

- Sem alterações em autenticação/Google, Supabase/RLS/SQL, APIs, gateway, Safe2Pay, Pix, recebimentos, carteira, saques, elegibilidade online, dados financeiros, `callbacks` ou valores comerciais.
- Motorista: mantém a recuperação `Tentar novamente` e acesso a `Suporte`.
- Entregador: mantém o valor publicitário de R$ 49,90 para novas contratações, com a ressalva de que **não** habilita cobrança nem comprova assinatura ativa. Nenhum código do Entregador precisou ser alterado.
- Estabelecimento: R$ 69,90 e pagamento eletrônico indisponível permanecem.
- **Pendência observada, fora do RV-07:** o builder standalone `build-motorista-module.mjs` não chama `fix-partner-driver-new-monthly-price-v1.mjs`, presente no Parceiro. A investigação não confirma qual fluxo chega ao usuário ou que haja preço incorreto em APK vigente. Cabe à engenharia reconciliar a distribuição/versão com a política comercial; **nenhum ajuste de contrato ou preço foi autorizado nesta rodada.**
- Pendente confirmar estados reais em dados autorizados, renderizar 320/360/390/412 px, ampliar fontes, teclado/leitor de tela, falha de consulta/retentativa, mensalidade antiga/nova, campos de atualização e preservação do acesso conforme estado oficial.

## 7. Consolidação

**Matriz visual:** 24 registros independentes CV-001–CV-024; RV-07 acrescentou somente CV-023 e CV-024. `VIS-001` segue como alias de `INV-047`, e `VIS-007/CV-006` permanece retificado.

**Matriz técnica anterior:** 67 achados, classificações A=0, B=46, C=17, D=0, E=1, G=3, **sem modificação**.

**Não foram realizados:** merge, deploy, geração de APK, homologação física, cobrança ou escrita em produção. A homologação seguirá bloqueada até a autorização expressa do proprietário: **“ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.”**

**Conclusão:** código preparatório do RV-07 integrado e verificado sinteticamente; compilação, suite Node no checkout real e validação visual do app ainda pendentes.
