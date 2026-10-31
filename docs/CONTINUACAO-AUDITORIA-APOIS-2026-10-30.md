# CONTINUAÇÃO DE AUDITORIA — APOIS — 30/10/2026

## Objetivo do próximo chat
Continuar auditoria real e visual de 4 módulos (Cliente Corridas, Cliente Entregas, Parceiro Motorista e Parceiro Entregador) e 3 painéis (Estabelecimento Entregas, Admin Entregas e Admin Corridas). Prioridade: fechar **preflight WEB SEM APK**, capturar/logar falhas, corrigir regressões, depois homologar cada fluxo e aspecto visual. Nenhum APK, deploy, merge ou migração em produção até nova autorização explícita.

## Ponto exato
- Repositório de integração **único**: `apoistecnologia-gif/apois-superapp`
- Branch: `fix/entregas-homologacao-ajustes-20261030`
- Último commit de código no momento do handoff: `cb0f1688ada6c3aba53fc1faf19e49d3691f6a0b`
- Relatório detalhado: `docs/AUDITORIA-APOIS-HOMOLOGACAO-2026-10-30.md`
- Preflight WEB sem APK: `.github/workflows/apois-partner-preflight.yml`
- Execução do último commit **falhou no preflight WEB, sem APK**: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41136225745
- As primeiras execuções falharam em scripts de marca que esperavam classes/legendas antigas. Script de cadastro Motorista ajustado; script extra redundante de título Admin retirado do build. **Verificar logs atuais, não assumir aprovação.**
- Commits apenas no superapp, não editar snapshots `sources/`, não alterar projetos protegidos.
- Banco Entregas **confirmado**: `ptgkwyyolrdgnqketkjj`. Banco Corridas distinto; usar o source-lock atual.
- Verificação SQL de 30/10: pedidos de teste #5 e #6 = `delivered` tanto em `orders` quanto em `delivery_jobs`, com timestamps.
- Mapeamento 2 APKs/4 módulos preservado.

## Alterações acumuladas em scripts na branch
- `fix-partner-courier-simple-journey-v1.mjs`: retiradas e PIN, com estágios backend, timeout, busy e reconciliação restaurados após auditoria.
- `fix-partner-courier-manual-online-v1.mjs`: login offline por decisão do entregador, exceto entrega em andamento.
- `fix-partner-courier-map-journey-v1.mjs`: mapa compacto, rota externa sem key APOIS e paleta clara.
- `fix-partner-courier-idle-status-v1.mjs`, `fix-partner-courier-completion-light-v1.mjs`.
- `fix-partner-courier-profile-history-v1.mjs`: tela clara, foto, nome e telefone; bucket policy em SQL `supabase/entregas-forward-migrations/courier_profile_avatar_scoped_upload.sql` versionada, **NÃO aplicada**.
- `fix-partner-motorista-client-map-style-v1.mjs`: visual do mapa motorista conforme cliente.
- `fix-corridas-current-gps-fallback-v1.mjs`: remove fallback falso de Petrolina, cache GPS e retry permissão.
- `superapp/partner-shell/index.html`: oculta quadrado preto `vehicle-mark`.
- `fix-merchant-order-control-visual-v1.mjs`: branco/vermelho e safe-area no controle flutuante merchant, ligado a `build-merchant-panel.mjs`.
- `harden-partner-driver-registration-exit-v3.mjs`: correção para aceitar root já claro durante build.
- `fix-partner-admin-legacy-brand-v1.mjs` está versionado mas **não invocado**, pois era redundante e falhava no preflight. Não reintroduzir sem prova.
- A execução atual tem teste web somente; **nenhum APK gerado.**

## Gates e pendências seguintes
1. Consultar a execução 41136039087, obter Job Logs e corrigir **um erro por vez**, sem alterar regras operacionais.
2. Garantir `npm run build:partner` / typecheck realmente verdes antes do APK; a simulação de script em V8 não substitui build.
3. Rodar/build cliente WEB sem APK para validar o GPS Corridas, status Entregas e compatibilidade de visual. Workflow de cliente Android **não deve ser disparado**.
4. Obter capturas renderizadas de login/home/perfil/pedido/mapa/histórico dos 4 módulos; capturas desktop/mobile dos painéis.
5. Painéis Entregas ainda usam `WorkspaceShell.tsx` escuro; migrar com critério, componente por componente, sem quebra de legibilidade e sem CSS global cego.
6. Confirmar permissões individuais de upload avatar/RLS antes de implantar SQL, testar acesso de outro usuário.
7. Homologar Google Maps/quotas somente após resolução da cobrança contestada da conta; não habilitar APIs pagas como paliativo.
8. Repetir teste E2E com pedido fictício e dois celulares: despacho, aceite, retirada, PIN, backend `delivered`, cliente recebendo conclusão, histórico e relogin offline.
9. Fiscalizar Safe2Pay, pagamentos diretos e mensalidade conforme provider **realmente habilitado**, sem chamadas financeiras de produção na homologação.

## Regra de comunicação
Não afirmar que testes visuais em produção, build, ou APK passaram sem logs/capturas. Se o chat ficar pesado, retornar a este handoff. Trabalhar com um problema de cada vez e não solicitar novamente informações já documentadas.

## Registro adicional dos testes reais de CI
- Run 41135695024 falhou no hardener de cadastro do Motorista: seletor raiz já tinha mudado com a transformação visual anterior.
- Runs 41135877179 e 41135950121 falharam em ajuste cosmético de título Admin: a fonte já havia sido transformada. O ajuste extra foi retirado do build.
- Run 41136039087 falhou ainda no seletor do cadastro Motorista. Refatorado fallback para localizar a raiz JSX do componente, sem mudar regras de cadastro.
- Run 41136190950 falhou por erro de escape em busca do `return (` da raiz. Corrigido em `cb0f1688ad`.
- **Próximo passo no novo chat:** verificar conclusão/log da execução 41136225745 e prosseguir erro por erro até preflight web verde. Não assumir que um run queued/in_progress passou. Este workflow não gera APK.

