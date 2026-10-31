# APOIS — Revisão visual e funcional estática de homologação — 30/10/2026

## Escopo e limites de evidência
Arquitetura: 2 APKs (Cliente e Parceiro), quatro módulos (Cliente Corridas, Cliente Entregas, Motorista, Entregador), painéis Estabelecimento Entregas, Admin Entregas e Admin Corridas.

Fontes: inspeção do código nos snapshots fixados pelo `.apois/source-lock.json`, scripts de consolidação na branch `fix/entregas-homologacao-ajustes-20261030`, logs reais do GitHub Actions e capturas Android apresentadas pelo proprietário em 30/10. **Nenhuma captura nova foi obtida da versão final deste commit.** Portanto os itens de aparência são auditoria estática ou problemas históricos pendentes de nova captura, não homologação visual renderizada.

## Matriz histórica por superfície

**Atenção:** os estados de CI na tabela abaixo são históricos. O resultado atual e as ressalvas constam na seção de retomada verificada ao final; não usar esta tabela para inferir falha atual ou homologação completa.

| Superfície | Build WEB | Evidência e visual | Risco/pendência |
| --- | --- | --- | --- |
| Cliente Corridas | Aprovado na execução 41140015095 | Estilo de mapa do Passageiro como referência; versão de GPS/cidade correta foi preparada | Testar localização real fora de Petrolina, câmera, destino, ETA, erro de permissão |
| Cliente Entregas | Aprovado na execução 41140015095 | Checkout e pedidos preservados; ajustes de atualização do status do pedido foram versionados | Revalidar status final após PIN com Cliente aberto/segundo plano; mapas Google indisponíveis enquanto pendência de cobrança |
| Parceiro Motorista | Módulo WEB compilou no preflight 41140015095, aprovação global ainda bloqueada por auditoria final | Script usa paleta clara no Google Maps, preserva rotas, GPS e voz; cadastro/perfil com contraste atualizado | Precisão GPS, mapa rural, toque de nova corrida, navegação, assinatura e fluxo de PIN exigem teste físico |
| Parceiro Entregador | Módulo WEB compilou no preflight 41140015095, aprovação global ainda bloqueada por auditoria final | `ActiveDelivery` simplificado: aceite, retirada, rota/cliente e PIN; perfil branco com edição; mapa compacto; trocas de papel preservadas | Confirmar telas renderizadas, área segura Android, estados offline/reconexão, upload de avatar (policy não aplicada), ETA |
| Estabelecimento | Aprovado na execução 41140015095 | Controle de pedidos branco/vermelho atualizado com safe-area; ação de solicitar entregador preservada | Validação visual no celular, teclado, cards abertos e sobreposições |
| Admin Entregas | Empacotado no WEB de Estabelecimento; sem teste manual de login/roles | `WorkspaceShell.tsx` de origem ainda apresenta `bg-black/bg-zinc-950` e seleção antiga `bg-primary text-black` | Revisar visual por componente com captura desktop/móvel antes de mudar tema global |
| Admin Corridas | Faz parte da fonte Motorista/Admin, com rotas existentes | Dashboard e Mapa ao Vivo exibem APOIS em títulos; código ainda tem nomes internos MOVVI | Inspeção visual real da sidebar, mapa, filtros, tabelas, RBAC e erros |

## Critérios não comprovados
1. Capturas renderizadas recentes de login, home, mapa, pedidos, histórico, perfil, erro/empty/loading para as quatro áreas.
2. Responsividade e safe-area em Android reais com teclado aberto e gestos.
3. Pedido teste integral pós-patch: Cliente → Estabelecimento → Entregador → retirada → PIN → pedido entregue no Cliente.
4. Reabertura de app, localização background, push, suspensão e reconexão; dependem de Android real e API Maps.
5. Avatar, RLS e Storage individuais: policy versionada **não executada** em produção.
6. Cobranças/finanças: nenhuma operação real autorizada; não inferir ganho do entregador com base em pedido fictício R$ 0,00.

## Regras de preservação
- Não mexer em APIs, pagamentos, Safe2Pay, Supabase, banco, autenticação, regras de cobertura, emissão de PIN ou corridas.
- No Entregador, os estados intermediários obrigatórios continuam no backend; simplificação é apenas de ações visíveis.
- Nunca mascarar erro de CI ou substituir verificação por skip. A última falha de auditoria antes do commit `821419b570a7` foi teste de estilo de mapa desatualizado; ajustado para exigir exatamente o estilo claro atual.
- Novo teste WEB em execução: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41140195643 . **Não marcar aprovado até conclusão**.

## Correção incremental do WorkspaceShell — retomada 30/10/2026
- Script versionado: `scripts/fix-entregas-workspace-shell-light-v1.mjs`; acoplado a `scripts/build-merchant-panel.mjs` **após** as demais transformações existentes, sem alterar as fontes protegidas.
- Cabeçalho e navegação desktop/mobile agora usam fundo claro, texto escuro e seleção vermelho APOIS. Cartões de métricas/estado vazio também usam fundo claro e texto escuro. Acessibilidade: botões abrir/fechar menu com rótulos.
- Importante: **área operacional de conteúdo ainda usa base escura `#101114` e texto branco intencionalmente**, porque as páginas Admin Entregas existentes contêm `bg-black/bg-zinc-950` que dependem de texto herdado branco. Tornar toda a raiz clara antes de converter esses filhos criaria texto escuro em cartões escuros. Não apresentar isso como migração visual global concluída.
- Fluxos `merchant_new_order_alert`, `playMerchantOrderAlert`, `onTabChange`, saída, abas, realtime e pagamentos foram preservados pela transformação, com marcadores/asserções no script.
- GitHub Actions WEB **41140864156**, commit `44d2405b65db973a847192121ef3ce82999c5ac0`: **SUCCESS em audit-web-only, WEB-only cliente e WEB-only estabelecimento**; não houve APK, deploy, merge nem SQL de produção. https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41140864156
- **Continua pendente** teste visual renderizado de páginas reais (por papéis e estados) e homologação Android com GPS/Maps após liberação externa da plataforma. Não inferir screenshots de builds verdes.

