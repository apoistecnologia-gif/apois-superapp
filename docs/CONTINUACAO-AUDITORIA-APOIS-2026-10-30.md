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