- **ÚLTIMO ERRO REAL CONFIRMADO:** Execução 41136225745 parou em `scripts/harden-partner-driver-registration-exit-v3.mjs`: `[FAIL] Motorista V3 form top matches=0` (linha 51). Raiz visual do sucesso já foi resolvida, mas a barra superior do formulário também estava pré-estilizada por hardener anterior. No novo chat, corrigir especificamente a substituição de `border-b border-white/5 bg-[#050607]/95` de forma idempotente e segura, testar preflight de novo. Não modificar o formulário funcional ou desmontar os botões de saída.

## RETOMADA ATUALIZADA — HOMOLOGAÇÃO WEB — 30/10/2026 (substitui informações antigas acima)

**Fonte de verdade e limites:** continuar exclusivamente no repositório `apoistecnologia-gif/apois-superapp` e branch `fix/entregas-homologacao-ajustes-20261030`, sem editar bases fixadas, sem gerar APK, sem fazer deploy/merge, sem SQL de mutação no Supabase e sem cobranças. O preflight permitido é `.github/workflows/apois-partner-preflight.yml`, com três jobs **WEB-only**.

### Resultado real mais recente confirmado
- GitHub Actions run **41138780733**: `WEB-only cliente` **SUCCESS**, `WEB-only estabelecimento` **SUCCESS**, `audit-web-only` **FAILURE**.
  https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41138780733
- Cliente WEB compila Corridas + Entregas, shell unificado e verifica dist, recovery, PIN autorizado, isolamento e segurança. Não é APK nem teste Android real.
- Painel Estabelecimento/Admin Entregas WEB passou **após** correção de `build-merchant-panel.mjs` que passou a gerar `src/assets/apoisClientBrandData.ts` via `harden-entregas-superapp-brand-assets.mjs` ANTES do typecheck. Inclui contrato de cash/pending, sem gateway eletrônico ativo.
- O Parceiro compilou scripts, passou testes unitários (5 pass) e parou em **TypeScript TS1005: missing `}` em `CourierPremiumViews.tsx(991,1)`**. Causa real encontrada no texto de `const component` em `scripts/fix-partner-courier-simple-journey-v1.mjs`: terminava em `</section> );` sem fechar `ActiveDelivery`. Correção salva no commit **`9e50434856f35fe9f6ce38c2b166529fa5b95bf6`**. **Ainda não há prova de preflight verde posterior a esse patch**; verificar novo run ou executar preflight WEB autorizado, nunca APK.

### Erros já superados e preservações verificadas
- `harden-partner-driver-registration-exit-v3.mjs`: aceita cabeçalho do formulário já transformado por marca, cadastro/sair preservados.
- `fix-partner-courier-offer-contrast-v1.mjs`: leitura legível do endereço de retirada após hardeners.
- `fix-partner-courier-manual-online-v1.mjs`: login offline quando sem entrega ativa, atualização manual, falha de rede preserva último estado. Confirmado em logs de preflight, não em dispositivo.
- `fix-partner-courier-map-journey-v1.mjs`: card compacto e `NAVEGAR` externo para estabelecimento/cliente sem Routes API paga, suporta classe de mapa `clamp(24rem,62dvh,36rem)` do hardener prévio. Passou execução WEB antes do TypeScript.
- `fix-partner-courier-completion-light-v1.mjs`: sem fundo preto, cabeçalho e botão compactos; regex JSX corrigido; passou simulação isolada e o preflight avançou depois dele.
- `fix-merchant-order-control-visual-v1.mjs`: troca cores/contraste por classe sem alterar pedido; quando a versão atual só possui CTA inline `requestCourier(order.id)`, preserva o CTA em vez de exigir o antigo flutuante. Painel WEB verde.
- `scripts/audit-superapp-static.mjs`: pin oficial de Entregas alinhado ao `.apois/source-lock.json` (`2f4606e0...`), allowlist restrita aos QUATRO workflows QA preexistentes; extra workflow de homologação criado durante diagnóstico foi **excluído** e os 3 jobs agora estão dentro do preflight permitido.
- `scripts/verify-superapp-dist.mjs`: teste de PIN autorizado (não ler direto `ride.security_code`), redirecionamento nativo/web de recuperação; `scripts/verify-superapp-customer-security.mjs`: safe area de perfil do Cliente Entregas 9rem; ambos validados pelos builds web Cliente.
- Nenhum deploy, merge, migration, criação de pedido real ou APK realizado neste ciclo.

### Próxima ação exata
1. Consultar execuções GitHub de `fix/entregas-homologacao-ajustes-20261030` mais recentes que commit `9e50434856f35fe9f6ce38c2b166529fa5b95bf6`; identificar se **audit-web-only Parceiro** está verde. Usar jobs/logs, não inferências. Se continuar TS/JS error, corrigir a causa no script de produção do workspace, sempre preservando 2 APKs/4 módulos e serviços financeiros.
2. Só depois de preflight WEB verde fazer auditoria renderizada real de cada tela de Cliente, Parceiro e painéis (desktop/celular) em ambiente de teste; não afirmar visual validado por leitura de arquivos ou scripts. A dívida Google Maps continua bloqueando homologação completa da navegação paga.
3. Validar cadastro/login, app offline manual, aceite, rota, retirada, PIN, entrega final e sincronização de pedidos; avatar precisa de RLS individual de bucket antes de teste. Condições das corridas e Safe2Pay devem ser mantidas.
4. Fazer outro handoff se a conversa ficar longa, informando último commit/teste e pendências concretas. A seção de handoff antiga, acima, foi preservada como histórico e **não representa a situação atual**.

## RESULTADO CONFIRMADO — 30/10/2026, após correção do Parceiro
- **Execução oficial WEB: 41140195643 — SUCCESS, três jobs verdes**, commit `821419b570a72953fd709a3b5452052c38dff71a` (posteriormente acrescentado apenas relatório documental).
  https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41140195643
