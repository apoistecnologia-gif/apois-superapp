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

## Registro de teste físico — 31/10/2026 — Cliente/Entregador #7
- O usuário confirmou instalação e abertura do Parceiro 1.0.21. Capturas reais: oferta #7, mapa/CTA NAVEGAR externo, tela após retirada com campo PIN, e cliente #7 em "Saiu para entrega" sem PIN exibido.
- Evidência visual positiva: oferta/aceite, tela de rota até estabelecimento e etapa "Indo ao cliente" após retirada. Nova rota externa específica e retorno ao aplicativo ainda sem teste E2E completo.
- Falha real P1: o Cliente não mostra PIN enquanto pedido está em viagem. Código do pin Entregas mostra que a busca do PIN e o card estavam limitados a delivery_job.status === "arrived_destination"; o Entregador simplificado só alcança esse estado ao tentar concluir com PIN. Isto gera dependência circular.
- Ajuste proposto/commit de código `0afd6e7de380f45fea218e714967652610a0a914`: em `scripts/fix-entregas-customer-delivery-tracking-v1.mjs`, exibir e buscar PIN existente apenas para `picked_up`, `on_the_way`, `arrived_destination`, com entrega ainda não concluída. Não criar PIN, não mudar RPC, RLS, segredo, backend ou produção.
- **Estado atual:** ajuste versionado na branch de homologação, ainda sem build WEB/Android nem teste real no cliente atualizado. NÃO declarar resolvido fisicamente. Testar recuperação do PIN autorizado, pedido antes da retirada sem PIN, após retirada com PIN, finalização com PIN e estado entregue sem PIN. Se RLS impedir leitura, investigar acesso autorizado sem abrir secrets genericamente.
- Outra divergência da captura: logo amarela antiga no modal de nova oferta; corrigir de forma isolada após localizar a origem CSS/asset, sem rebranding global.
- Nenhum deploy, merge, migration, operação financeira, edição de fontes protegidas ou APK novo nesta etapa.

## Continuação 31/10/2026 — Correções solicitadas e CI nativo
- Ajuste do PIN do Cliente em `scripts/fix-entregas-customer-delivery-tracking-v1.mjs`: após a retirada confirmada, consulta e exibição do PIN existente nos estados `picked_up`, `on_the_way`, `arrived_destination`. A validação do PIN permanece na RPC server-side. Commits `0afd6e7` e ajuste do marcador `a9595be`.
- A logo do overlay de oferta era componente separado (`CourierOfferOverlay.tsx`): ainda tinha `alt="APOIS ENTREGA"` acionando possível substituição CSS de asset legado. Script final agora exige URL de logo oficial e altera alt localmente para `APOIS`. Commit `b6995e3`, sem mudanças de lógica na oferta.
- Preflight WEB `41164238980`: 3 jobs SUCCESS; certifica builds/contratos web, não as telas privadas no Android.
- Primeiro Android Cliente `41164169102`: FAILURE, gate de marcador `APOIS_CUSTOMER_DELIVERY_PIN_STAGE_V1` ausente no output transformado. Corrigido no commit `a9595be` e recompilado.
- Segunda tentativa Android Cliente `41164253048`: FAILURE **depois** da compilação, na etapa de recuperar assinatura QA. `APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64` vazio, cache indisponível na branch. Runner criou keystore novo com fingerprint `6E:4D:1E:E6:1A:6B:34:29:75:26:4B:FE:DD:8D:93:40:AA:4F:CF:AB:8F:FA:EF:B5:A2:D2:39:FA:69:E3:DE:80`; gate rejeitou contra certificado QA original `97ea...61f4`. **Não trocar fingerprint, não instalar APK com outra chave nem recomendar desinstalar app.** Secret continua pendente.
- Android Parceiro 1.0.22, versionCode 23: execução `41164171847` iniciada, resultado final ainda pendente no registro. Build existente não autoriza afirmar homolagação física.
- Sem deploy/merge, alteração no banco, fontes protegidas, pagamentos ou assinatura QA.

