# Correção da home do Entregador — 30/10/2026
## 1. Diagnóstico
Evidência: captura Android enviada pelo proprietário após instalar o APK Parceiro 1.0.20, run 41158242762. Logo amarela, controle de recentralizar escuro e ausência de disponibilidade offline. A revisão pública anterior não cobria a home autenticada; sua aprovação não deveria ser usada como evidência dessa tela.
Base: apois-superapp, branch fix/entregas-homologacao-ajustes-20261030, HEAD inicial 313fd8d0942e815f98b058dcc5ab948a9d4914ae. Pin Entregas 2f4606e0fb52dffb49f2e6aebbe921ce687ab625 preservado.
Arquivos lidos: CourierPremiumViews.tsx, CourierPanels.tsx, CourierRouteMap.tsx, courier.tsx na fonte protegida somente leitura; transformadores de tema/auth/home/disponibilidade, build-partner-release.sh e workflow preflight. Bundle e CSS do APK anterior inspecionados. Não é inventário integral do app.
## 2. Preservar
Handlers toggleOnline, onToggle, panTo/setZoom, guards de entrega ativa/conclusão, GPS, auth, disponibilidade manual, RPC, PIN, finanças, navegação e quatro abas existentes. Sem novos passos na jornada.
## 3. Achados
| ID | Prioridade | Evidência | Correção | Estado |
| --- | --- | --- | --- | --- |
| EM-FUNC-042 / VIS-042 | P1 | Condição online && !activeJob && !completedJob oculta o único controle quando offline; card offline já foi substituído pelo mapa pelo compact-home | Exibir o card quando !activeJob && !completedJob, conservando callbacks e gates operacionais | WEB/componentes validado |
| VIS-043 | P1 | Home já usava PNG oficial, mas alt APOIS ENTREGA acionava content:url do SVG legado; captura real mostra amarelo | alt APOIS nos logos oficiais das superfícies courier; incorporar módulo oficial onde ainda usado asset legado | DOM e captura de fixture validados |
| VIS-044 | P1 | RecenterControl bg-black/90 text-white competia com override global text-white -> preto; ícone pouco legível na captura | Somente esse botão: fundo branco, texto #111827, borda #D0D5DD, foco visível | Cor computada e callback validados |
| VIS-045 | P2 | Cartão e switch herdavam gradientes e contraste conflitantes | Hooks e CSS locais: cartão branco sem imagem de fundo, faixa/ícone legíveis, foco; busy preservado | Capturas offline/online e bloqueio busy validados |
## 4. Mapa de alterações
Novo scripts/fix-partner-courier-home-regression-v1.mjs aplica mudanças exclusivamente em .work/partner-entregador/src/routes/courier.tsx, components/CourierPremiumViews.tsx, components/CourierPanels.tsx, components/CourierRouteMap.tsx e system-theme.css. Integrado ao final dos patches courier em scripts/build-partner-release.sh.
Novo scripts/test-courier-home-render-v1.mjs integrado ao workflow WEB existente após testes públicos. Nenhum arquivo sources/ foi alterado.
## 5. Direção visual
Conservar marca oficial vermelho/branco/preto, logo versionada, tipografia e layout existentes. Não redesenhar mapa nem adicionar painéis opcionais. Não foi feita substituição global de cores.
## 6. Prioridades e dependências
Restaurar controle offline é requisito funcional anterior ao novo APK. Marca/contraste são correções locais relacionadas à mesma captura. A revisão de todas as telas privadas continua pendente.
## 7. Validação e limites
Código final WEB 3cafe075cc6ebf7bbfe9754adfcac740514af60d; run 41161692852 completed/success nos três jobs, conferidos individualmente.
Teste lê fragmentos JSX reais da árvore integral transformada (header, CourierStatusCard e RecenterControl), compila com Bun e renderiza com o CSS final em Chromium, a 360/390/1280 x 800. Props e callback de mapa são sintéticos; todas as requisições externas bloqueadas. Não simula autenticação bem-sucedida nem comprova banco/Maps/Android.
Três larguras passaram: OFFLINE visível/clicável -> ONLINE -> OFFLINE; busy desabilitado; PNG oficial sem substituição por CSS; recentralização com cor computada #111827 e callback preservado; sem overflow ou pageerror. Capturas offline/online 360 inspecionadas. Matriz booleana confirma ocultação com activeJob/completedJob.
Reprodução isolada: condição antiga retorna false no estado offline; nova retorna true. Aplicação repetida do transformador final preserva hashes da fixture.
Runs 41161188377, 41161319228 e 41161522927 falharam e NÃO são aprovações: seleção inicial de header no teste, alt legado já incorporado e fallback de idempotência que pulava uma substituição necessária. Correções de teste/transformador mantiveram as asserções.
Artefato navegador 13026914667, retenção sete dias. Não salvar screenshots com dados pessoais em artefatos públicos. Screenshots desta fixture são sintéticos, não E2E da home autenticada completa.
Lint/lockfile herdados continuam pendentes conforme continuidade. Nenhum teste foi suprimido. Sem deploy, merge, migration remota, cobrança ou mudança de backend.
## 8. Handoff
HANDOFF_VISUAL_MASTER
Projeto: APOIS Parceiro / Entregador
Fonte_base: branch homologação; código WEB validado 3cafe075cc6ebf7bbfe9754adfcac740514af60d
Escopo_aprovado: EM-FUNC-042, VIS-043, VIS-044, VIS-045
Restricoes: preservar handlers, APIs, auth, GPS, estados, PIN e financeiro
Estado: implementado; WEB/componentes validado; físico pendente
Proxima_acao: conferir APK corrigido no aparelho e auditar telas privadas restantes, sem repetir patches já concluídos
Fim HANDOFF_VISUAL_MASTER
## 9. Prompt visual de continuidade
Continuar a correção APOIS na branch fix/entregas-homologacao-ajustes-20261030. Ler continuidade e matriz; confirmar HEAD e Actions. Não refazer EM-FUNC-042/VIS-043–045 sem evidência de regressão. Conferir a home do APK Parceiro 1.0.21 em Android: logo oficial, controle offline acessível, ativação/desativação manual, mapa/recentralização e abas. Separar teste de componente sintético de sessão autenticada real. Preservar jornada aceitar/retirar/PIN e contratos. Não alterar produção, pagamentos ou fontes protegidas. Registrar falhas reais e atualizar documentação; não assumir homologação integral a partir de build verde.

