# APOIS Corridas — recuperação do Admin original (31/10/2026)

## Escopo e fonte de verdade
- Alterações **apenas** na branch de homologação `fix/entregas-homologacao-ajustes-20261030` do `apoistecnologia-gif/apois-superapp`.
- Snapshot protegido Motorista/Admin: `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f` — intacto.
- Referência visual comprovada: deployment do projeto original Vercel `apois-corridas-admin`, commit `2280c0979a7d047334916768faf519993bcb1e92`.
- Projeto QA: `prj_aiE8SAZZsN0qflEmMAw9qrcirQNx`, distinto do domínio oficial.
- Banco Corridas `tbbzkrfupmqdywnzgnms`: **nenhuma alteração nesta recuperação**. Migração Stage 2 não executada. APOIS Entregas, APK/AAB e merge: intactos.

## Diagnóstico das regressões
| Falha | Evidência | Correção aplicada |
| --- | --- | --- |
| Publicação Vercel QA apresentava a interface do Motorista em vez do Admin | Deployment QA anterior no commit `0bdebf5` e captura em `/motorista/app` | Commit já existente `416039d` passou a compilar árvore `admin.*` exclusiva |
| Navegação direta em `/admin/login` não carregava assets | HTML tinha `<base href="./">`; `/admin/assets/*.js` devolvia `text/html` | `cc7963c` e `287453f`: base e arquivos JS/CSS absolutos, com gate de build |
| O bundle SPA herdava URL antiga de funções de servidor | `vite.mobile.config.ts` da fonte fixada apontava para `movvi-go-connect.lovable.app/_serverFn/` | `cc7963c`: endpoint da prévia isolado na própria origem. **Isso NÃO fornece servidor de funções; o preview permanece limitado a auditoria visual até configuração SSR segura.** |
| O pin mais antigo continha tema amarelo e símbolo SVG diferente | `src/apois-admin-theme.css` e `AdminSidebar.tsx` no SHA pinado | `44d5991`, `57a409d`, `91214f7`: copiar exclusivamente os cinco arquivos visuais comprovados do commit do projeto original para a workspace temporária. Identidade oficial `#E51B23`, logo circular APOIS e sidebar profissional |
| TanStack Start antigo vulnerável | Deployment anterior bloqueado pela Vercel com `CVE-2026-102989` | Hardener já existente fixa `@tanstack/react-start=1.168.60`, `@tanstack/start-server-core=1.169.39` no build temporário, sem bypass |

## Arquivos visuais preservados do projeto original
Snapshot de referência versionado em `admin-preview/original-admin-visual-snapshot.json`, commit-fonte `2280c097...`:
1. `src/apois-admin-theme.css`
2. `src/components/admin/AdminSidebar.tsx`
3. `src/assets/apoisOfficial2026.ts`
4. `src/lib/adminVisual.ts`
5. `src/routes/admin.dashboard.tsx` — adaptação pontual do `MovviMap` à API da versão pinada, sem trocar a lógica do dashboard.

Aplicação em `scripts/build-corridas-admin-spa-v1.mjs`. As rotas, autenticação, revisão de motoristas, dados de passageiros, funções e regras de negócio não foram substituídos por este snapshot.

## Provas de publicação
- Deployment `dpl_DiRwx646Ab2PbpFzWfJPSgjEH1F4` no commit `91214f768cbf0cb61bfdc33062a601c010a9e032`: **READY** na Vercel QA.
- GET `/admin/login`: HTTP 200, `<base href="/">`.
- JS `/assets/index.admin-preview-DBbQDl6T.js`: HTTP 200, `application/javascript`, contém logomarca oficial e marcador `Pendenciar cadastro`; não contém marcador da voz de oferta Motorista nem URL de server functions Lovable antiga.
- CSS `/assets/index-CFHG-9kv.css`: HTTP 200, `text/css`, contém vermelho oficial `#E51B23`.
- Estes são testes reais de **entrega HTTP e conteúdo de bundle**, não provas de tela renderizada, autenticação ou execução E2E.

## Escopo funcional ainda não homologado
- A prévia é uma **SPA estática**, sem Nitro/TanStack Start server functions servidas pela Vercel. Fluxos como assinaturas de URLs privadas e ações server-side de documentos **não devem ser declarados funcionais**.
- A árvore compilada inclui 23 rotas administrativas, mas o `AdminSidebar` original oferece 12 entradas auditadas (filtradas por RBAC). Rotas como Analytics, Assinaturas, Pagamentos, Mapa, Notificações, Relatórios, Backups e Configurações existem na fonte, mas precisam de revisão antes de exposição no menu; não ativar funções legadas indiscriminadamente.
- Homologação visual autenticada de Dashboard, Motoristas, vistorias de 13 fotos, pendências, ocorrências e documentos ainda pendente.
- Nenhum e-mail real, pagamento, upload, aprovação de motorista ou alteração de cadastro foi disparado.
- A Stage 2 permanece retida até atualização e teste de interfaces.

## Gate de saída obrigatório
Somente aprovar a publicação oficial após: preview isolada com backend compatível e protegido, teste autenticado RBAC, fotos e documentos com URLs assinadas, pendenciar e reanalisar, Central de Ocorrências, dashboard e mapa, verificação de contraste e responsividade em navegador real, testes regressivos e aprovação explícita do proprietário. Não confundir Vercel READY com homologação funcional.