- `WEB-only cliente`: SUCCESS (Cliente Corridas + Entregas).
- `WEB-only estabelecimento`: SUCCESS (Estabelecimento / Admin Entregas).
- `audit-web-only`: SUCCESS (Parceiro Motorista + Entregador, TypeScript, builds, testes de integração/preflight estático).
- A correção da chave JSX do `ActiveDelivery` avançou o TypeScript e revelou três regressões subsequentes: import duplicado de `Capacitor` (corrigido em `fix-partner-courier-map-journey-v1.mjs`), referência `import.meta.env.VITE_SUPABASE_URL` exigindo bracket access TypeScript (correção `fix-partner-courier-env-type-v1.mjs` integrada ao build), e botões/props de troca de papel ausentes no `CourierProfilePanel` (restaurados em `fix-partner-courier-profile-history-v1.mjs`).
- O último bloqueio era uma verificação desatualizada esperando cores de mapa antigas; ajustado `scripts/audit-partner-preflight-v1.mjs` para exigir paleta clara APOIS realmente construída, sem reduzir cobertura. A auditoria verifica fechamento JSX do fluxo simplificado para evitar regressão.
- **Todas as alterações de código da retomada ficaram na branch de integração.** Comparação entre commit `9e504348...` e `821419b5...`: somente scripts, build, verificações e documento; nenhuma origem fixada `sources/`, banco, migration ou configuração de produção mudou.
- **NENHUM APK, deploy, merge, cobrança ou mutação de Supabase nesta etapa.**
- **Atenção:** três builds WEB aprovados **não** equivalem a homologação visual renderizada, teste físico Android, serviços de Maps ativos ou produção autorizada.
- Matriz de cobertura visual estática e pendências: `docs/MATRIZ-VISUAL-HOMOLOGACAO-2026-10-30.md`. É uma revisão de código e capturas anteriores, não capturas atuais.
- Próxima etapa correta: obter screenshots reais de login/home/mapas/pedidos/perfil/histórico dos quatro módulos e painéis desktop/celular, validar contraste, conteúdo e controles em ambiente de teste, verificar E2E com GPS/Maps (cobrança em disputa), RLS individual do avatar, notificações e status de pedido pós-PIN. **Não liberar produção/gerar APK sem autorização.**
- As informações de "preflight falhou" nas seções anteriores são histórico; **a execução mais recente confirmada está VERDE**.

## RETOMADA VISUAL CONTÍNUA — 30/10/2026, após preflight 41140864156
- Último preflight comprovado: **3/3 jobs SUCCESS**, `41140864156`, código no commit `44d2405b65db973a847192121ef3ce82999c5ac0`.
- A migração **segura e incremental** do WorkspaceShell do Estabelecimento/Admin Entregas foi aplicada na branch de homologação: sidebar/header claros e vermelho APOIS, estado ativo legível, cartões de métricas e vazio com texto escuro, botões de menu com rótulos. Conteúdo operacional permanece escuro para preservar o texto branco herdado nos cartões ainda não migrados. Não afirmar que todo o painel já ficou branco.
- Arquivos de código alterados nesta etapa: `scripts/fix-entregas-workspace-shell-light-v1.mjs` (novo) e `scripts/build-merchant-panel.mjs` (um passo adicionado). Nenhuma alteração em `sources/` ou Supabase.
- Report visual incremental: `docs/MATRIZ-VISUAL-HOMOLOGACAO-2026-10-30.md`.
- Próxima prioridade: validar de fato em navegador de testes as telas e estados do Admin Entregas/Estabelecimento (menus, tabelas, cartões, overlays, modal), antes de migrar conteúdo interno, para evitar texto invisível. Admin Corridas e quatro módulos carecem de evidência visual renderizada atual. Google Maps e avatar RLS têm dependências externas não liberadas; não habilitar APIs pagas nem publicar versões.

## RETOMADA — VISUAL ADMIN ENTREGAS, 30/10/2026 — EXECUÇÃO 41141538529

- Branch canônica de homologação: `fix/entregas-homologacao-ajustes-20261030`. Sem APK, deploy, merge, chamadas de pagamento ou alterações de produção.
- **GitHub Actions `41141538529`: 3/3 jobs SUCCESS**, commit **`d6816dc60831b7b62b86ac9525c28a1ce70f2270`**, abrangendo WEB-only Cliente, WEB-only Estabelecimento/Admin Entregas e audit-web-only Parceiro. https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41141538529
- Correção visual localizada do diagnóstico administrativo: novo script `scripts/fix-entregas-admin-readiness-light-v1.mjs`, painel `AdminCourierOperationalGates.tsx` transformado no workspace efêmero: fundo branco, texto escuro, aviso amber legível, foco visível; preserva consultas Supabase, alertas de Safe2Pay, expiração de assinaturas e refresh somente leitura.
- Correção visual localizada dos formulários de cobertura e zonas no Admin Entregas: novo script `scripts/fix-entregas-admin-coverage-contrast-v1.mjs`, melhora etiquetas de 10 px para 12 px e troca cinza `#52525B` por `#CBD5E1` sobre cartões escuros. Contraste estimado por cálculo WCAG: **2,57:1 antes**, **13,40:1 depois** sobre `#09090B`. É medição de cores do código, não captura renderizada.
- Ambos os scripts adicionados ao **build WEB isolado do Estabelecimento**, depois do `WorkspaceShell`. Testes isolados aplicaram as substituições na fonte fixada e reaplicaram sem duplicação; pipeline WEB real passou por typecheck/build/testes existentes.
- Nenhuma migração ampla/global de páginas internas foi feita; Admin Coverage permanece com cartões escuros até validação visual real, evitando texto invisível. A mudança não altera geometrias, raios, seleção de cidade, inscrições, pedidos nem operações financeiras.
- **Ainda não validado:** telas renderizadas logadas em navegador e Android reais, e testes GPS/Maps, avatar Storage com RLS, pedidos E2E com PIN e autenticação de papéis. Não declarar homologação completa nem produção pronta só pelos builds.

