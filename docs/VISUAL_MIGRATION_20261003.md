# Migração visual APOIS — continuidade em 03/10/2026

## Estado e limites

Repositório: `franciel046631/apois-superapp`. Branch: `fix/producao-consolidacao-20260921`.
Base confirmada: `9b7051dbea509ffb6bf43125014e8d9334c8338a`.
Último commit de código desta revisão: `23eb1e040bfed2d6c055e58592dc76437331adfb`.

**Implementação incremental publicada; homologação do ecossistema e auditoria do bundle final ainda pendentes.**
Não interpretar aprovação de auditorias estáticas ou fixtures como aprovação de APK, autenticação real, corrida/entrega real ou operação financeira.

Não houve merge em main, uso de GitHub Actions, mudança de dependências, de pins, de banco, de pagamentos, de Supabase ou de CodeMagic. Os três repositórios protegidos foram mantidos sem escrita. As consultas pontuais aos temas/documentos desses snapshots foram somente leitura nos commits fixados pelo próprio Superapp.

## Arquitetura visual encontrada

| Camada | Fonte existente | Aplicação |
| --- | --- | --- |
| Paleta e semântica | `design-system/apois-brand-v2.json`, `design-system/apois-brand-v2.css` | Já continham exatamente a paleta solicitada no HEAD de entrada; não foram duplicadas/recriadas. |
| Aplicação final | `scripts/apply-apois-brand-v2.mjs` | CSS e assets aplicados às cópias `.work`, mantendo marcadores idempotentes. |
| Passageiro | `src/styles.css` da cópia; Tailwind v4 `@theme` | Manifesto executa hardeners de referência V4 e depois a identidade central. |
| Motorista | `src/apois-motorista-theme.css`, `src/styles.css`, `src/design-system/tokens.ts` do pin | Escopo `html[data-app-role="motorista"]`; classes/props/handlers preservados. |
| Cliente Entregas, Entregador, Estabelecimento | `src/customer-theme.css`, `src/system-theme.css` do pin | Escopos existentes `.apois-customer-theme` e `.apois-system-theme`; sem nova identidade por papel. |
| Admin Corridas | `src/apois-admin-theme.css` do pin | `.apois-admin-theme`; provider/onboarding e contratos mantidos. |
| Shells | `superapp/shell/index.html`, `superapp/partner-shell/index.html` | Os builds já copiam wordmark e mark oficiais para `assets/`. |
| Marca e Android | SVGs V3, `install-superapp-launcher.mjs`, `install-partner-launcher.mjs`, `install-partner-splash.mjs` | Geometria existente e contratos de launcher/splash mantidos. Sem regenerar uma marca diferente. |

Não foi criado um segundo theme/Tailwind config. Os nomes técnicos V2/V3/V4 existentes foram preservados para não romper os audits e hardeners.

## Blocos publicados

| Commit | Arquivos | Resultado |
| --- | --- | --- |
| `4c262c1de8529906f0ddddf40bd342cece7a9072` | `scripts/harden-partner-motorista-brand-theme.mjs`, `scripts/audit-partner-motorista-brand-v4.mjs`, `scripts/tests/partner-brand-theme.test.mjs` | Corrigido literal emitido dark para light no efeito visual preexistente. Regressão reproduzida antes e resolvida depois; trecho de sessão/configuração preservado na fixture. |
| `0c76443e7358a706f64e8b7a381ac361b8c3f478` | `scripts/apply-apois-brand-v2.mjs`, `scripts/audit-apois-brand-v2.mjs`, `scripts/tests/brand-applicator.test.mjs` | Estados primary/hover/pressed/disabled e detalhes de marca Motorista. Sem alterar tamanhos, raio, mapas, autenticação ou callbacks. |
| `9400a06b321ec11c0e346a581a4d1eb41d6b9c4a` | Aplicador, audit e teste acima; `superapp/shell/index.html`, `superapp/partner-shell/index.html`, `superapp/shell/build.mjs` | Favicon com mark oficial, metadata nos documentos conhecidos, fallback de carregamento claro; corrigido fallback vermelho antigo de troca de serviço. |
| `b9b18c523097b64a2e1d8fbba295165f5f4e78ce` | Aplicador e teste acima | Borda antiga com variante focus-within passa a vermelho apenas quando essa condição de foco está ativa. |

