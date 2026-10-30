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