## GATE WEB AMPLIADO — 30/10/2026 — 41141759094

- **Preflight real 41141759094: SUCCESS nos três jobs** (`WEB-only cliente`, `WEB-only estabelecimento` e `audit-web-only`). https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41141759094
- Foi incluído no job WEB de Estabelecimento, apenas no GitHub Actions efêmero, um segundo comando de build: `(cd .work/entregas && APOIS_MOBILE_BUILD=0 bun run build:admin)`. Assim, além de `build:merchant`, as rotas **Admin Entregas também compilaram separadamente**, com log explícito `[OK] Painel Admin Entregas: rotas WEB compiladas isoladamente, nenhum deploy`.
- A execução 41141538529 já havia confirmado 3/3 verdes para os patches de contraste `AdminCourierOperationalGates.tsx` e `AdminCoveragePanel.tsx`. Os scripts são idempotentes na fonte de referência, com handlers/consultas preservados.
- A comparação de commits a partir de `f3c5f44e...` até `0dbed7d5...` mostra somente scripts de styling, `scripts/build-merchant-panel.mjs`, o workflow de **QA WEB** e documentos. Nenhum `sources/`, migration, segredo, backend, regra de negócio ou produção foi modificado.
- Ainda não foram obtidas capturas das telas em navegador com conta/autorização real, testes Android físicos nem verificação de integração GPS/Maps. Não marcar homologação final nem produzir APK/publicar sem autorização.

## CONTINUIDADE — Admin Pedidos e Mapa Operacional — 30/10/2026
- O preflight WEB oficial mais recente confirmado é **41142358832: SUCCESS nos 3 jobs** (`audit-web-only`, `WEB-only cliente`, `WEB-only estabelecimento`), commit de integração `508f79382ef31301225f6f9eb2ef126fc814f78b`. https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41142358832
- Log do job Estabelecimento comprova `fix-entregas-admin-orders-contrast-v1.mjs` e `fix-entregas-admin-realtime-legibility-v1.mjs` executados com `EXIT 0`; `bun run build:admin` isolado concluiu `[OK] Painel Admin Entregas: rotas WEB compiladas isoladamente, nenhum deploy`.
- `AdminOrdersPanel`: IDs de 9 px e datas/legendas de 10 px antes; agora 12/11 px, texto `#CBD5E1` sobre cartões escuros. Preservados filtros de status/pagamento/cidade/data, expansão de pedido, timeline e valores financeiros. Script de QA idempotente.
- `AdminRealtimeOperationsPanel`: contraste e tipografia dos cabeçalhos, datas e indicadores de presença no mapa melhorados. Preservados consultas `delivery_jobs`, `courier_availability`, `courier_locations`, Google Map, marcadores e refresh; script de QA idempotente.
- **Importante:** esta é auditoria ESTÁTICA + build WEB; a renderização real das páginas autenticadas, responsividade em navegador e testes Android físicos ainda não foram realizados. A conta Maps continua sendo dependência externa. Não afirmar homologação final.
- **Restrições:** nenhum APK, deploy, merge, migração, SQL em produção ou alteração dos snapshots protegidos.
- Próxima revisão segura: Admin Suporte/Avaliações/Repasses (identificar rótulos escuros e tamanho, corrigir apenas com classes locais e gates); depois capturas reais das quatro áreas e painéis com conta de homologação, sem acionar serviços pagos sem permissão.

## CONTINUIDADE — AVALIAÇÕES E REPASSES ADMIN — 30/10/2026

- **Preflight WEB confirmado: [41144551669](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41144551669) = SUCCESS nos 3 jobs**, referente ao commit de código `4f850255ada579054756680abf693ba577c9d31e`. Cliente, Parceiro e Estabelecimento/Admin Entregas compilaram e passaram verificações automatizadas.
- `scripts/fix-entregas-admin-reviews-contrast-v1.mjs` corrige exclusivamente tipografia/contraste em `AdminReviewsPanel.tsx`: notas, nomes, campos e rótulos anteriormente com `text-zinc-600/700` ou `text-[10px]`. Preserva filtros por avaliação, busca, recarga, nomes, notas reais e comentários.
- `scripts/fix-entregas-admin-settlements-contrast-v1.mjs` corrige tipografia/contraste em `AdminCourierSettlementsPanel.tsx`: cabeçalhos, datas, valores informativos e motivos das disputas; preserva totais, vencimento, comprovantes, status, `resolveDispute`, filtros e a tabela com scroll horizontal.
- As duas correções estão somente no fluxo de build WEB isolado de `scripts/build-merchant-panel.mjs`. Foram testadas em simulação com segunda execução idempotente (zero escritas extras) e pelo preflight real. **Nenhuma migration, alteração de Supabase, API, pagamento, deploy ou APK**.
- Comparação do bloco anterior de commits (`508f79382e...` até `4f850255ad...`): apenas scripts de homologação e documentação. Nenhum snapshot protegido de `sources/` alterado.
- **Ainda falta** revisão do contraste do componente `AdminSupportPanel` (rótulos de chamados/mensagens de 9–10 px e cinzas escuros). Corrigir isoladamente, verificar scripts idempotentes e CI. Depois fazer revisão renderizada de Admin Entregas/Estabelecimento e demais módulos quando existir ambiente seguro de homologação.
- **Não declarar homologação visual real ou teste Android**: os três jobs são build/testes WEB sem capturas novas autenticadas, nem teste físico de GPS/Maps, notificação, PIN ou RLS de avatar.

## CONTINUIDADE — ADMIN SUPORTE — 30/10/2026