A função de bootstrap só trata o loader preexistente `#apois-fallback-loading` e usa tokens existentes com fallback da mesma paleta. Não adiciona outro sistema de tema. Links favicon mantêm o caminho relativo dos documentos móveis e o formato de metadata SSR já normalizado pelos builds existentes.

## Classificação das cores

| Classe | Tratamento |
| --- | --- |
| Identidade e ação | Vermelho `#E51B23`, hover `#C9141B`, pressed existente `#A90F15`, soft `#FFF1F2`. |
| Estrutura e leitura | Branco/cinzas e preto da paleta central. Surface-card e inputs próprios do Motorista recebem tokens claros; sem mudar dimensões. |
| Semântica | Success/online verde, warning amarelo/laranja, info azul e destructive continuam separados. |
| Terceiros | Cores Google e provedores não recebem substituição nova. Seletores novos excluem controles `.gm-style` e switches/checkboxes/radios. |
| Mapas | Estilos, polylines, marcadores operacionais, câmera, GPS, geocoding e Map IDs não foram editados por esta revisão. Referências cartográficas antigas não autorizam uma troca global. |
| Compatibilidade | Nomes gold/green e literais de padrões antigos permanecem onde identificam classes/entradas dos hardeners; não se removem seletores usados pelos gates. |

## Validação executada

| Comando/checagem | Resultado e alcance |
| --- | --- |
| `npm run audit:ui` | PASS. Cadeia existente, incluindo autenticação visual, referência V4, Home compacta, CTA persistente, paleta, shells, launcher/splash e contratos de build. Verifica código/contratos; não executa os fluxos de usuário. |
| `node scripts/audit-partner-motorista-brand-v4.mjs` | PASS, com verificação adicional do literal de tema realmente emitido. |
| `node scripts/audit-partner-reference-ui-v4.mjs` | PASS; contrato do shell e empacotamento dos assets. |
| `node --test scripts/tests/*.test.mjs` | PASS: 13 testes, incluindo os 5 existentes de source preflight e 8 novos de regressão/aplicação. |
| `npm run test:runtime-logging` | PASS. Logs FAIL da fixture insegura são esperados pelo teste negativo; resultado do comando foi zero. |
| `node --check scripts/apply-apois-brand-v2.mjs` e `node --check superapp/shell/build.mjs` | PASS de sintaxe JavaScript. Não equivale a TypeScript/build. |
| `npm run audit:partner` | BLOQUEADO em `preaudit:partner`: três sources ausentes na exportação local. Gate preservado. |
| `npm run build:superapp` | BLOQUEADO no preflight de sources antes de compilar os módulos. Não houve bypass. |
| `npm run test:corridas-oauth` | BLOQUEADO: componente canônico de Google Login em `.work/corridas` não existe sem preparar o source. Não contado como PASS. |
| Lint/TypeScript/tests dos módulos e Gradle/Android | NÃO EXECUTADOS: sources e instalações completos ausentes, Bun indisponível. Não existem scripts genéricos lint/typecheck/test na raiz; os equivalentes pertencem aos módulos. |
| Inspeção em navegador/screenshots | NÃO EXECUTADA: agent-browser/Chromium não estão disponíveis. As fixtures não comprovam o resultado da cascata CSS em navegador. |
| CodeMagic | NÃO EXECUTADO, conforme responsabilidade mantida com o usuário. APK não aprovado. |