## Resultado definitivo do Parceiro 1.0.22 — 31/10/2026
- GitHub Actions [41164171847](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41164171847): completed/success, job build-partner-apk. Fonte compilada `2dbe3bf0d45f0b4eb2e5624e28f22c81d1338af5`, versionName `1.0.22`, versionCode `23`.
- Artefato GitHub `13029035566`, `APOIS-Parceiro-TESTE`. ZIP CRC validado; APK final `APOIS-Parceiro-TESTE-1.0.22.apk` extraído com 7.471.720 bytes, SHA256 `f83fb0ed181c87a74a8af92e5729d46a55c0533f707e75729c276b6e91dd4b7d`.
- Verificações: módulos e preflight integrado no job APK passaram; preflight WEB independente [41164238980](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41164238980) completed/success 3 jobs.
- Instalação/atualização do Parceiro 1.0.22, logo em aparelho, navegação, PIN E2E e compatibilidade de assinatura com 1.0.21 **não foram testados**. Não desinstalar app nem remover dados automaticamente.
- Cliente 1.0.11 ainda **sem novo APK** após o ajuste PIN porque [41164253048](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41164253048) parou corretamente na proteção do certificado QA. Não rotacionar keystore, não mascarar bloqueio e não apresentar APK anterior como atualizado.

## 31/10/2026 — Recuperação de assinatura QA e novo Cliente
- Compilação temporária na branch histórica `test/apois-pix-simulado-isolado-20261029` com checkout **explícito e conferido** da fonte homologação atualizada `d991fe55f6bca8c4d535c2ace1feedbae0675cea`, contendo a correção de PIN, sem copiar código da branch histórica para o produto.
- Run `41208441088`, job `124558222159`, `completed/success`. Cache criptografado QA original recuperado, certificado original SHA256 `97eaf64ee20ef16b2765a6dff5e96a25dbad4da12ccb6e5c2cd48d4c9c2f61f4` conferido via keytool e apksigner; `BUILD SUCCESSFUL`.
- Android QA versão real `1.0.11-qa.67`, versionCode `67` (superior ao 64 instalado). Artefato `13044772905`; arquivo `APOIS-Cliente-TESTE-PIN-QA.apk`, 8.335.845 bytes, SHA256 `d19cc05ed0da3b5eed7ba80b3b3c8c33adda1a72a87f639a056b300cdbbdd44a`. Arquivo ZIP validado (CRC sem erros).
- Workflow temporário foi restaurado ao byte-exato SHA de conteúdo original `fe2f20cda896c050aa88335671190569e4dabd58` pelo commit `a62e0b0c4423b64fc76e13f1cc3035df47dc42a5`; nenhuma modificação persistente nas fontes protegidas.
- **Secret QA permanente ainda vazio e pendente**; sucesso do cache histórico não implica secret reparado ou cache disponível na branch atual. Nenhuma chave privada publicada ou oferecida em conversa.
- Homologação funcional do PIN no Android com duas contas continua pendente: após retirada, cliente deve ver código e entregador deve concluir; conferir status entregue sem PIN.

## 31/10/2026 — Revisão da solicitação no painel do estabelecimento
- Captura física do painel: contador Pedidos (1), aviso sonoro/visual, mas nenhum resumo do pedido automaticamente apresentado para decisão; proprietário exige itens, quantidades, observações, identificação do cliente e endereço antes de Aceitar/Recusar.
- Causa código: `MerchantOrderControlCenter.tsx` filtra `payment_status=paid`, excluindo teste cash autorizado (`payment_status=pending`), e seleciona apenas metadados simples.
- Correção de homologação em `scripts/fix-entregas-merchant-order-review-v1.mjs`, incluída em `scripts/build-isolated-module.mjs`: seleciona `order_items(*)`, endereço e observações; inclui pagamento direto de teste pending, mostra card de revisão e abre a central para nova ordem confirmada sem reabrir repetidamente. Mantém aceite manual e bloqueia aceite se itens não forem carregados.
- A identidade textual do cliente **não está resolvida**: `profiles.full_name` é protegido por RLS que permite apenas próprio usuário/admin. Não ampliar RLS ou expor dados em frontend; precisa endpoint autenticado, estritamente vinculado a pedidos legítimos do estabelecimento, antes de declarar requisito completo.
- Preflight `41210286367`: WEB-only cliente, WEB-only estabelecimento e audit-web-only todos SUCCESS. Ainda não houve deploy de painel, nem teste físico da apresentação do card, nem prova de leitura dos itens via RLS na sessão do comerciante. Nenhuma alteração direta em produção foi executada.

