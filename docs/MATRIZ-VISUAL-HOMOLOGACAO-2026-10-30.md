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


## APKs DE TESTE AUTORIZADOS — 31/10/2026 UTC (30/10 no Brasil)

O proprietário autorizou expressamente gerar os APKs e disponibilizar download na conversa. A restrição anterior de não gerar APK foi substituída somente para esta rodada de testes. Deploy, publicação em lojas, AAB, produção, migrations, cobranças e merge continuam fora do escopo.

- HEAD usado na compilação: `3aa60d1e385384270d3119a2033d5811328d78d7`, descendente do último código WEB aprovado `65878d2b977fc3300faaa0f3a9c40ad268f63251`. Apenas inclusão da branch obrigatória nos filtros push dos dois workflows Android existentes; sem mudança de fontes pinadas ou lógica.
- **Parceiro:** [run 41158242762](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41158242762), completed/success, job `124409716819`, todas as etapas obrigatórias aprovadas. Gradle: BUILD SUCCESSFUL; preflight integrado e navegação do bundle passaram; upload concluído.
- Artefato `13025344719`, `APOIS-Parceiro-TESTE`; APK real extraído, CRC do ZIP/APK aprovado e módulos Motorista/Entregador presentes. Pacote `br.com.apois.parceiro`, versionName `1.0.20`, versionCode `21`, minSdk 24 (Android 7.0), targetSdk 36, debug.
- Arquivo `APOIS-Parceiro-TESTE.apk`: **7.471.540 bytes**, SHA-256 `00c1a63edc2b48c088231df1b766da1f90a67fc172bafc3398555b9eb71837d4`. ZIP de transporte: SHA-256 `454af332d62bd11a6e6d501d7c3d614f08aaf21a1e5d01181e6307273b5927cc`, conferido contra digest do Actions. APK disponibilizado para download na conversa. Retenção do artefato Actions até 07/11/2026 UTC.
- **Cliente bloqueado:** [run 41158242726](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41158242726), completed/failure no job `124409716924`, etapa Restore persistent QA Android debug signing. Builds Corridas/Entregas/shell e criação Android passaram; assembleDebug/upload não executados. **Não existe APK Cliente novo desta rodada.**
- Causa comprovada: secret `APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64` vazio e cache `apois-client-qa-encrypted-signing-v1` indisponível nesta branch. O workflow tentou gerar identidade temporária, mas a guarda de fingerprint rejeitou corretamente e nada foi publicado/cacheado. Não houve troca da assinatura esperada nem remoção da guarda.
- Histórico `41096860712`, branch `test/apois-pix-simulado-isolado-20261029`: logs comprovam reutilização do cache e certificado QA esperado `97eaf64ee20ef16b2765a6dff5e96a25dbad4da12ccb6e5c2cd48d4c9c2f61f4`. Isso comprova disponibilidade histórica nessa branch, não na branch atual. APK antigo não foi apresentado como resultado novo.
- Desbloqueio Cliente: responsável deve restaurar **o keystore QA existente**, correspondente ao fingerprint acima, no secret já previsto `APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64`; não enviar chave privada no chat nem versioná-la. Depois reexecutar o job falho na mesma branch. Não alterar branch protegida/default, pacote, OAuth ou fingerprint para contornar.
- Limitações confirmadas no job Cliente: Firebase unificado não fornecido/push desabilitado; browser key/map ID Entregas ausentes. Corridas usa fallback Maps JavaScript intencional no debug. Parceiro materializou o Firebase existente; isso não comprova recebimento de push real.
- APK Parceiro usa debug signing do runner. Não foi comprovada compatibilidade de atualização com APK anterior nem funcionamento OAuth nativo. Não sugerir remoção de instalação/dados sem diagnosticar eventual conflito.
- O build não executa pedidos/contas/serviços reais. Ainda pendentes testes físicos de instalação, login/Google, sessão, GPS/Maps, push/background, teclado/safe-area, E2E despacho/retirada/PIN, painéis privados, avatar/RLS e pendências de lint/lockfile. **Não declarar homologação final.** Nenhum deploy, merge, SQL remoto ou cobrança executado.


