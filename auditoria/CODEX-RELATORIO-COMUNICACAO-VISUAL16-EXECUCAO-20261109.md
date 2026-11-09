# APOIS — RV-16 | Relatório independente de execução — financeiro, abrangência e localização

**Data:** 09/11/2026  
**Entrada:** `RELATORIO-VISUAL-16-APOIS-FINANCEIRO-ABRANGENCIA-20261109.md` (auditoria externa sem alteração).  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch alterada:** `audit/continuacao-20261107`  
**HEAD inicial conferido:** `a79653ca4c5f78c041458a9c73b4ca7f74f963b9` (RV-15).  
**Fonte externa:** `audit/ecossistema-20261107@18f2fed7e27486f2b3a4170921a246344316a2a4` (somente leitura).  
**Estado:** correções **somente de apresentação** implementadas e verificadas em V8; **VIS-057/VIS-058 parcialmente mitigados, dependência de engenharia não resolvida**. Nada homologado em React/Android ou produção.

## 1. Proteção de fontes e escopo

O HEAD inicial, a matriz (54 registros) e o relatório RV-15 foram conferidos antes de qualquer mudança. O arquivo `.apois/source-lock.json` devolveu blob SHA `3f98789f28666ccc052175db10f138208dd0937b`. Commits de origem protegidos:
- Entregas: `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- Passageiro Corridas: `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`.
- Motorista/Admin: `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`.

Os quatro componentes reais de Entregas foram lidos no commit pinado e localizados nos builders. O integrador já executava `fix-entregas-admin-visual12-v1.mjs`, que colocava `aria-pressed` em **Admin Reviews e Admin Repasses**. A RV-16 preserva esse trabalho e **não duplica o patch**.

O arquivo novo `scripts/fix-entregas-finance-scope-visual16-v1.mjs` aplica patches idempotentes, de âncora única e fail-closed, **somente em `.work/entregas`**, depois de RV-12 e RV-13. Antes de escrever, calcula e valida as quatro saídas; só então grava. Ele está montado nos dois builders:
- `scripts/build-isolated-module.mjs`;
- `scripts/build-merchant-panel.mjs`.

Ambos incluem teste `node --test` versionado e validação de marcador, **mas os testes ainda não foram executados com Node em checkout integral**. Nenhuma query/RPC, tabela, estado financeiro, fórmula de valor, mapa, geolocalização, presença, despacho, autenticação, configuração ou fonte pinada foi modificada.

## 2. CV-055 / VIS-056 — obrigação do estabelecimento versus crédito

**Antes confirmado no snapshot:** `MerchantCourierSettlementsPanel.tsx` soma `awaiting_payment` e `overdue` em `pendingTotal`, mas exibia `MetricCard label="A receber (aberto)"`. O mesmo componente comunica que **o estabelecimento faz o Pix fora do app e a APOIS não guarda o dinheiro**.

**Depois (somente cópia gerada):**
- `MetricCard` usa **“A pagar aos entregadores”**.
- Status `awaiting_payment` do estabelecimento usa **“A pagar ao entregador”**.
- `pendingTotal`, `effective_status`, `total_amount`, `settlement.status`, `handleMarkPaid`, `merchant_mark_courier_settlement_paid` e `navigator.clipboard.writeText(account.key)` permanecem idênticos.
- **Teste sintético real do corpo de `pendingTotal`:** 35 + 15 pendentes/vencidos, 90 confirmados → **R$ 50**, sem mudança de cálculo.

**Falta:** confirmar semântica comercial e visual em tela pequena. Não houve Pix, atualização de repasse ou operação financeira real.

## 3. CV-056 / VIS-057 — recortes limitados, comunicação parcialmente mitigada

| Componente | Consulta preservada | Texto inserido |
|---|---|---|
| MerchantCourierSettlementsPanel | últimos 200 fechamentos | “Até 200 fechamentos mais recentes”; cálculos e filtros só da lista carregada, pendências antigas podem não aparecer |
| AdminCourierSettlementsPanel | últimos 300 fechamentos | “Até 300 fechamentos mais recentes”; indicadores e filtros não necessariamente incluem registros mais antigos |
| AdminReviewsPanel | últimas 500 avaliações | “Até 500 avaliações mais recentes”; médias, busca, filtros e contagens apenas da lista carregada, não média global |
| AdminRealtimeOperationsPanel | 300 entregas ativas mais recentemente atualizadas | nota explicita limite da lista, indicadores e resumo financeiro de ativas |

Os vazios de repasses e avaliações passaram a comunicar **“neste recorte”**, sem declarar inexistência no histórico completo. Todos os limites, filtros, consultas, agregações e totais continuam byte a byte nas expressões originais. O aviso é visível em texto e não somente em ícone/cor. **Isto não resolve o acesso a um vencido antigo fora do `.limit(200/300)`, nem transforma uma média amostral em global.**

**Engenharia pendente (não implementada):** definir estratégia de paginação e busca no servidor, métricas com totais corretos, contratos das views, controle RLS e volume de produção, sem remover limites cegamente. A prioridade P1 do auditor é condicional a haver mais registros do que a janela. Não houve consulta a dados financeiros de produção nesta rodada.

## 4. CV-057 / VIS-058 — idade da posição sem mexer no rastreamento

**Antes confirmado:** o predicado `onlineLocations` seleciona entregadores marcados online com coordenadas numéricas finitas e não consulta `recorded_at`. A métrica “Sem posição recente” era imprópria, pois o código não testava recência.

**Depois (somente apresentação):**
- A descrição do mapa deixa explícito que os registros podem ser antigos e **nenhum critério de recência está aplicado**.
- `title` do `AdvancedMarker` e `aria-label` de seu elemento visual incluem **“Última posição registrada: ” + `dateTime(location.recorded_at)`**.
- A métrica foi renomeada para **“Diferença entre online e posições exibidas”**. A nota informa que é diferença numérica, sem considerar idade nem possíveis duplicidades.
- `onlineLocations`, `onlineIds`, `mapCenter`, `from("courier_locations")`, `courier_availability`, `<GoogleMap>`, as subscriptions de realtime e todos os handlers permanecem iguais.

**Teste V8:** uma posição sintética de 2020 de entregador online com coordenadas finitas **continua incluída** no predicado do mapa, demonstrando que o código **ainda não a invalida por idade**. Ela é, porém, identificada como registro com data, e o contador deixa de alegar recência sem base.

**Engenharia pendente:** política de janela temporal, deduplicação por entregador, status antigo/recente/sem dado, limpeza/retention real, impacto operacional e validação com mocks/DB de teste. Não afirmar que há coordenadas velhas em produção com base na fixture. Não houve GPS ou mapa físico.

## 5. Ampliações anteriores, sem novos registros

- **VIS-027/CV-026:** consultas auxiliares de entregador/perfil/carteira/conta Pix ainda podem transformar falha em “Não cadastrada”; Admin Reviews pode apresentar vazio depois de erro. **Pendente de definição de estado e contrato de consulta**, sem alterar esses fluxos silenciosamente.
- **VIS-034/CV-033:** `aria-pressed={filter === id}` adicionado ao filtro Merchant; Admin Reviews e Admin Repasses **já estavam corrigidos na RV-12**. Callback, estado e classes condicionais preservados.
- **VIS-039/CV-038:** Pix exibido com `break-all` em vez de `truncate`; cópia mantém exatamente `navigator.clipboard.writeText(account.key)`. Requer inspeção visual e teste real de cópia.
- **VIS-055/CV-054:** tratamentos de `error?.message` em consultas administrativas/financeiras **não foram alterados**; tradução/classificação ainda depende de revisão segura. Nenhuma mensagem nova oculta erro de consulta.

## 6. Testes realmente realizados

1. **GitHub:** leitura do HEAD inicial, source-lock, matriz RV-15, builders, quatro componentes no snapshot pinado e scripts anteriores de Admin/contraste.
2. **V8 sobre código real:** funções `patchMerchantSettlements`, `patchAdminSettlements`, `patchAdminReviews`, `patchRealtimeOperations` da branch aplicadas sobre quatro arquivos pinados, com overlays RV-12 de filtro Admin em memória. As quatro transformações foram idempotentes, detectaram alteração de âncoras e preservaram os `.limit`, RPCs e fórmulas.
3. **6 verificações da suíte RV-16 executadas em V8 com filesystem virtual**, cobrindo soma de R$ 50, quatro recortes/aviso de alcance, posição antiga de 2020, filtro `aria-pressed`, Pix completo/cópia, contratos de consulta, formulas e integração aos dois builders. **Resultado final: 6/6 aprovado**. A primeira execução acusou 1 falha de asserção em capitalização “Até/até” na nota de operação; a asserção foi corrigida e os seis casos foram reexecutados com sucesso.
4. **Code review das alterações:** nenhuma mudança de cálculo financeiro, exclusão ou aceite; nenhum map eligibility/RPC alterado.

**Não executado:** `node --test` real com checkout e dependências, typecheck/TypeScript, lint, Bun, Vite/build, render React/DOM, 320/360/390/412 px, zoom, teclado/TalkBack, Pix, consulta de repasses/avaliações de produção, RLS, volumes acima de 200/300/500 no servidor, Android, mapa real, impressão, deploy, GitHub Actions ou APK. Sucesso em V8 **não é homologação de tela nem de aplicativo**.

## 7. Arquivos alterados

| Caminho | Operação |
|---|---|
| `scripts/fix-entregas-finance-scope-visual16-v1.mjs` | NOVO overlay de apresentação nos quatro componentes |
| `scripts/qa/test-entregas-finance-scope-visual16-v1.test.mjs` | NOVA suíte regressiva (Node versionado, V8 sintético executado) |
| `scripts/build-isolated-module.mjs` | Vinculação do overlay/QA/gates |
| `scripts/build-merchant-panel.mjs` | Mesma vinculação no Merchant separado |
| `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | CV-055 a CV-057, quatro ampliações |
| `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL16-EXECUCAO-20261109.md` | Este relatório |