## Cobertura adicional — QA visual Admin Entregas (30/10/2026)
| Item | Antes (fonte protegida) | Depois (workspace de QA) | Evidência | Situação |
| --- | --- | --- | --- | --- |
| Prontidão operacional `AdminCourierOperationalGates` | Cartão preto, aviso âmbar claro sobre preto | Cartão branco, texto escuro e avisos âmbar com texto `#7A4B00`, refresh com foco | Script `fix-entregas-admin-readiness-light-v1.mjs`; aplicação isolada repetível e WEB 41141538529 verde | Corrigido e validado em build, visual real pendente |
| Cobertura `AdminCoveragePanel` | Labels de 10px e `text-zinc-600` sobre fundo escuro | Labels de 12px e `#CBD5E1` | Script `fix-entregas-admin-coverage-contrast-v1.mjs`; razão de contraste calculada aproximada 2,57:1 → 13,40:1 sobre `#09090B` | Corrigido e validado em build, visual real pendente |
| Build isolado Admin Entregas | Admin dependia de typecheck geral, build merchant não compilava suas rotas separadamente | `bun run build:admin` executado após build merchant no CI, sem deploy | GitHub run 41141759094, 3 jobs SUCCESS; mensagem explícita no log | Validação técnica WEB concluída, não E2E |

## Admin Pedidos e Operações em tempo real — correções pontuais de legibilidade (30/10/2026)

| Superfície | Achado do código de origem | Tratamento apenas visual | Teste |
| --- | --- | --- | --- |
| `AdminOrdersPanel` | Identificador do pedido em 9 px com `text-zinc-700`, metadados e rótulos financeiros de 10 px com `text-zinc-600`, linha do tempo pouco legível | `fix-entregas-admin-orders-contrast-v1.mjs`: rótulos de 12 px, IDs 12 px, datas 11 px, tom `#CBD5E1` sobre cartões escuros | Execução **41142222435**: 3/3 WEB SUCCESS |
| `AdminRealtimeOperationsPanel` | Cabeçalho de tabela e indicadores de posição de entregadores em 10 px, data em cinza excessivamente escuro | `fix-entregas-admin-realtime-legibility-v1.mjs`: cabeçalho e indicadores 12 px, data 12 px, alto contraste em fundo escuro | Execução **41142358832**: 3/3 WEB SUCCESS; log confirma execução de ambos os scripts e `build:admin` separado |

- Ambos os scripts foram exercitados em simulação sem alteração das fontes fixadas, cada um com primeira transformação e segunda execução idempotente (zero escritas extras).
- Os invariantes estáticos incluem filtros, consultas e totais financeiros do painel Pedidos, além das fontes `delivery_jobs`, `courier_availability`, `courier_locations`, `GoogleMap` e atualização manual de operações em tempo real. Não são testes E2E com pedidos reais.
- Razões de contraste *teóricas* calculadas a partir dos pares de cores do código (não medição de pixels renderizados): `#CBD5E1` sobre `#09090B` **13,40:1**; `#475467` sobre branco **7,69:1**; `#7A4B00` sobre `#FFFAEB` **7,10:1**; branco sobre `#E90024` **4,68:1**. Todos superam WCAG AA 4,5:1 para texto normal, se a combinação final renderizada for realmente essa.
- **Escopo:** branch de homologação, somente scripts de transformação e `build-merchant-panel.mjs`. Sem APK, deploy, merge, alteração de banco ou API paga. Ainda pendentes capturas renderizadas com autenticação real e testes físicos Android/GPS/Maps.

## Revisão incremental — Admin Avaliações / Repasses / Suporte — 30/10/2026

| Tela | Problema comprovado no snapshot | Patch visual isolado | Verificação |
| --- | --- | --- | --- |
| Admin Avaliações | Rótulos de nota/nome com 10px; cinza `zinc-600/700` em fundo escuro | `fix-entregas-admin-reviews-contrast-v1.mjs`, textos 12px e `#CBD5E1`; filtros/notas/comentários preservados | Preflight 41144368108, 3/3 SUCCESS |
| Admin Repasses | Tabela com estado/vencimento/disputa em 10px e baixo contraste | `fix-entregas-admin-settlements-contrast-v1.mjs`, textos 12px e `#CBD5E1`; total/prova/resolveDispute preservados | Preflight 41144551669, 3/3 SUCCESS |
| Admin Suporte | IDs, horários, prioridades e mensagens em 9–10px e `zinc-600/700` | `fix-entregas-admin-support-contrast-v1.mjs`, textos 11–12px e `#CBD5E1`; assinatura de anexo/replies/estados preservados | Preflight 41144738866, 3/3 SUCCESS |

Todas as provas de aprovação são de scripts de transformação e build WEB, **não de screenshots renderizadas**. Essas melhorias são locais: o resto do conteúdo do Admin pode manter cartões escuros enquanto a migração visual ocorrer gradualmente. Não foram alterados os repositórios de origem, regras financeiras, Auth, mapas, APIs ou produção.


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
