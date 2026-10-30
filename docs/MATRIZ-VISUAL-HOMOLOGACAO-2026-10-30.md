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
