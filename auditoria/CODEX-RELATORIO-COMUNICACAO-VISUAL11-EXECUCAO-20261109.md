# APOIS — Relatório de execução RV-11 | Rodada ampliada da comunicação visual

**Data:** 09/11/2026  
**Entrada:** RELATORIO-VISUAL-11-APOIS-RODADA-AMPLIADA-20261109(1).md, 140 linhas.  
**Escopo:** endereços, cadastro, perfil, categorias/produtos, notificações do Passageiro, busca de localização, tema Motorista e endereço extenso.  
**Repo/branch autorizados:** apoistecnologia-gif/apois-superapp, audit/continuacao-20261107.  
**Base anterior:** RV-10, HEAD 3bc41963533ce5ae9e724d28641d119b3b5af5d0, 30 achados visuais.  
**Registros atuais:** CV-031–CV-038 (VIS-032–VIS-039), 8 registros.  
**Estado:** correções de apresentação preparatórias, não homologadas em build/APK físico. CV-037 (tema) permanece pendente; CV-038 (endereços longos) implementado apenas como layout candidato, sem medição.

## 1. Versão preservada e método

O relatório externo examinou audit/ecossistema-20261107 (HEAD 18f2fed7e27486f2b3a4170921a246344316a2a4). Essa branch é referência de auditoria e **não foi alvo de escrita**. O integrador de edição permaneceu exclusivamente em audit/continuacao-20261107; não se usou main para atualizar o source-lock.

O arquivo .apois/source-lock.json não foi alterado e permanece com SHA blob **3f98789f28666ccc052175db10f138208dd0937b**. As origens imutáveis são:
- apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625;
- apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618;
- apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f.

Foram lidos na origem pinada os arquivos completos das seguintes telas: Entregas src/routes/enderecos.tsx, src/routes/enderecos/novo.tsx, src/routes/enderecos/editar/$addressId.tsx, src/routes/register.tsx, src/routes/perfil/dados-pessoais.tsx, src/routes/estabelecimento.$merchantId.tsx, src/components/CustomerLocationAddressSelector.tsx; Passageiro src/routes/_authenticated.notificacoes.tsx. Também foram lidos os geradores do integrador e a proteção original scripts/harden-entregas-address-async-v11.mjs. A montagem pós-hardeners foi verificada pela **ordem dos scripts e por simulações de transformações**, não pela execução do build.

Os dois novos registros de risco foram mantidos distintos dos seis achados de lacuna funcional/acessível. Não foi feita inspeção visual real de APK, ambiente de produção, banco ou conta autenticada.

## 2. CV-031 / VIS-032 — rótulos de quatro formulários

**Antes:** rótulos estavam apenas visualmente próximos aos campos, mas não tinham htmlFor/id ou envolvimento. No cadastro, a mensagem de erro aparecia separada sem aria-describedby.

**Depois:** novo overlay scripts/fix-entregas-labels-visual11-v1.mjs, aplicado somente no workspace descartável .work/entregas, com quatro destinos:
1. Novo endereço: Field deriva id determinístico do name e vincula label htmlFor ao Input, sem mudar props, máscaras ou validação;
2. Editar endereço: os oito campos postal_code, street, number, complement, neighborhood, city, state e reference recebem ids únicos na rota com labels associados;
3. Registro Cliente Entregas: sete campos Nome completo, telefone, CPF, nascimento, e-mail, senha e confirmação recebem id, htmlFor no helper Field, aria-invalid para erros de campo e aria-describedby para a mensagem já existente;
4. Dados pessoais: cinco campos Nome, telefone, CPF, nascimento e e-mail recebem id e htmlFor sem alterar onChange, type, required ou value.

O script só altera elementos visuais/associativos e recusa correspondências ausentes, múltiplas ou inesperadas. Nenhum request, registro de usuário ou dado é enviado durante a aplicação.

**A homologar:** clique no rótulo, nome do campo e erro no TalkBack, máscaras, inputMode, autocomplete, layout fonte ampliada, teclado Android e TypeScript.

## 3. CV-032 / VIS-033 — seleção do endereço e ações internas

**Antes:** todo o cartão era div com role=button e tabIndex=0. Seu handler de teclado selecionava o endereço em Enter/Espaço sem verificar event.target. Botões Editar, Excluir e Corrigir localização eram descendentes dessa mesma superfície. Um evento de tecla vindo dos botões internos podia resultar na seleção do cartão.

**Depois:** scripts/fix-entregas-address-catalog-visual11-v1.mjs converte a superfície externa em role=group com as ações internas como irmãos de uma **subsuperfície de seleção própria**, role=button, tabIndex=0, aria-pressed={selected}, nome acessível com rua/número/bairro/cidade/UF, foco visível e eventos isolados. O handler de teclado interno só seleciona quando event.target===event.currentTarget e tecla Enter/Espaço, usando preventDefault para evitar efeitos duplicados de tecla. Não há button HTML contendo outros buttons; evita-se aninhamento interativo inválido.