### Commits anteriores a este relatório

1. `8e3ae6f07b1ab4db403ab66bda53d01fbd6cca24` — overlay RV-16 inicial.
2. `41341ff02f50b14d37ee70282fb98610ace35aba` — correção de âncora de indentação da descrição do mapa.
3. `7f2a2550216d9c5fa8c5d65597546f1f1e3cabb0` — suíte de regressão.
4. `bd514181b6e75e6ff963b10a1dbe669c4e94314b` — builder isolado.
5. `5d8f96b9ee02b2fe8183f2b686cb2cf6b7a7d4ba` — builder Merchant.
6. `5b9298e0e423ad43ef6427899d5443167701be74` — correção de case na asserção do teste.
7. `fce56a1c179e55dc02e35e4159b18fac003e4794` — matriz consolidada.

Todos os commits ocorreram apenas no integrador e são reversíveis por commit, sem merge nem deploy.

## 8. Balanço e próximo escopo

**57 registros visuais CV-001–CV-057** (54 anteriores + 3 novos; quatro ampliações sem duplicação). **67 achados técnicos históricos inalterados** (A=0, B=46, C=17, D=0, E=1, G=3). Próximo identificador **CV-058**.

**Pendências prioritárias:** CV-056/VIS-057 (acesso a histórico completo e agregados confiáveis), CV-057/VIS-058 (critério de atualidade do mapa), CV-039 P1 (Merchant real e impressão de adicionais), CV-053 (política oficial de senha), VIS-027 (falha de consulta/ausência), CV-037 (tema Motorista), CV-038 (endereços), além de validações de build e dispositivo. CV-030 não aplicável ao contrato pinado salvo nova prova.

**Proibido inferir prontidão de produção:** não houve nenhuma alteração financeira real, geração de APK, publicação, merge, dados reais, envio ou automação. A homologação final continua reservada ao comando explícito do usuário.