## 31/10/2026 — Avaliação Cliente e produtos (código QA, sem APK)
- Erro físico relatado: ao abrir a avaliação, a tela geral apresentou "Ops! Algo deu errado".
- Causa de código concreta, compatível com o erro: a relação delivery_jobs.order_id possui UNIQUE em produção (objeto 1:1), mas a tela chamava .some() supondo array. O script de homologação corrige objeto ou array; ainda falta comprovação física para afirmar que esta era a única causa.
- Script: scripts/fix-entregas-customer-order-reviews-v1.mjs, executado somente no workspace .work/entregas via build-isolated-module.mjs. Também trata falhas de carregamento da avaliação e mantém avaliação original de estabelecimento e entrega.
- Teste: scripts/test-entregas-review-to-one-v1.mjs, com objetos, arrays e ausência de entregador; conectado ao build WEB. A validação real da rota autenticada no Android continua pendente.
- Avaliação individual de produtos com notas 1 a 5 e comentário por item preparada na UI. A persistência fica desativada enquanto o servidor não tiver suporte; nunca exibir falsa confirmação de armazenamento. RPC antiga de avaliação do pedido preservada para os campos existentes.
- SQL de revisão separado e NÃO APLICADO: docs/qa-sql/20261031_product_order_reviews_NOT_APPLIED.sql, com proteção RLS, posse do pedido, entrega concluída e atomicidade ao submeter avaliação conjunta. A aplicação futura exige autorização explícita.
- Não houve APK, AAB, deploy, merge ou alteração de SQL/produçao nesta etapa.

- Preflight final sem APK 41211392232: WEB-only cliente SUCCESS, WEB-only estabelecimento SUCCESS e audit-web-only SUCCESS. Logs do Cliente confirmam execução de scripts/fix-entregas-customer-order-reviews-v1.mjs e do teste scripts/test-entregas-review-to-one-v1.mjs. O teste visual é de páginas anônimas; rota autenticada de avaliações, RPCs de produto e Android ainda não homologados fisicamente.


## 31/10/2026 — Migração de avaliações de produtos confirmada no Supabase
- Solicitação do proprietário autorizou expressamente a migração do banco de produção do APOIS Entregas **sem gerar APK/deploy**.
- Supabase de Entregas: ref `ptgkwyyolrdgnqketkjj` (não é o projeto de Corridas). A consulta `list_migrations` confirmou versão `20261031150244`, nome `apois_product_order_reviews_authenticated_v1_20261031`.
- A tentativa de aplicar novamente SQL de migração encontrou política já existente; **não houve segunda aplicação**. A leitura posterior confirmou que `public.product_order_reviews` já existe, com RLS habilitado, políticas SELECT e INSERT restritas ao cliente autenticado, pedido entregue, usuário ativo e avaliação prévia do pedido.
- RPCs disponíveis e verificadas: `public.submit_order_product_reviews(uuid,jsonb)` e `public.submit_order_review_with_products(uuid,smallint,smallint,text,jsonb)`, ambas SECURITY INVOKER e EXECUTE apenas para `authenticated`, sem acesso `anon`. A RPC original `public.submit_order_review` foi preservada.
- Restrições verificadas: nota 1–5; comentário até 500 caracteres; UNIQ order_item_id; FKs para pedido/item/usuário. Permissões: SELECT/INSERT de tabela só para authenticated com RLS; anon sem direitos.
- Contagem verificada após migração: 7 pedidos, 7 itens, 0 reviews originais, 0 avaliações individuais de produtos; nenhum histórico foi migrado artificialmente. Verificação dos advisors não apontou alerta próprio de `product_order_reviews`; existem alertas herdados de outras áreas não abordados.
- IMPORTANTE: `docs/qa-sql/20261031_product_order_reviews_NOT_APPLIED.sql` é um **rascunho histórico anterior** à migração efetivamente registrada no Supabase. Não executar esse rascunho novamente.
- Ainda pendentes: teste real de uma avaliação autenticada, fluxo de edição/visualização no APK futuro e homologação física após autorização de build. **Nenhum APK/AAB, deploy, merge ou alteração no Supabase Corridas.**