As fixtures executam o aplicador real para Corridas, Entregas, Entregador, Motorista, Admin e ambos os shells; comprovam idempotência, preservação byte a byte de exemplos de contratos/hooks, cores semânticas/Google, scripts dos documentos e referência ao mark. Não são testes end-to-end desses módulos.

## Pendências para concluir a migração/homologação

1. Em checkout autenticado completo dos pins já existentes, executar as cadeias atuais de build de Cliente, Parceiro, Admin e Estabelecimento, sem substituir os sources.
2. Rodar lint/typecheck/tests existentes dos módulos e `verify:dist`/gates de release nos artefatos reais; manter Safe2Pay Pix em `0` e financeiro fail-closed.
3. Repetir a varredura no `.work` final e no `dist` gerado, incluindo hex, RGB/RGBA, classes Tailwind e estilos inline. A tabela abaixo é do código versionado do Superapp, não uma prova de ausência de cores antigas em bundle compilado.
4. Conferir em navegador/aparelho: autenticação e-mail/Google, cadastro/logout/senha, mapas/GPS, notificações/realtime, aceitar/rejeitar/iniciar/finalizar, perfil/uploads, menus/modais/bottom sheets e superfícies Admin/Estabelecimento. Sem novos pagamentos reais por esta tarefa.
5. Homologar Android/Capacitor e passar CodeMagic antes de declarar APK aprovado. PNGs/raster legados e o resultado visual de todos os documentos/superfícies ainda exigem conferência no artefato real.

## Inventário inicial de ocorrências (snapshot anterior à continuação)

Busca textual nos arquivos de código de `design-system`, `superapp` e `scripts`, com as famílias hex históricas conhecidas. SVGs oficiais e HTMLs fonte dos shells não contêm os hex históricos desta busca. Os nomes/hex que permanecem não foram apagados indiscriminadamente: abaixo há localização e motivo de cada linha encontrada. Não se presume que todo literal em uma string de hardener seja uma cor visível no produto final.