## REGRESSÃO REPORTADA NO APK ENTREGADOR — CORRIGIDA EM 1.0.21 — 30/10/2026
A captura Android do proprietário comprovou falha não coberta pelos testes públicos anteriores: a home offline não mostrava o controle de disponibilidade, exibia logo antiga por substituição CSS e tinha recentralização pouco legível. **APOIS Parceiro 1.0.20 entregue anteriormente está superado por esta correção; não usar seu build aprovado como evidência de home correta.**
- Diagnóstico e nove blocos de handoff: `docs/AUDITORIA-REGRESSAO-HOME-ENTREGADOR-2026-10-30.md`.
- Código WEB validado `3cafe075cc6ebf7bbfe9754adfcac740514af60d`; [preflight 41161692852](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41161692852) **completed/success, três jobs conferidos**.
- Novo transformador `scripts/fix-partner-courier-home-regression-v1.mjs`: status visível offline/online sem job ativo/conclusão; marca oficial com alt que não dispara SVG antigo; recentralização e switch com estilos locais. Handlers, GPS, APIs, RPCs, PIN, financeiro e navegação preservados.
- Novo `scripts/test-courier-home-render-v1.mjs`: fragmentos JSX reais da árvore final + CSS de produção, props sintéticas, callbacks locais, Chromium 360/390/1280. Passaram os estados offline/online/busy, transições locais do switch, logo computada, recentralizar e guards active/completed. Capturas offline/online 360 inspecionadas. **Não é E2E autenticado nem mapa Google real.**
- Novo APK Parceiro **1.0.21 / versionCode 22**, pacote `br.com.apois.parceiro`: [Android 41161882055](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41161882055), **completed/success**, job `124421002011`, fonte `7d97ebcb8b45a7288356cf716bdadedc1a2d96b9`. Além da correção WEB, esse SHA altera somente versão no workflow Android existente.
- Artefato `13027572198`; APK entregue como `APOIS-Parceiro-TESTE-1.0.21.apk`, **7.471.744 bytes**, SHA256 `35da9a8038410d299f4fc925a297e6fb7cdd2d6922df25545f0c01a495691dd9`. ZIP de transporte SHA256 `5465f06481acf540214c502b1133c273f0db44ad461fbf7ff4256645b5fcc59c` conferido; CRC ZIP/APK, pacote/versão do manifest binário e marcadores reais de logo/controles do bundle conferidos.
- APK Cliente 1.0.11-qa.64 não foi alterado nesta correção. Novo teste não foi empacotado como rota do aplicativo.
- Instalação/atualização e home completa com conta real no Android permanecem por conferir. Assinatura debug Parceiro é a do runner; não foi demonstrada compatibilidade de atualização com APK anterior. Não instruir limpeza de dados/desinstalação automaticamente.
- Lint e lockfile herdados continuam pendentes. Sem fontes protegidas, deploy, merge, AAB, alteração de Supabase/produção, migrations ou pagamentos. Não declarar homologação final.