## 31/10/2026 — Foto do Entregador bloqueada por Storage RLS
- Teste físico Parceiro: toast "O envio da foto não foi autorizado ou falhou. Tente novamente", após seleção da foto de perfil; upload é disparado por CourierProfilePanel em CourierPanels.tsx.
- Código atual escolhe JPG/PNG/WebP, limite 5 MiB, caminho UUID do usuário + /courier-profile/ + random UUID e upsert:false; após upload, atualiza apenas profiles.avatar_url do próprio usuário.
- Supabase Entregas produção ptgkwyyolrdgnqketkjj: storage.buckets.avatars existe, público, file_size_limit 5 MiB, MIME image/jpeg/png/webp; storage.objects RLS=true, **zero políticas em storage.objects**. Diagnóstico: INSERT negado pelo RLS, antes de atualizar profiles. Zero arquivos armazenados no prefixo courier-profile.
- Cuidado adicional: public.couriers também tem RLS=true sem políticas SELECT; EXISTS direto de public.couriers na policy storage não funcionaria para authenticated e retornaria falso. Migração antiga era insuficiente.
- SQL CORRIGIDO, SOMENTE PREPARADO (NÃO APLICADO): supabase/entregas-forward-migrations/courier_profile_avatar_scoped_upload.sql, com função estreita SECURITY DEFINER checando auth.uid(), status approved, courier.is_active e profiles.is_active. EXECUTE da função revogado para PUBLIC/anon, dado somente authenticated. Policy INSERT confinada a bucket avatars, prefixo do próprio uid e pasta courier-profile (sem UPDATE/DELETE ou mudança de aprovação). Dependente de autorização específica para alterar Storage RLS em produção.
- Código QA: scripts/fix-partner-courier-avatar-diagnostics-v1.mjs, invocado após fix-partner-courier-profile-history-v1.mjs em scripts/build-partner-release.sh. Erro de permissão passa a ser distinguido de rede, sem publicar detalhes sensíveis de Storage. Teste estático de segurança integrado em scripts/audit-partner-preflight-v1.mjs.
- Nenhum APK, AAB, deploy ou alteração de banco de produção realizada nesta correção. Para desbloquear uploads nos APKs atualmente instalados, é necessária aplicação da policy Storage após autorização (não depende de novo APK); depois teste físico do upload e persistência no perfil.

## 31/10/2026 — Migração autorizada de foto do Entregador aplicada
- Autorização expressa do usuário nesta conversa ("Sim"), restrita à permissão de upload da foto do próprio entregador aprovado, sem geração de APK.
- Produção APOIS Entregas Supabase `ptgkwyyolrdgnqketkjj`; apply_migration SUCCESS; histórico confirmado `20261031151515` / `apois_courier_avatar_own_scoped_insert_20261031`.
- SQL exato recuperado do histórico e salvo em `supabase/migrations/20261031151515_apois_courier_avatar_own_scoped_insert_20261031.sql`. Arquivo antigo `supabase/entregas-forward-migrations/courier_profile_avatar_scoped_upload.sql` marcado como já aplicado (não executar novamente).
- Storage bucket `avatars` mantido público por design, com MIME JPG/PNG/WebP e limite de 5 MiB; policy nova INSERT TO authenticated limita prefixo ao próprio `auth.uid()/courier-profile/arquivo`, extensão e elegibilidade de entregador aprovado e ativo com perfil ativo.
- Função `public.apois_can_upload_own_courier_avatar()` retorna unicamente booleano do usuário da sessão; `anon` sem EXECUTE, `authenticated` com EXECUTE; não há UPDATE/DELETE de storage nem alterações nas aprovações e documentos.
- Teste SQL de elegibilidade com `request.jwt.claim.sub` temporário: aprovado/ativo => verdadeiro; UUID estranho => falso. Sem gravar arquivos ou modificar registros.
- Conferido após aplicação: policy INSERT presente, função SEC DEFINER restrita, histórico de migrações confirmado, RLS da tabela storage.objects ativa, e `profiles` conserva UPDATE próprio pelo dono.
- Security Advisor: aviso de função SECURITY DEFINER exposta a usuários autenticados via RPC (categoria `authenticated_security_definer_function_executable`, link https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Restrita a um booleano do usuário autenticado, sem entrada arbitrária; anon proibido. Registrar como ponto para hardening futuro, sem expandir acesso a outros dados ou quebrar a policy.
- **Pendente teste real:** no Parceiro 1.0.22 atualmente instalado, selecionar JPG/PNG/WebP até 5 MiB; verificar avatar visível após fechar/reabrir e depois de login novo. Não há comprovação física até este momento.
- Nenhum APK, AAB, deploy, merge, migração de Corridas ou alteração de pagamentos neste escopo.