| Ocorrência | Cores históricas | Motivo / ressalva |
| --- | --- | --- |
| `scripts/apply-apois-brand-v2.mjs:211` | `#F6BE1C` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:233` | `#1F7894`, `#35A9C9`, `#6A1B9A`, `#F6B900`, `#F6BE1C`, `#FACC15`, `#FFD700` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:249` | `#F6BE1C` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:252` | `#F6BE1C` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:255` | `#F6BE1C` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:275` | `#F6BE1C` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:326` | `#FFB800` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:327` | `#FFB800` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:328` | `#FF5C00` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:329` | `#FF5C00` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:330` | `#F5222D` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:331` | `#F5222D` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:332` | `#FF1F2D` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:333` | `#FF1F2D` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:334` | `#9E1018` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:335` | `#9E1018` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:336` | `#D9A520` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:337` | `#D9A520` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:338` | `#F4C44E` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:339` | `#F4C44E` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:340` | `#A97808` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:341` | `#A97808` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:383` | `#F5222D` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:469` | `#8DD92B` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/apply-apois-brand-v2.mjs:470` | `#5FAF1A` | Entrada de conversão ou seletor de compatibilidade. Valores das novas regras vêm dos tokens centrais; classes/identificadores permanecem. |
| `scripts/audit-apois-brand-v2.mjs:85` | `#9E1018`, `#A97808`, `#D9A520`, `#F4C44E`, `#F5222D`, `#FF1F2D` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-apois-reference-ui-v3.mjs:13` | `#A97808`, `#D9A520`, `#F4C44E`, `#F5222D`, `#FF1F2D` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-entregas-brand-sweep-v24.mjs:16` | `#6A1B9A` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-entregas-brand-sweep-v24.mjs:17` | `#1F7894`, `#35A9C9` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-entregas-brand-sweep-v24.mjs:18` | `#C88A08`, `#F6B900`, `#F6BE1C`, `#FACC15`, `#FFD700` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-entregas-brand-sweep-v24.mjs:20` | `#39B54A` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-entregas-brand-sweep-v24.mjs:22` | `#39B54A` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-final-integration-v22.mjs:132` | `#35A9C9` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-partner-superapp.mjs:147` | `#F6BE1C` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-unified-brand-theme-v23.mjs:21` | `#1F7894` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/audit-unified-brand-theme-v23.mjs:22` | `#35A9C9` | Contrato de auditoria: literal procurado/proibido, não uma declaração visual renderizada. |
| `scripts/build-partner-modules.sh:192` | `#F6BE1C` | Pipeline legado preservado. build:partner utiliza build-partner-release.sh; o pipeline oficial não foi trocado nem enfraquecido. |
| `scripts/build-partner-modules.sh:224` | `#F6BE1C` | Pipeline legado preservado. build:partner utiliza build-partner-release.sh; o pipeline oficial não foi trocado nem enfraquecido. |
| `scripts/build-partner-modules.sh:308` | `#F6BE1C` | Pipeline legado preservado. build:partner utiliza build-partner-release.sh; o pipeline oficial não foi trocado nem enfraquecido. |
| `scripts/harden-corridas-home-compact.mjs:27` | `#F5222D` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-home-compact.mjs:28` | `#D9A520` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-home-compact.mjs:30` | `#F5222D` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-home-compact.mjs:33` | `#F5222D` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-home-compact.mjs:35` | `#D9A520` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-home-compact.mjs:36` | `#D9A520` | CSS intermediário/fallback anterior ao aplicador Corridas. A conversão final é feita na cópia .work; comprovação no dist permanece pendente. |
| `scripts/harden-corridas-passenger-map-branding.mjs:28` | `#FFB800` | Cor procurada pelo hardener de mapa preexistente; a substituição já existente é vermelho APOIS. O hardener não foi editado. |
| `scripts/harden-corridas-superapp-runtime.mjs:223` | `#F6BE1C` | Cor de polyline no hardener preexistente. Preservada pela restrição explícita de não alterar polylines/mapas nesta tarefa; não recolorida automaticamente. |
| `scripts/harden-entregas-brand-sweep.mjs:12` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:13` | `#1F7894`, `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:14` | `#C88A08`, `#F6B900`, `#F6BE1C`, `#FACC15`, `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:56` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:57` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:69` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:70` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:71` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:72` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:73` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:74` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:75` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:76` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:77` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:78` | `#C88A08` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-brand-sweep.mjs:106` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-merchant-order-controls.mjs:22` | `#F6BE1C` | Classe intermediária de identidade no CTA do estabelecimento. A varredura Entregas e o aplicador central ocorrem antes de compilar; validar o dist real. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:57` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:58` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:59` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:60` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:61` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:62` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:63` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:64` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:65` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:66` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:67` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:68` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:69` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:70` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:71` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:72` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:73` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:74` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:75` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:76` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:77` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:106` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:107` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:108` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:109` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:110` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:111` | `#C88A08` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:162` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:163` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:164` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:165` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:166` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:167` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:168` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:169` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:170` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:171` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:172` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:173` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:174` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:175` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:197` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-entregas-superapp-brand-theme.mjs:198` | `#39B54A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-motorista-direct-mercadopago.mjs:38` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-motorista-field-mercadopago.mjs:73` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-motorista-field-mercadopago.mjs:74` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-motorista-field-runtime.mjs:100` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-field-runtime.mjs:116` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:135` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:138` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:141` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:155` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:160` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:166` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:183` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:184` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:187` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:194` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-finance-boundary.mjs:195` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-payment-wait.mjs:42` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-ride-flow-ui.mjs:109` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-route-integrity.mjs:15` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-motorista-superapp-mercadopago.mjs:163` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-motorista-superapp-mercadopago.mjs:167` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-motorista-superapp-mercadopago.mjs:192` | `#F6BE1C` | Compatibilidade de hardener legado/provider aposentado, mantida sem alteração de integração. Gate de provider/release permanece responsável por excluir runtime legado. |
| `scripts/harden-partner-entregador-map.mjs:41` | `#39B54A`, `#6A1B9A` | Padrões antigos de constantes cartográficas usados pelo hardener já existente. Nenhuma lógica/mapa desse arquivo foi editada. |
| `scripts/harden-partner-entregador-map.mjs:43` | `#39B54A` | Padrões antigos de constantes cartográficas usados pelo hardener já existente. Nenhuma lógica/mapa desse arquivo foi editada. |
| `scripts/harden-partner-entregador-map.mjs:44` | `#C88A08` | Padrões antigos de constantes cartográficas usados pelo hardener já existente. Nenhuma lógica/mapa desse arquivo foi editada. |
| `scripts/harden-partner-entregador-theme.mjs:53` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:54` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:55` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:56` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:57` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:58` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:59` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:60` | `#6A1B9A` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:61` | `#1F7894` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:62` | `#35A9C9` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:63` | `#FFD700` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:64` | `#F6B900` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:65` | `#FACC15` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-entregador-theme.mjs:66` | `#F6BE1C` | Padrão de entrada ou seletor antigo preservado para converter/cobrir o pin protegido; a camada final central é aplicada no build. |
| `scripts/harden-partner-motorista-direct-earnings.mjs:32` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-direct-earnings.mjs:111` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-onboarding.mjs:28` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-onboarding.mjs:29` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-profile-switch.mjs:30` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-profile-switch.mjs:31` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/harden-partner-motorista-settings-cleanup.mjs:36` | `#F6BE1C` | Classe intermediária dos hardeners Motorista. Mantida para os contratos exatos existentes; a camada CSS final converte detalhes da marca sem modificar handlers. Validar o dist real. |
| `scripts/tests/brand-applicator.test.mjs:75` | `#F6BE1C` | Entrada de regressão para confirmar que uma classe antiga recebe a identidade atual. |
| `scripts/tests/brand-applicator.test.mjs:76` | `#F6BE1C` | Entrada de regressão para confirmar que uma classe antiga recebe a identidade atual. |
| `scripts/tests/brand-applicator.test.mjs:77` | `#F6BE1C` | Entrada de regressão para confirmar que uma classe antiga recebe a identidade atual. |