## RECUPERAÇÃO QA E APK CLIENTE ENTREGUE — 30/10/2026 (Brasil)

- Exceção expressamente autorizada pelo proprietário: alteração temporária somente do workflow Cliente na branch antiga `test/apois-pix-simulado-isolado-20261029` para recuperar a assinatura existente. Não foram alteradas fontes protegidas.
- Chave local Windows informada pelo proprietário tinha certificado SHA256 iniciado por `4A:34:76:B9`, diferente do QA esperado; não foi usada nem cadastrada.
- Recuperação [41160432612](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41160432612), commit `8675cc9c45492ef038d6abb6318577f92d622cf0`: cache encontrado/restaurado, descriptografia e fingerprint original aprovados. **Job falhou ao tentar salvar secret**: HTTP 403 Resource not accessible by personal access token no endpoint public-key. Secret NÃO foi restaurado; nenhuma permissão foi ampliada. Temporários removidos por trap, chave não apareceu em logs/artefatos.
- Alternativa segura concluída: usar o cache no runner da própria branch antiga, compilando via checkout explícito e asserção o commit exato da homologação **`494e0e059b2c2983c9d894066038290ab5ef8f8d`**. Essa alternativa não tentou gravar secret por outra identidade e não removeu a guarda do certificado.
- **Cliente [41160495036](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41160495036): completed/success**, job `124416760710`. Workflow temporário `01101ca86e6b47d8b289b1b65fda509788728f02`; não confundir esse SHA do workflow com o SHA efetivamente compilado acima. Log confirma checkout, reaproveitamento QA, BUILD SUCCESSFUL e verificação apksigner contra fingerprint `97eaf64ee20ef16b2765a6dff5e96a25dbad4da12ccb6e5c2cd48d4c9c2f61f4`.
- APK `APOIS-Cliente-TESTE.apk`: **8.335.877 bytes**, SHA256 `ba99045ab74f4d601521c01b8afef034261435dcbdd7fa918e152014aa026585`; versão carimbada pelo workflow **1.0.11-qa.64 / versionCode 64**. Artefato `13027125963`, expira em 07/11/2026 UTC; ZIP SHA256 `59c34bcf6217b6544320d601dc00567d8ba13d03d7f0cc9bb5a2ed36d66fb758` conferido. CRC ZIP/APK e presença dos módulos Corridas/Entregas aprovados localmente. Download do APK disponibilizado na conversa.
- **Branch antiga restaurada:** commit `9ba190e1a4e419928e6552f3d12ce4ffab07f36f` com [skip ci]; árvore final é exatamente a mesma árvore do HEAD inicial `aaf2f1905817824b44ddbe6042d41fa92049774f`. Nenhum workflow temporário permanece ativo; histórico da recuperação preservado, sem force-push.
- Parceiro já entregue: run `41158242762`, APK `APOIS-Parceiro-TESTE.apk`, SHA256 `00c1a63edc2b48c088231df1b766da1f90a67fc172bafc3398555b9eb71837d4`, versão 1.0.20/21.
- **Bloqueio de geração desta rodada resolvido. Persistência do secret continua pendente:** futuros builds na branch obrigatória ainda dependem de disponibilizar o keystore original no secret por um administrador com permissão apropriada. Não afirmar que o HTTP 403 ou o secret foram corrigidos; o cache histórico ainda é a única cópia comprovadamente utilizável. Não apagar o cache.
- Nenhum APK antigo foi apresentado como novo. Nenhuma chave foi enviada ao chat, versionada ou anexada ao APK como arquivo de assinatura.
- Sem deploy, publicação em loja, merge, AAB, migrations remotas ou operação de pagamento. Os APKs usam o sistema atual e testes de interface/login/aparelho não equivalem a homologação integral. Permanecem os gates físicos/serviços externos, lint/lockfile e limites de Maps/push já documentados.