- **Preflight WEB mais recente do código:** [41144738866](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41144738866), commit `f993f1ad3102b8c529d03741ac29d77d84ad8976`: **SUCCESS nos 3 jobs** (Cliente, Parceiro, Estabelecimento/Admin Entregas).
- `scripts/fix-entregas-admin-support-contrast-v1.mjs` inclui ajuste de contraste/tamanho de rótulos de tickets, horários e mensagens em `AdminSupportPanel.tsx`. Estilos cinza-escuros e 9/10px foram substituídos por textos com contraste maior e fonte legível.
- Preservados os handlers de resposta externa, nota interna, transições aberto/em atendimento/resolvido/fechado, anexo por `createSignedUrl(path, 60)` e proteção `noopener noreferrer`.
- Correção isolada no build `scripts/build-merchant-panel.mjs`; aplicada em simulação com **segunda execução idempotente (zero escrita extra)**, além da compilação WEB oficial.
- Antes dela, `AdminReviewsPanel` e `AdminCourierSettlementsPanel` também passaram 3/3 jobs no [preflight 41144551669](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41144551669). Nada foi alterado nas regras de cálculo, busca, resolução de disputa ou storage.
- **Nenhum APK, deploy, merge, Supabase SQL/migration, produção ou snapshots protegidos modificados.**
- **Pendência real:** visual renderizado de páginas autenticadas, fontes no browser/mobile e validação física dos quatro módulos. Build WEB verde não substitui E2E, GPS/Maps, avatar RLS, push ou pagamento de verdade. Não declarar homologação final.


## RETOMADA VERIFICADA — 30/10/2026 — MODAL ADMIN E RESSALVAS DE QUALIDADE

- HEAD encontrado no início desta retomada: `92fbc1eb4c2e5df565526e612472e5d550ed5db3`. A comparação com `f993f1ad3102b8c529d03741ac29d77d84ad8976` mostrou dois commits exclusivamente documentais. As correções de Suporte/Avaliações/Repasses já estavam aplicadas; não foram refeitas.
- Execução histórica `41141538529` confirmada como completed/success; posterior `41144738866` confirmada com três jobs success.
- **Novo código validado:** `65f13245d3ba102f5198d04b5fbe5b9fcce9539d`. [Preflight 41145512666](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41145512666): **completed, 3/3 SUCCESS** — Cliente, Parceiro e Estabelecimento/Admin Entregas.
- EM-UI-030: `AdminMerchantCreateDialog.tsx` tinha duas opções extensas em grade fixa de duas colunas e botões de altura/nowrap padrão: risco estático de corte em viewport estreita. `scripts/fix-entregas-admin-merchant-dialog-responsive-v1.mjs` agora empilha essas opções abaixo de sm, permite quebra de texto e altura automática, usa limite 90dvh e melhora contraste dos metadados. Apenas quatro substituições de className, sem mudança de handlers, validações, criação de usuário ou payload RPC.
- Script integrado após os patches existentes em `scripts/build-merchant-panel.mjs`. Asserção reversível garante que só as substituições visuais permitidas ocorreram; falha se o seletor deriva ou duplica. Sintaxe Node passou; segunda aplicação preservou SHA-256 `69b4fed03b70cdc272022212530c65ddf5134799a2cdd67905269593c03f57b7` da fixture transformada.
- **Status EM-UI-030:** corrigido e validado quanto à transformação idempotente, preservação textual do comportamento, typecheck e build WEB. **A aparência renderizada ainda não foi validada.** Não houve screenshot nem teste do modal com conta administrativa.
- Logs do job Estabelecimento `124369555670`: typecheck EXIT 0; **48 testes / 8 arquivos, 48 pass, 0 fail**; build:customer e build:merchant EXIT 0; build:admin separado concluído. Parceiro/Cliente também têm jobs concluídos com success.
- **EM-QA-031 — pendência confirmada:** lint Entregas retorna EXIT 1, **2.629 problemas (2.279 erros, 350 avisos)**. A mesma contagem estava no run anterior `41144738866`, job `124367098224`. O build já usava `allowFailure: true` para lint; essa política NÃO foi criada, ampliada nem desabilitada nesta retomada. Portanto **3/3 jobs verdes NÃO significa lint aprovado**. A maioria dos erros é de formatação, mas há pelo menos um `no-empty`; não classificar todos como cosméticos sem triagem. Resolver em etapa própria, sem formatação global cega ou alteração de pagamentos.
- **EM-QA-032 — risco estático a conferir no workspace final:** o gate `audit-post-layout-v26.mjs` alerta sobre Carteira, Corridas e Detalhes de Fretes/Guincho/Envios. Leitura do pin Passageiro confirmou rotas `_authenticated.carteira.tsx` / `_authenticated.corridas.tsx` contendo apenas títulos e `ServiceDetailsForm.tsx` sem campos de formulário. O gate inspeciona a fonte protegida, não a renderização transformada; verificar substituições efetivas do build antes de concluir que a UI final está incompleta. Não remover rotas nem inventar funcionalidades financeiras.
- **EM-QA-033 — reprodutibilidade:** instalação frozen do pin Entregas falha com o Bun atual e o builder recorre a `bun install --no-save` em .work. Aviso herdado e não corrigido nesta etapa; build verde não prova instalação congelada reproduzível.
- **Maps:** logs Cliente informam mapa de rastreamento Entregas desabilitado até browser key/map ID válidos e chave Android Corridas ausente. Não habilitar serviços pagos nem concluir que mapas foram testados pelo build.
- Nenhum APK/AAB, deploy, merge, SQL remoto, cobrança ou edição de `sources/`, APIs, Auth ou produção. Diff deste patch: somente novo script e uma inclusão no builder.
- **Próximo trabalho:** inspeção renderizada dos quatro módulos e três painéis em ambiente isolado com contas de homologação e backend de teste, especialmente modal a 320/360/390px, teclado e telas baixas; preservar operações de cadastro sem submeter em produção. Não existe evidência atual de capturas autenticadas ou ambiente E2E seguro nos artefatos desta execução (o run anterior não tinha artifacts).
- **Gates restantes antes da homologação final:** triagem do lint e lockfile, confirmação das rotas acima no bundle final, capturas reais de login/cadastro/home/mapa/pedidos/perfil/histórico e estados loading/error/empty, RBAC por papel, E2E despacho→retirada→PIN→delivered, GPS/Maps, push/reconexão/background e avatar/RLS. Android e integrações externas permanecem pendentes; policy de avatar não aplicada. Não chamar o ecossistema de homologado.