## Continuação — revisão de cascata e detalhes visuais

| Commit | Arquivo | Alteração |
| --- | --- | --- |
| `ce84e02f95eed96819cd1f7f95ae132e476bf049` | Aplicador central e teste de aplicação | Avatar Passageiro: borda/halo da marca e sombra discreta; fixture inclui a declaração antiga e verifica a ordem da sobreposição. |
| `3257637560c2e086652aef51668d8c6624154d36` | `scripts/apply-apois-brand-v2.mjs` | Motorista: foco após a regra de input claro, sombras de navegação/PIN, loader de ganhos e card de recebimento direto. Shells: sombra preta suave nos CTAs. |
| `23eb1e040bfed2d6c055e58592dc76437331adfb` | `scripts/apply-apois-brand-v2.mjs` | Entregas: fundo raiz, cards próprios, brilhos, rings de branding e gradiente de três etapas. Regras específicas antigas do pin agora têm sobreposição correspondente. |

Os temas `src/system-theme.css`, `src/customer-theme.css`, `src/apois-motorista-theme.css` e `src/apois-admin-theme.css` foram consultados somente nos pins protegidos registrados acima. Nenhuma escrita foi feita nesses repositórios. O tema Admin usa tokens na seleção/foco; não foi necessário alterar seu layout. Os tokens `--chart-*` de Entregas permanecem para preservar distinção entre séries.

Validação da continuação: `audit:ui` passou; a suíte de 13 testes passou após o bloco Motorista; os 7 testes do aplicador passaram novamente após o bloco Entregas. Auditorias Motorista V4 e Partner Reference V4 passaram. O preflight foi reexecutado e continua falhando por ausência dos três diretórios `sources`; builds reais, lint/TypeScript dos módulos, navegador, `verify:dist`, Android e fluxos reais continuam pendentes. Não há conclusão global nem aprovação de APK.

