# APOIS — Relatório de execução da comunicação visual 08 (RV-08)

**Data:** 09/11/2026  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch autorizada/alterada:** `audit/continuacao-20261107`  
**Entrada lida integralmente:** `RELATORIO-VISUAL-08-APOIS-SUPORTE-20261109(1).md`  
**Achados novos:** CV-025 / VIS-026 e CV-026 / VIS-027 — prioridade P2.  
**Estado da entrega:** patch preparatório versionado e integrado ao gerador, **sem homologação do aplicativo**.

## 1. Base examinada e proteção

A rodada iniciou com a matriz visual contendo 24 achados (CV-001–CV-024) e o commit final do RV-07 `01a9fb6d2c1a5f535b0641afeb7b9262acbc0458`. Não se reabriu nenhuma auditoria concluída.

Foram lidos no GitHub, sem escrita, os artefatos reais:
- `scripts/fix-partner-support-case-workroom-v1.mjs`, gerador de `src/components/ApoisCaseWorkroom.tsx` na cópia isolada do Motorista;
- a transformação de triagem `APOIS_STAFF_REQUEST_DRIVER_STATEMENT_V1` no mesmo gerador;
- `scripts/verify-apois-vehicle-incidents-v1.mjs` e `scripts/fix-report04-driver-center-v1.mjs`, para preservar os contratos privados `APOIS_CASE_CONTEXT_SAFE_V2`, `APOIS_CASE_UPLOAD_IDEMPOTENCY_V2` e os casos de regressão de engenharia;
- `scripts/build-partner-release.sh`, para localizar o ponto depois dos hardeners atuais;
- o snapshot oficial `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`, `src/routes/chamado-suporte.$ticketId.tsx`, que já traduz `open`, `in_progress`, `resolved`, `closed`;
- o contrato de ocorrências em `supabase/corridas-forward-migrations/20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql` **somente para leitura**. A menção a esta migração não representa sua aplicação.

O arquivo `.apois/source-lock.json` permanece com o SHA blob `3f98789f28666ccc052175db10f138208dd0937b`. Nenhum repositório-fonte foi alterado:
- Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`;
- Corridas/Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`;
- Corridas/Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.

## 2. CV-025 / VIS-026 — tradução de status de suporte

**Evidência antes:** o botão de cada protocolo na listagem gerada continha `{t.status} · {new Date(t.created_at).toLocaleString("pt-BR")}`. Isso exibia diretamente `open`, `in_progress` e demais códigos de status. O gerador posterior de solicitação de esclarecimento não transformava essa linha.

**Implementação:** novo overlay `scripts/fix-partner-support-workroom-visual08-v1.mjs` adiciona um dicionário **somente de apresentação**:

| Status gravado (não modificado) | Comunicação pública |
|---|---|
| `open` | Aberto |
| `in_progress` | Em atendimento |
| `resolved` | Resolvido |
| `closed` | Fechado |
| desconhecido ou ausente | Situação indisponível |

Somente a expressão de apresentação da lista é trocada por `caseStatusLabel(t.status)`. Permanecem intactos `current.status`, a condição `["open","in_progress"].includes(current.status)` que regula resposta, o filtro do backend, a consulta, os protocolos, datas, seleções e eventos. O Cliente Entregas mantém seu dicionário anterior, sem patch.

## 3. CV-026 / VIS-027 — distinção entre erro, vazio e dados possivelmente antigos

**Antes:** `refresh` chamava `setLoading(true)`, consultava `passenger_support_tickets`, encerrava o loading e, ao receber `result.error`, mostrava `Não foi possível consultar os protocolos.` e saía sem atualizar `tickets`. O JSX também renderizava `Nenhuma ocorrência disponível.` sempre que `tickets.length===0 && !loading`, inclusive após erro na primeira consulta.

**Intervenção mínima:** o mesmo overlay acrescenta dois indicadores locais **apenas de apresentação**: `ticketListLoaded` (já houve resposta bem-sucedida) e `ticketListFailed` (última consulta de lista falhou). No caminho `result.error`, marca falha e mantém os registros anteriores. No caminho de sucesso, marca resultado válido, limpa somente o erro com texto de consulta de protocolos e usa os dados retornados como antes. Não altera `db.from`, parâmetros da consulta, limites, handlers ou periodicidade de 30 segundos.

| Cenário verificado sinteticamente | Apresentação |
|---|---|
| Antes da primeira consulta | Sem mensagem enganosa de lista vazia |
| Falha na primeira consulta, `tickets=[]` | Erro de consulta; **sem** `Nenhuma ocorrência disponível` |
| Sucesso com lista `[]` | `Nenhuma ocorrência disponível` |
| Sucesso com protocolos | Exibe protocolos normalmente |
| Falha depois de lista carregada | Mantém protocolos e avisa que **podem estar desatualizados** |
| Nova tentativa com sucesso | Remove o erro específico de listagem, normaliza vazio/lista |

O botão existente `onClick={()=>void refresh()}` passa a exibir **Tentar novamente** quando a consulta falhar e mantém **Atualizar** no sucesso. A área de toque ganha altura mínima de 44 CSS px e foco visível. A indicação de lista antiga aparece **dentro do alerta já existente**, sem criar `role="alert"` adicional nem adicionar anúncio contínuo à lista/polling. Erros próprios de detalhes, mensagens e anexos não são limpos por esse sucesso.