Callbacks operacionais e nomes de funções setSelectedAddressId, handleDelete, handleConfirmAddress e navigate para edição estão preservados. Não é feita a confirmação do endereço pelo simples foco ou clique no botão de Editar/Excluir. O botão Confirmar endereço continua independente.

**Verificação sintética real:** entrada de tecla Enter/Espaço/Tab com target de controle interno foi ignorada; Tab no seletor também não selecionou; Enter e Espaço no seletor acionaram exatamente uma seleção por tecla. Não foi testada a árvore DOM real ou a ativação nativa do TalkBack.

## 4. CV-033 / VIS-034 — estado selecionado em três padrões

No mesmo overlay:
- o seletor independente do endereço expõe aria-pressed={selected}, sem confundir seleção atual com badge Padrão;
- os botões Casa/Trabalho em Novo/Editar recebem aria-pressed baseado em formData.label, mantendo os respectivos setFormData;
- os filtros Todos e categorias do estabelecimento recebem aria-pressed baseado em activeCategory, sem mudar filtros de produtos ou categoria ativa.

Não se presumiu um sistema de tabs onde o JSX usa botões de filtro. O estado é de botão pressionado. Interações assistivas reais permanecem pendentes.

## 5. CV-034 / VIS-035 — botão nomeado por produto

Na vitrine do estabelecimento, o botão Plus/Loader2 passa a expor aria-label dinâmico:
- em repouso: **Adicionar ou personalizar [nome do produto]**;
- durante isCustomizing: **Preparando [nome do produto]**.

A expressão onClick={() => !isCustomizing && handleAddToCart(product)}, disabled={isCustomizing}, preços, imagens, catálogo e o sheet de customização do RV-10 continuam intactos. A formulação não presume que todos os produtos são adicionados diretamente: o mesmo handler decide entre acrescentar ou abrir personalização. Nenhum segundo clique ou callback foi adicionado.

## 6. CV-035 / VIS-036 — notificações do Passageiro

Novo overlay scripts/fix-corridas-notification-visual11-v1.mjs no workspace descartável .work/corridas, em src/routes/_authenticated.notificacoes.tsx. Acrescenta um span sr-only no interior de cada botão, com texto **Não lida.** ou **Lida.**, vinculado ao cálculo unread = notification.read_at === null já existente.

A mudança conserva notification.title, notification.body, formatNotificationDate(notification.created_at), ação condicional markAsRead(notification.id) e o contador original. Não altera o feed Motorista nem qualquer domínio de notificações ou leitura no servidor.

**A homologar:** o leitor de tela deve anunciar estado, título, texto e data de forma inteligível; não repetir a lista toda após cada atualização.

## 7. CV-036 / VIS-037 — autocomplete de endereços com estado verdadeiro

**Antes:** o campo de busca de CustomerLocationAddressSelector.tsx eliminava sugestões ao receber falha e exibia somente a lista quando havia dados. O patch V11 existente já adicionava searchRequestRef para descartar respostas obsoletas, mas não distinguia falha de vazio.

**Depois:** scripts/fix-entregas-autocomplete-visual11-v1.mjs acrescenta estado **local de apresentação** idle/loading/ready/empty/error. A consulta com texto curto retorna ao estado inicial; durante consulta exibe “Buscando endereços…”; resposta bem-sucedida com [] mostra “Nenhum endereço encontrado”; erro com resposta mais recente mostra mensagem de falha e o botão Tentar novamente. O botão chama **a mesma função search(query)** com o mesmo texto, sem API nova. Ao escolher sugestão, o estado visual volta ao inicial; a invalidação de respostas V11 permanece em vigor.

**Preservado:** invokeMaps autocomplete, place_details e reverse_geocode, seu payload, searchRequestRef, setSuggestions, onAddressSelected e opção Usar minha localização atual. Não se inventam sugestões ou coordenadas. O overlay exige a presença dos marcadores V11 e falha fechado se mudarem.

**Verificações sintéticas reais:** cinco cenários de busca exercitados em V8 sobre o handler final derivado da fonte protegida + patch V11 + patch CV-036: texto curto, sucesso sem resultados, resposta antiga ignorada, erro distinguível, nova tentativa com resultado. Os cinco passaram, sem chamadas reais a Maps/Supabase.

## 8. CV-037 / VIS-038 — preferência de tema Motorista

**Estado: pendente, sem alteração de código.** O relatório externo observou possível contradição entre opções Claro/Escuro/Auto e a superfície branca mantida forçosamente pelo hardener das configurações. O código inspecionado sustenta a necessidade de teste, não prova comportamento final na build instalada.

Nenhum ThemeBtn, setMode, tokens :root/.dark, tema do mapa, paleta oficial ou preferência persistida foi removido ou reescrito. A decisão de produto sobre o alcance da opção exige render e teste físico dos três modos.

## 9. CV-038 / VIS-039 — texto de endereço truncado