### Busca final ampliada no Superapp

Inclui hex históricos e RGB/RGBA dourado/verde de marca; não representa busca em módulos completos ou bundles. As ocorrências anteriores continuam classificadas na tabela de snapshot. As linhas atuais, inclusive seletores adicionados, estão abaixo. Os novos seletores mantêm o literal antigo para reconhecer a classe existente e emitem tokens novos; não são valores da nova paleta. Fixtures mantêm exemplos antigos para reproduzir a migração. Hardeners antigos ainda contêm estilos intermediários: somente o build completo permite provar quais sobrevivem na cascata final. Não foram declarados todos resolvidos.

| Arquivo | Linhas atuais |
| --- | --- |
| `scripts/add-motorista-superapp-shell.mjs` | 15 |
| `scripts/apply-apois-brand-v2.mjs` | 211, 233, 249, 252, 255, 267, 268, 269, 273, 286, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 399, 446, 447, 448, 508, 509 |
| `scripts/audit-apois-brand-v2.mjs` | 85 |
| `scripts/audit-apois-reference-ui-v3.mjs` | 13 |
| `scripts/audit-entregas-brand-sweep-v24.mjs` | 16, 17, 18 |
| `scripts/audit-final-integration-v22.mjs` | 132 |
| `scripts/audit-partner-superapp.mjs` | 147 |
| `scripts/audit-unified-brand-theme-v23.mjs` | 21, 22 |
| `scripts/build-partner-modules.sh` | 192, 224, 308 |
| `scripts/harden-corridas-home-compact.mjs` | 27, 28, 30, 33, 35, 36 |
| `scripts/harden-corridas-passenger-map-branding.mjs` | 28 |
| `scripts/harden-corridas-superapp-runtime.mjs` | 223 |
| `scripts/harden-entregas-brand-sweep.mjs` | 12, 13, 14, 51, 71, 72, 73, 74, 75, 76, 77, 98 |
| `scripts/harden-entregas-merchant-direct-finance.mjs` | 46 |
| `scripts/harden-entregas-merchant-order-controls.mjs` | 22 |
| `scripts/harden-entregas-superapp-brand-theme.mjs` | 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 106, 107, 109, 110, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 197, 210 |
| `scripts/harden-motorista-direct-mercadopago.mjs` | 38 |
| `scripts/harden-motorista-field-mercadopago.mjs` | 73, 74 |
| `scripts/harden-motorista-field-runtime.mjs` | 100, 116 |
| `scripts/harden-motorista-finance-boundary.mjs` | 135, 136, 138, 141, 155, 160, 166, 183, 184, 187, 194, 195 |
| `scripts/harden-motorista-payment-wait.mjs` | 42 |
| `scripts/harden-motorista-ride-flow-ui.mjs` | 109 |
| `scripts/harden-motorista-route-integrity.mjs` | 15 |
| `scripts/harden-motorista-superapp-mercadopago.mjs` | 163, 167, 192 |
| `scripts/harden-partner-entregador-map.mjs` | 41 |
| `scripts/harden-partner-entregador-theme.mjs` | 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66 |
| `scripts/harden-partner-motorista-direct-earnings.mjs` | 32, 111 |
| `scripts/harden-partner-motorista-onboarding.mjs` | 28, 29 |
| `scripts/harden-partner-motorista-pin-ui.mjs` | 63 |
| `scripts/harden-partner-motorista-profile-switch.mjs` | 30, 31 |
| `scripts/harden-partner-motorista-settings-cleanup.mjs` | 36 |
| `scripts/normalize-partner-entregador-route-map-touch.mjs` | 13 |
| `scripts/tests/brand-applicator.test.mjs` | 40, 75, 81, 82, 83 |
