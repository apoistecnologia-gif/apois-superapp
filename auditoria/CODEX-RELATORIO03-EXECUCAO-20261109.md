# APOIS — Relatório 03 | Execução de código e verificação isolada

**Data:** 09/11/2026  
**Base exclusiva:** `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.  
**Escopo:** INV-035 a INV-043. Relatórios 01/02 e sua matriz de 34 achados preservados.  
**Regra:** nenhuma homologação física, APK, deploy, alteração de Supabase, mudança financeira, campanha real, merge ou alteração dos repositórios pinados.

## Contratos protegidos

- Passageiro pin `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin pin `9fc171050d8b5703540c49d19a8f1e9f5162775f`; Entregas pin `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- Banco Corridas `tbbzkrfupmqdywnzgnms`; banco Entregas `ptgkwyyolrdgnqketkjj`. **Nenhuma escrita ou implantação executada.**
- As FKs informadas no relatório para `user_notification_preferences.user_id`, `user_notification_tokens.user_id` e `notification_logs.user_id` referenciam `public.users(id)`, não `auth.users.id`. `drivers.id` é uma identidade distinta.
- Notificação aceita por FCM não prova exibição, leitura nem recebimento pelo usuário. O protocolo do relatório não autoriza enviar push real.

## Matriz da implementação do Relatório 03

| ID | Estado de código | Alteração versionada | Verificação e limite |
|---|---|---|---|
| INV-035 | B — implementado, sem homologação | O hardener `scripts/harden-corridas-backend-identity-boundary.mjs` passa a usar `normalizeRecipientDomainIds`; valida existência de IDs `public.users`; deixa de converter DOMAIN para AUTH nos destinatários de push. Comentário e aceite da transformação alinhados. O log web do Motorista usa domínio. | Transformação real simulada com fonte pinada de três Edge Functions. **Não publicado**. |
| INV-036 | B — implementado, sem homologação | `supabase/functions/send-ride-push/index.ts` somente desativa token com detalhe FCM tipado `UNREGISTERED` em HTTP 404. HTTP 400 `BadRequest`, 403 e falhas transitórias preservam token. A mesma lógica é injetada na cópia preparada de Corridas. | Expressão extraída do arquivo versionado exercitada em sete cenários sintéticos. Sem Firebase real nem Deno check. |
| INV-037 | B — implementado, sem homologação | `scripts/fix-report03-motorista-notifications-v1.mjs` gera cache de preferências isolado por AUTH ID e geração; consulta anterior à invalidação não sobrescreve resposta nova; `finally` antigo não limpa chamada posterior. | Gerador executado com mocks de arquivos do pin. Não executados E2E com dois usuários/logins. |
| INV-038 | B — implementado, sem homologação | Persistência local de som/vibração retorna resultado explícito. Se servidor confirmou categorias, mas `localStorage` falhou, tela mostra salvamento **parcial**, preserva pendência de som/vibração e permite tentar novamente. | Transformação do código real passou em execução isolada. Não ocorreu teste real de quota ou UI renderizada. |
| INV-039 | B — implementado, sem homologação | Logs FCM passam a considerar status por destinatário, sem token e suprimido, aceitação/falha e parcialidade por aparelho. Totais reconciliam com tentativas; não inferir `sent` pela ausência de falha. | Verificação estática da transformação; não houve inserção real em `notification_logs` ou teste de enum/RLS. |
| INV-040 | B — implementado, sem homologação | `showPush` retorna resultado verificável; `notificationService.notify` só registra `sent` depois de construir a notificação web, e não toca som/vibração em falha/supressão. Restrição de rota interna preservada. | Gerador executado sobre fonte pinada; não testado com navegador físico ou Notification API real. |
| INV-041 | C — parcial, Android pendente | Adaptador `nativeBridge` + `useNotificationPermission` consulta o Capacitor no APK e preserva Web Notifications no navegador. Listener de registro é preparado antes de `PushNotifications.register()`. | Sem APK/celular: falta confirmar permissão alterada nas configurações, sincronização do token da conta atual e estado nativo final. |
| INV-042 | C — parcial, endpoint sem deploy/E2E | Preview Admin usa `/api/admin/notifications` para GET de histórico e POST, substituindo `/_serverFn/` não servido. Dois handlers Vercel idênticos validam token, perfil ativo e permissão `notifications.send` no servidor; nunca colocam service role no navegador, nem retornam histórico fictício. | Arquivos/integração preparados; mock Node de autorização e contagem versionado, **ainda não executado** em Node. Hospedagem real não verificada. |
| INV-043 | B — implementado com limite explícito | Backend e Admin limitam broadcast a **100 destinatários por chamada**; 101+ rejeitados, nunca truncados silenciosamente. O endpoint pode recusar público grande, em vez de enviar lotes sem idempotência. Contratos `failed_users`/`failed` e contadores alinhados; toast Admin não chama sucesso total quando envio parcial. | Expressão/transformações testadas isoladamente, mock de 0/1/100/101/150 versionado; nenhum comunicado real. Grandes campanhas continuam não suportadas sem fila contratada. |

**Semântica:** B = correção de código presente, pendente de build/E2E/homologação. C = medida parcial com impedimento técnico/externo relevante. Não atribuir estado A antes de E2E e publicação verificada.

## Arquivos de produção de código alterados/introduzidos (integrador)

- `scripts/harden-corridas-backend-identity-boundary.mjs`
- `supabase/functions/send-ride-push/index.ts`
- `scripts/fix-report03-corridas-push-runtime-v1.mjs` e integração em `scripts/build-isolated-module.mjs`
- `scripts/fix-report03-motorista-notifications-v1.mjs`, `scripts/fix-report03-native-push-permission-v1.mjs`; integração em `scripts/build-partner-release.sh` e `scripts/build-motorista-module.mjs`
- `scripts/fix-report03-admin-preview-notifications-v1.mjs` e integração em `scripts/build-corridas-admin-spa-v1.mjs`
- `api/admin/notifications.js`, `admin-preview/api/admin/notifications.js` (mesmo conteúdo)
- `scripts/build-admin-vercel-preview.sh`
- `scripts/test-admin-preview-notifications-v1.mjs`, `scripts/test-report03-push-contract-v1.mjs`, `package.json` (gate `verify:report03-push`)

Nenhum arquivo dos submódulos fixados, branch `main` ou banco remoto foi alterado nesta execução.

## Verificações efetivamente executadas (09/11)

1. Leitura do código real via GitHub, inclusive três Edge Functions do Passenger pin e oito arquivos TS/TSX do Motorista/Admin pin.
2. **18 verificações isoladas**, incluindo sete casos da classificação de erros FCM extraída da função versionada, igualdade de endpoints Admin e ligação aos builders: todas passaram.
3. **Três scripts de geração de código executados em simulação JavaScript isolada** contra oito arquivos reais do Motorista/Admin, com substituições e asserts de resultado: passaram; oito arquivos transformados na cópia simulada.
4. **Dois scripts de geração de backend executados em simulação isolada** contra as três Edge Functions reais pinadas e a função canônica versionada: passaram. Na primeira execução, detectou-se falha de âncora no comentário antigo; a causa foi corrigida e o segundo ensaio passou.
5. Nenhuma chamada a FCM, RPC, Supabase real, usuário real ou ambiente de produção nas verificações.

**Não executados:** `node scripts/test-report03-push-contract-v1.mjs`, `node scripts/test-admin-preview-notifications-v1.mjs`, `bun install`, `bun run typecheck`, lint geral, `deno check`, builds Vite/Android e testes de navegador/autenticação. Os dois testes Node foram **adicionados ao repositório**, e há gates nos builders, mas isso não equivale à execução. O ambiente de ferramentas desta conversa permitiu editar/ler GitHub, porém não executar o checkout GitHub com dependências; o terminal local não resolve `github.com`. Os ensaios de transformação realizados são mais fortes que busca textual, mas não provam compilação da aplicação.

## Segurança, reversibilidade e pendências

- O backend FCM em produção descrito no relatório era **v4**; o arquivo modificado no integrador é uma preparação, **não** confirmação de deploy. Não modificar ou reativar em massa os tokens antigos.
- O limite de 100 evita corte silencioso; campanhas com 101+ pessoas **não são aceitas**. Não se implementou fila/lote idempotente sem arquitetura comprovada. Reenvio manual de comunicados de até 100 exige cuidado contra duplicidade.
- O Admin preview depende de configuração externa segura `CORRIDAS_SUPABASE_SERVICE_ROLE_KEY` em runtime **servidor** e de teste de autorização real; não adicionar secrets ao frontend.
- Cache/permissões precisam de E2E após builds. Não declarar que o push funciona em segundo plano no Android antes da homologação física final.
- A reversão é feita pelos commits/arquivos exclusivamente na branch de auditoria. Nenhum rollback de produção é necessário porque **não houve deploy**.

## Commits relevantes do Relatório 03

- `c5c955c` → `d5255fd` → `e361a9c`: contrato de identidade/ajuste de âncora do hardener.
- `0f2c11e`: FCM, status, logs e limite.
- `59b1aed` + `e1a1bcd`: propagação para backend gerado.
- `1a20324`, `b8cb4ab`, `cbde645`, `1159afe`: gerador de preferências, exibição web, Admin SSR e sucesso parcial.
- `2cc8763`: adaptador nativo.
- `fe050b7`, `0f93a38`, `babdf83`, `ac7d603`: ligações aos builders.
- `198944a`, `642147e`, `90216e6`, `415a2ac`, `392bb91`: backend/admin preview e ligação ao build.
- `1bcc03a`, `8e7dea7`, `db3b3bb`: testes versionados e gate do build.

## Continuidade

A implementação **preparatória e reversível** dos nove achados foi registrada. A etapa não é homologação final: INV-041/042 permanecem parciais e as validações de Node/TypeScript/build não ocorreram neste ambiente. O Relatório 04 pode ser recebido sem testes físicos, e o histórico anterior não deve ser reaberto por padrão. Somente o comando do usuário `ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.` abre testes físicos.