**Limitação:** a intervenção reflete falhas retornadas em `result.error`, como no RV-08. Uma rejeição inesperada da Promise em `refresh` não recebe tratamento funcional novo; essa condição fica para eventual revisão técnica autorizada, sem ampliação deste patch visual.

## 4. Arquivos realmente versionados

1. **Adicionado** `scripts/fix-partner-support-workroom-visual08-v1.mjs` — patch de status, erro/vazio/retry, idempotente, falha segura quando baseline mudar;
2. **Adicionado** `scripts/qa/test-partner-support-workroom-visual08-v1.test.mjs` — testes Node que constroem fixture com o **gerador real** e mockam apenas rotas de montagem; confirmam dicionário, erro inicial, vazio real, lista retida, recuperação, privacidade, ausência de alertas duplicados, idempotência e source drift;
3. **Atualizado** `scripts/build-partner-release.sh` — overlay, suíte Node e três gates de integridade depois do gerador, da triagem, do restante dos hardeners Motorista e do RV-06, antes de typecheck/build;
4. **Atualizado** `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` — somente a nova seção CV-025/026, 24 anteriores preservados;
5. **Adicionado** este relatório `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL08-EXECUCAO-20261109.md`.

**Commits efetivos:** `7ea2d0341b7a3bbd54b0ba970d29d31b4a93d2d8` (overlay), `3c1ac6b8bfdc1c3f7f8732105a18769d11e0871f` (regressão Node), `4dedc9b6dac3f1e7ce167d3d94abe7e7373e03cb` (builder), `955fb260086940e4e98d84ead1e235639d0b2433` (matriz). O commit de criação deste próprio relatório é registrado pelo GitHub após a escrita.

## 5. Evidências efetivamente obtidas — distinção de cobertura

**Executado nesta rodada:**
- leitura do gerador real, sua transformação de triagem, contrato visível no Cliente Entregas e localização do overlay na sequência de montagem;
- extração por JSON do **literal completo** de `ApoisCaseWorkroom` presente no gerador, com simulação isolada das substituições da etapa de triagem posterior;
- aplicação em V8 da **função real versionada** `patchWorkroomVisual08` ao literal reconstruído, sem cliente Supabase, sem mensagens ou upload;
- **17/17 verificações sintéticas V8**, cobrindo os quatro rótulos oficiais, fallback desconhecido, ausência antes da primeira resposta, erro inicial, sucesso vazio, lista carregada, falha com cache, recuperação, conservação de triagem/notas internas/identificação de caso, contagem de alertas, idempotência, rejeição de drift e ordem do builder;
- verificação de parsing JavaScript dos dois novos scripts em V8, depois de remover apenas declarações `import/export` para o parser local;
- inspeção estática do source-lock e dos contratos de resposta, protocolo, anexo e polling.

**Não executado:** `node --test` do checkout completo, gerador completo em filesystem de release, montagem integral `build-partner-release.sh`, `bun install`, lint, TypeScript, React/DOM, navegador, APK, Android físico, TalkBack, consulta autenticada a banco, submissão de manifestação, upload de arquivo ou teste E2E. A suíte Node está **versionada e integrada**, mas sua aprovação em checkout integral **não** foi reivindicada.

## 6. Preservações obrigatórias e regressões pendentes

- Preservados: protocolo e assunto; seleção por ID; rascunhos por ocorrência; `detailSequence` para impedir atualizações atrasadas de outro protocolo; eventos visíveis às partes vs nota interna; anexos privados; `apois_case_reply`, `apois_case_internal_note`, `apois_case_register_evidence` e `apois_request_driver_statement`; permissão de resposta apenas em `open/in_progress`; atualizações de 30 segundos; botão de atualizar, agora com texto contextual.
- **INV-002, INV-003, INV-016** permanecem achados técnicos históricos: não contam como novos CV e nenhuma alteração visual é apresentada como sua correção.
- Para homologação futura, avaliar Motorista e equipe: status conhecidos/desconhecidos; erro inicial e após sucesso; vazio verdadeiro; botão retry; retorno da lista; eventos, anexos e notificação de dados possivelmente antigos; leitura de tela sem repetição após polling; acesso à triagem; telas 320/360/390/412 CSS px, orientação paisagem e fonte ampliada.

## 7. Estado consolidado

**Visual:** 26 registros independentes CV-001–CV-026 (24 anteriores + 2). VIS-001 continua alias INV-047; retificação VIS-007/CV-006 continua válida.

**Técnico:** 67 achados históricos, **A 0 / B 46 / C 17 / D 0 / E 1 / G 3** — absolutamente inalterados.

**Operações proibidas:** nenhum merge, deploy, publicação, APK, SQL/RLS, alteração de Supabase, autenticação, financeiro, mapas, regras de negócio, comunicação real com usuários ou modificação dos repositórios-fonte.

**Conclusão:** CV-025 e CV-026 implementados na cadeia preparatória, com evidência sintética reproduzível; aplicação real do builder e homologação continuam pendentes até autorização expressa para o encerramento dos relatórios.