## AUDITORIA COM NAVEGADOR — 30/10/2026 — RESULTADO ATUAL

**Último código validado:** `9f0bed2013869bbeee2fb4c22b7369465174bc85`.
[Preflight 41147248909](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41147248909): **completed / SUCCESS nos três jobs**, conferidos individualmente.
Esta seção atualiza o estado anterior sem reiniciar a auditoria.

### Evidência nova
- Foi acrescentado `scripts/audit-browser-public-v1.mjs` ao workflow WEB existente. Usa Playwright 1.62.1/Chromium, servidor estático loopback sobre os bundles finais e contextos sem sessão; toda requisição externa é bloqueada antes de sair do navegador. Nenhuma credencial de usuário, login real, cobrança, chamada Maps ou mutação de backend foi usada.
- **12/12 renderizações passaram:** seletores Cliente e Parceiro + logins Cliente Corridas, Cliente Entregas, Motorista e Entregador, cada um a 360×800 e 1280×900.
- Nas 12 renderizações finais: conteúdo e controles visíveis, sem overflow horizontal detectado, sem pageerror e sem recurso local HTTP >=400. Isso **não testa clique de todos os controles, submissão, autenticação, foco completo ou contraste de todos os estados**.
- Capturas reais foram baixadas e inspecionadas nesta sessão, incluindo logins, seletor Parceiro antes/depois e Entregador final. Não são mockups. Telas privadas não foram abertas.
- Registro compacto permanente: `docs/evidence/PUBLIC-BROWSER-2026-10-30.json`. Screenshots/relatórios completos estão nos artifacts do run, com retenção de 7 dias (expiram em 06/11/2026).
- Job Estabelecimento: typecheck EXIT 0; **48 pass / 0 fail em 8 arquivos**; builds WEB Cliente/Estabelecimento/Admin Entregas concluídos. Parceiro também passou typechecks, builds e seus gates existentes.
- Lint Entregas permanece **FAIL: 2.279 erros, 350 avisos**, mesma contagem anterior. O resultado verde de CI não declara lint aprovado; a política herdada de continuar após lint não foi ampliada.

### Achados e correções
| ID | Evidência / causa | Correção final | Estado |
| --- | --- | --- | --- |
| EM-BOOT-034 | Primeiro run de navegador 41145944566: Entregador requisitava chunks e CSS em /assets na raiz; pageerrors e arquivos 404, apesar do build verde | `harden-partner-entregador-router.mjs` agora define `vite: { base: "./" }` no workspace Parceiro, como já fazia o adaptador Cliente. `partner-shell/build.mjs` normaliza /./assets e ../assets no HTML final, como o shell Cliente. Reescrita intermediária de prefixos foi retirada; não há alias no servidor de teste para mascarar o erro | Corrigido e validado no Chromium, 360/1280, sem 404 ou pageerror |
| EM-UI-035 | Screenshot do seletor Parceiro mostrava silhuetas e disco vermelho atrás das descrições/títulos | CSS local oculta somente pseudoimagem/vehicle-mark decorativos, reduz disco e amplia área dos textos. Ambos os botões por papel, handlers, travas operacionais e deep links preservados | Corrigido e validado por captura final e gate |
| EM-ASSET-036 | Imagem decorativa delivery-hero dependia de /__l5e/assets-v1/... ausente no pacote offline | Fallback local transparente/neutro no script visual e no artefato compilado específico, mantendo logo oficial e camadas de gradiente; sem alterar formulário | Corrigido e validado: nenhuma requisição 404 desse asset no run final |
| EM-QA-032 (revisão) | Gate pré-build lia os placeholders da origem protegida, não a árvore transformada | Inspeção de `build-isolated-module.mjs` comprovou que `restore-corridas-wallet-screen.mjs` / `restore-corridas-history-screen.mjs` e os respectivos verificadores já executam no build. Não recriar essas telas | Alerta de placeholder não prova ausência na UI final; funcionamento autenticado continua não testado |
| EM-QA-031/033 | Lint herdado e fallback de instalação --no-save | Documentados, sem formatação ampla nem mudança financeira | Pendentes |

### Falhas intermediárias e preservação
- Runs 41145944566, 41146244678, 41146300138, 41146586883 e 41146815117 detectaram o problema de assets em graus diferentes; não foram tratados como aprovados.
- Run 41146906592 parou no transformador Vite por escape literal de newline; corrigido e testado sobre a fixture pinada com duas aplicações. Run 41147071557 revelou prefixo duplicado da correção intermediária; reescrita removida em `9f0bed20`.
- Não houve skip de gate para obter sucesso. `41147248909` é o resultado final comprovado.
- Diferenças desde `6c7aacf6` restritas ao workflow WEB permitido, scripts de integração/QA e shell Parceiro; nenhum `sources/`, backend, migration, API, Auth, pagamento ou produção alterado. Nenhum APK/AAB, deploy ou merge.

### Prontidão para APKs de teste e próximo passo
- **Não declarar auditoria funcional integral ou homologação final.** O novo gate cobre apenas inicialização pública.
- Antes de recomendar a rodada ampla de APKs: revisar telas autenticadas de home/mapas/pedidos/perfil/ganhos/histórico e painéis por papel em ambiente de homologação, e fechar os bloqueios funcionais encontrados nessa revisão. Essa sessão não possui conta/backend de teste autenticado identificado; não usar sessão ou backend de produção como substituto.
- Testes físicos de GPS/background/push/safe-area/OAuth nativo exigirão os APKs de teste posteriormente autorizados; são gates da homologação final, **não testes já realizados nem exigência circular para compilar o primeiro APK**.
- A ausência de chave Android nos logs do preflight é intencional: o workflow WEB define esse valor vazio. Ela não demonstra ausência do secret no workflow Android, que foi apenas lido, nunca executado. Disponibilidade real de Maps/quotas e configuração de Entregas ainda precisa de validação externa.
- Próximos alvos: cadastro/recuperação sem envio real, navegação/controle de senha, quatro módulos autenticados, Admin Corridas (ainda sem nova captura), Estabelecimento/Admin Entregas, contraste completo, teclado e estados loading/error/empty. Depois E2E despacho→aceite→retirada→PIN→delivered, avatar/RLS e serviços externos. Preservar fluxo simplificado do Entregador.