**Estado: melhoria preparatória, ainda sem validação de layout.** Na lista de endereços salvos, duas classes truncate foram substituídas por break-words nas linhas de rua+número e bairro+cidade/UF, conservando o texto original. A motivação é permitir conferência completa antes de confirmação, mas não foi medida a altura final em telas estreitas e fonte ampliada.

O footer, a rolagem, onConfirm, edição e destino são preservados textualmente. Não declarar concluído visualmente até confirmar layouts reais 320/360/390/412 px, paisagem e rolagem com endereços longos.

## 10. Arquivos versionados e montagem

**Criados:**
- scripts/fix-entregas-address-catalog-visual11-v1.mjs — seleção isolada, rótulos pressed, ação do produto e texto comprido; primeira edição b0b11e6f6f358b8abe43230e61471c574dfb1414, ajuste de aninhamento e080276c164c1eefb1701573c550c2adc74931a4;
- scripts/fix-entregas-labels-visual11-v1.mjs — quatro telas com associação label/input; c974a70e45dbee139fbe541ba73e09da4f158d0e;
- scripts/fix-entregas-autocomplete-visual11-v1.mjs — estado visual da busca; fd3e5fab5189b552d797140c63502b6e67262d42;
- scripts/fix-corridas-notification-visual11-v1.mjs — sr-only do Passageiro; 90d2153911aab931fd6b3feca6f7430a403cc9af;
- scripts/qa/test-entregas-visual11-v1.test.mjs — assertions de campos, teclado, seleção, busca e versão; 850049f21c555a88b1fc20c405a6737236fa75ed;
- scripts/qa/test-corridas-notification-visual11-v1.test.mjs — asserts de estado e chamada markAsRead preservada; d265599433bcf42637727c98d78afcf10eef7b99.

**Alterados:**
- scripts/build-isolated-module.mjs — CV-031–034, CV-036/038 Cliente Entregas e CV-035 Passageiro após geradores/hardeners anteriores. Commits 7cc1729ca19c9128542fa2cf14ccf9db25dbe3b1 e 59425224e57d8dc9a7bbd3fab535cfee6f10ea24;
- scripts/build-merchant-panel.mjs — aplica mesmos três overlays Entregas depois da sequência de checkout/contraste/segurança; commit e2101b2eb65055be17973949bea1696cea5af56e;
- auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md — acrescentou CV-031–038, commit ff6ce0ef75c899bae3e14272de8ac4b3d806e095;
- este relatório independente.

As duas suítes Node foram **versionadas e incluídas como gates nos builders**, e os builders verificam os marcadores depois de aplicar os overlays. Nenhum artefato fora da branch autorizada foi escrito; não há mutation de repositórios-fonte.

## 11. Evidência executada versus pendente

**Executado de fato nesta rodada:**
- leitura remota dos componentes das origens pinadas (não revisão integral de 32 arquivos do inventário externo);
- revisão do gerador V11 e teste local em V8 de substituições equivalentes do autocomplete preservando a ordem;
- **nove transformações** Entregas aplicadas de forma isolada aos componentes originais (quatro formulários, cartões, dois apelidos, catálogo, autocomplete), todas passaram na reaplicação idempotente;
- sintaxe JavaScript analisada em V8 para os quatro overlays e os dois arquivos Node test;
- **oito cenários sintéticos** de teclado/cartão e autocomplete avaliados sobre handlers efetivos no V8, com sucesso em todos os oito;
- integração e checagens de marcadores adicionadas aos builders, sem executá-los;
- origem protegida e histórico de visual/engenharia mantidos.

**Não executado:** node --test com um checkout completo e .work efetivamente construído, Bun/TypeScript, lint, build Web/React, árvore de acessibilidade do navegador, TalkBack, Playwright, comparação real 320/360/390/412 px, APK, produção, rede Maps, login, cadastro, exclusão/seleção real de endereço, criação de pedido ou corrida, atualização de notificações, pagamento, deploy ou merge.

A auditoria do usuário teve inventário próprio de 32 arquivos; esta execução não reivindica ter refeito seu inventário SHA-256. Mudanças de estilo posteriores no builder devem ser verificadas em full build antes de encerrar os achados.

## 12. Consolidação

**38 registros visuais CV-001–CV-038** (oito registros nesta rodada), dos quais CV-037 permanece pendente e CV-038 depende de homologação. CV-030 segue não aplicável ao contrato pinado; VIS-001 permanece alias de INV-047; retificação VIS-007/CV-006 continua válida.

**67 achados técnicos históricos** sem alteração: A=0, B=46, C=17, D=0, E=1, G=3.

**Sem merge, deploy, APK, SQL/RLS, alteração de Supabase, autenticação, regras de negócio, pagamentos, preços, APIs Maps, source-lock ou reposições do código-fonte pinado.** Não se declara o ecossistema inteiro auditado/concluído.

**Próxima numeração visual disponível: CV-039**, para eventual RV-12.