## CONTINUIDADE — INTERAÇÕES PÚBLICAS — 30/10/2026

**Código validado:** `5c77ee772fdb8d5f4b84abc919b8eba03cbd1f5f`.
[Preflight 41149559064](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41149559064): **completed / SUCCESS, três jobs conferidos individualmente**.
Relatório permanente: `docs/evidence/PUBLIC-INTERACTIONS-2026-10-30.json`.

### O que foi executado
- `scripts/audit-browser-public-v1.mjs` agora verifica interações reais no Chromium, com rede externa inteiramente bloqueada, além das 12 renderizações iniciais (quatro logins e dois seletores, 360×800 e 1280×900).
- **32 ações verificadas**: 8 acessos aos módulos pelo seletor; 8 verificações de revelar/ocultar senha sem modificar o valor; 8 acionamentos de recuperação; 8 aberturas de cadastro.
- O gate foi reforçado após a captura revelar que src correto não bastava: CSS legado por alt ainda substituía a imagem. A alteração local de alt evita esse seletor; não houve mudança global de tema. Captura final confirma logo oficial circular, sem o SVG legado. O teste exige imagem visível, src oficial e ausência de content:url.
- Nas verificações de recuperação, os módulos que têm rota própria abriram a interface; no Cliente Entregas o clique com e-mail vazio exibiu a validação para informar e-mail. **Não houve solicitação de e-mail ou teste de recebimento do link.** O rótulo técnico do relatório “open password recovery” não deve ser interpretado como envio de recuperação.
- Cadastro: clique deve mudar o conteúdo, apresentar formulário e, no Cliente Entregas, renderizar a URI da arte oficial versionada. A marca foi confirmada no DOM nas duas larguras, não apenas por leitura de fonte. Os formulários não foram submetidos e nenhum usuário foi criado.
- As capturas incluem cadastro/recuperação. O toast deixado pela validação é fechado pelo controle real antes da captura de cadastro. Screenshots temporários estão nos artifacts com retenção de sete dias.
- **Todos os 12 casos e 32 ações passaram**, sem pageerrors nem recursos locais ausentes. Estabelecimento/Admin Entregas conservaram build/typecheck/testes WEB, sem novo teste autenticado de painel.
- Lint herdado permanece FAIL com 2.279 erros e 350 avisos; 48 testes de Entregas passam. Nenhuma regra de lint/teste foi desabilitada nesta retomada. Runs 41148841078 e 41149191292 passaram etapas anteriores, mas não substituem o resultado final reforçado 41149559064.

### Problemas encontrados e corrigidos
| ID | Evidência | Correção | Estado |
| --- | --- | --- | --- |
| EM-UI-037 | Run 41148452102 falhou apenas no Cliente: após navegar para cadastro, fallback da logo buscava /apois-logo.svg na raiz do pacote. Captura mostrava identidade antiga | `harden-entregas-superapp-brand-theme.mjs` incorpora a arte oficial em `register.tsx`, alterando exclusivamente import, src, alt e dimensão do img. O alt legado acionava uma regra de system-theme.css com content:url que substituía a arte, mesmo com src correto. Verificação reversível garante que os demais bytes do formulário permanecem iguais | Corrigido e validado: run 41148841078 verde para a referência do asset; run final 41149559064 também comprova ausência da substituição CSS; marca oficial verificada no DOM, com dimensão visível e content computado normal/none, e confirmada na captura final |
| EM-UI-038 | Captura de feedback de recuperação tinha text-red-300 sobre fundo claro rosado, com leitura fraca | Mesma rotina troca somente as classes dos dois avisos do login para fundo #FEF3F2 e texto #B42318, mantendo mensagens, condições e callbacks (par de cores teórico: 1,75:1 para #FCA5A5 sobre #FEF3F2 antes; 6,05:1 para #B42318 sobre #FEF3F2 depois) | Corrigido e validado em build e captura; não é auditoria WCAG completa |
| EM-QA-039 | O gate anterior só provava renderização inicial e presença de controles | Testes de clique, preservação do valor da senha, transição real de cadastro, marca renderizada e ausência de recursos locais quebrados | Corrigido e validado no escopo público |

**Preservação:** comparação desde `142783bf` até o código testado altera somente dois scripts. Nenhum snapshot protegido, banco, migration, backend, contrato, autenticação, API ou regra financeira alterado. Nenhum APK/AAB, deploy, merge, cobrança ou envio de formulário realizado.

### Limite real para continuar
- A revisão pública automatizada avançou; **não declarar a auditoria funcional integral encerrada nem recomendar a rodada ampla de APKs apenas por esses testes**.
- Não foi identificado nos documentos consultados um ambiente autenticável de homologação com contas por papel. As áreas privadas permanecem sem execução real: home/mapas/pedidos/ganhos/perfil/histórico dos quatro módulos, Estabelecimento e Admins Entregas/Corridas, autorização/RLS e E2E com PIN.
- Para avançar nessa parte, é necessário identificar um ambiente e acessos de teste por papel que possam ser usados sem modificar produção. Não inventar credenciais, simular autorização bem-sucedida como se fosse backend real, nem criar usuários/pedidos em produção.
- Alternativa para auditoria visual isolada: fixtures sintéticas explicitamente identificadas, sem prova de integração real. Elas não substituem homologação autenticada.
- Testes físicos Android, OAuth nativo, GPS/background, push e serviços externos continuarão na fase posterior de APKs autorizados; não afirmar que já passaram.
- Próxima retomada: usar este código e evidências, **não repetir as correções de logo, senha, seletor ou caminhos do Entregador já verificadas**. Resolver a disponibilidade de homologação autenticada, triagem de lint/lockfile e os gates externos documentados.

## RETOMADA — CÓDIGO E CONTAS DO SISTEMA ATUAL — 30/10/2026
- O proprietário confirmou que as contas já existem no sistema atual e determinou continuar pela análise do código. Isso permite continuar inspeção/testes isolados sem exigir outra estrutura ou repetir perguntas sobre ambiente.
- Relatório: `docs/AUDITORIA-CODIGO-ACESSOS-E-FLUXOS-2026-10-30.md`, com mapa dos quatro módulos e três painéis, resolução de identidades e limites da evidência.
- **EM-FUNC-040 corrigido:** realtime podia fazer cleanup do efeito de início de rota antes de a RPC concluir, impedindo a liberação de busy no Entregador. Agora a tentativa atual libera seus controles, e respostas antigas não liberam uma tentativa mais nova. Somente estado local; estágios/PIN/RPC/pagamentos preservados.
- Código `0225ee20302c01d75041f726612c8d390d34d754`; [run 41155555285](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41155555285) **3/3 SUCCESS**, conferidos.
- Reprodução isolada do efeito gerado: script anterior 2 pass/2 fail; corrigido **4 pass/0 fail**. `scripts/test-courier-navigation-busy-v1.mjs` executado também no CI. Cliente/Parceiro mantêm testes públicos e builds existentes; painéis Entregas mantêm builds.
- Nenhuma conta foi acessada/alterada; sem APK, deploy, merge, SQL, migration ou cobrança.
- Continuar pelo código e testes autorizados. Registrar separadamente o que exige sessão real: private UI/E2E/RLS implantada/Maps/avatar/Android. Fonte não comprova existência de usuário individual nem comportamento do banco vivo. Lint/lockfile permanecem pendentes, sem mascarar os avisos.

## CONTINUIDADE — RECUPERAÇÃO DA ENTRADA OFFLINE — 30/10/2026

- **Código validado:** `65878d2b977fc3300faaa0f3a9c40ad268f63251`.
- **Preflight oficial:** [41156377895](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41156377895), completed / SUCCESS nos três jobs, conferidos individualmente.
- **EM-FUNC-041, P1:** se autenticação/carregamento inicial falhasse, o efeito de entrada já estava marcado como iniciado. A tentativa posterior de loadAll() recebia resetOnEntry=false e podia pular a verificação de entrada offline, mesmo sem ter concluído a primeira leitura válida. Também ocorria quando o perfil inicial ainda não estava aprovado e sua primeira operação era carregada depois.
- Correção em `scripts/fix-partner-courier-manual-online-v1.mjs`: ref local `initialEntryResetPendingRef` permanece true até o primeiro loadCourierOperations aprovado/ativo concluir. As retentativas carregam `requireEntryReset`; após sucesso, o ref fica false e refresh normal conserva a escolha manual online/offline.
- A guarda existente `resetOnEntry && !jobsRes.data && effectiveAvailability?.is_online`, a checagem de erros de jobs/disponibilidade e a RPC já existente permanecem iguais. Não altera uma entrega ativa, não introduz nova tabela/endpoint nem novo passo de retirada/PIN.
- **Prova local antes/depois:** cinco cenários; antes **2 PASS / 3 FAIL**, depois **5 PASS / 0 FAIL**. Cenários: falha inicial de auth; falha inicial de operações; refresh após sucesso; perfil inicialmente pendente; falha posterior de refresh sem reinstaurar reset.
- No CI, `scripts/test-courier-entry-retry-v1.mjs` roda **após build:partner**, lendo o loadAll real da árvore .work/partner-entregador já transformada por todo o pipeline. Executa o callback com respostas sintéticas controladas, sem rede; não é teste de conta ou banco vivo. Na reprodução local, os dois trechos do callback vêm das substituições reais do transformador escolhido.
- O primeiro ensaio de fixture crua não continha o hardening de disponibilidade que precede esse script; esse ensaio não foi tratado como reprodução do bug. O teste final usa a árvore integral construída no CI, evitando fixture incompatível.
- **Regressões preservadas:** novo teste 5/5 e teste de concorrência anterior 4/4 passaram; typechecks/bundles e testes públicos de navegador continuaram aprovados. Estabelecimento/Admin Entregas mantiveram os 48 testes e builds.
- **Correção do registro de lint:** log atual = **2.630 problemas: 2.280 erros, 350 avisos**. O run anterior 41155555285 já tinha a mesma contagem; esta correção não aumentou o lint. As seções que citam 2.279 erros descrevem execuções mais antigas. O lint continua FAIL e não foi suprimido.
- Comparação desta etapa: somente script de entrada, novo teste e uma linha no workflow WEB permitido. Sem snapshots protegidos, Supabase remoto, migrations, pagamentos, deploy, merge, APK/AAB ou operações nas contas existentes.

### Próximo estágio: primeira rodada limitada de APKs de teste
Os gates WEB disponíveis estão verdes após as correções bloqueantes reproduzidas. Há base para **uma primeira compilação de APKs de teste destinada a interface, login, sessão e comportamento do aparelho**, usando depois as contas existentes do sistema atual.
Isso é uma decisão de avançar a fase de teste, não uma conclusão de homologação integral. Não é necessário alegar teste físico antes de existir o primeiro APK.

**Nenhum APK foi gerado.** A proibição original continua valendo até instrução específica do usuário para gerar os aplicativos.
Não disparar workflow Android com este handoff sozinho.

Continuam pendentes:
- Fluxos privados reais de pedido/corrida, despacho, aceite, retirada e PIN ponta a ponta; painéis privados por papel, inclusive Admin Corridas.
- GPS/Maps e cobrança/quotas externas, OAuth nativo, push/background/reconexão e teclado/safe-area em aparelho.
- Avatar/Storage e RLS individual; nenhuma policy remota foi aplicada.
- Triagem de lint e reprodutibilidade do lockfile.
- Nenhuma operação financeira, deploy ou liberação de produção está autorizada por esses testes.
