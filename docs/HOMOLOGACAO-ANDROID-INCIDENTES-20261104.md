# APOIS Android — registro de ocorrências de teste físico
Data: 04/11/2026. Branch: `fix/entregas-homologacao-ajustes-20261030`.

## 001 — Cliente Corridas — endereço de embarque não identificado

**Relato:** captura de tela do Cliente Android instalado (`br.com.apois.app`, QA versionCode 1001). Mapa visível; o campo **Local de partida** exibe `Toque para tentar identificar o endereço...`, com texto truncado em viewport móvel. O relato ainda não informa o resultado de tocar no campo.

**Comportamento esperado:** mostrar endereço obtido a partir do GPS; se o provedor externo estiver indisponível, informar sem inventar rua/número, preservar último endereço que foi efetivamente validado, e permitir nova tentativa da consulta dentro da quota.

**Diagnóstico confirmado em produção, somente leitura:** Supabase Corridas `tbbzkrfupmqdywnzgnms`, função `google-maps-address` ACTIVE v18, com JWT. Logs de 04/11/2026 às 16:22 UTC: chamada POST da função retornou **HTTP 500**; seu RPC `consume_google_maps_lookup_quota` havia retornado **HTTP 200**. A função tentou `photon.komoot.io/reverse` e recebeu erro TCP `ECONNREFUSED` (servidor externo). Isso demonstra falha do serviço de resolução de endereço, **não prova falha de GPS**. Logs não provam por si só se a chave Google server-side está ausente ou se houve `ZERO_RESULTS`. Não publicar coordenadas pessoais nem mensagens completas da requisição.

**Código de interface em homologação:** `scripts/harden-corridas-pickup-address-display.mjs` substitui o texto longo por `Endereço indisponível` e distingue 429, 401/403 e 5xx da consulta; `scripts/harden-corridas-kit-visual.mjs` exibe `Toque para tentar novamente` abaixo do campo no modo erro. A tela final de referência, diferente do JSX antigo da origem, **já chamava refreshLocation/refreshAddress** no botão; manter esse fato, sem declarar que o toque final navegava para destino. A navegação de destino continua em botão separado. `harden-corridas-trip-flow-ux.mjs` preserva último endereço validado em falhas transitórias; `harden-corridas-pickup-timeout-v1.mjs` mantém limite de 12 segundos e deduplicação por GPS. Gate `scripts/verify-corridas-pickup-retry-v1.mjs` protege a tela final e o hook.

**QA comprovado:** [GitHub CI 41871938082](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41871938082): **3/3 jobs SUCCESS** (audit-web-only, WEB-only cliente, WEB-only estabelecimento). A validação WEB não comprova a resposta do geocoder no telefone.

**Servidor, somente preparado:** função `supabase/functions/google-maps-address/index.ts` sincronizada com a versão em produção e dotada de retry breve, limitado e somente para falhas de transporte/5xx do Photon; cenário offline testado em `scripts/qa/test-photon-reverse-retry-v1.mjs`. Esse código está **STAGED**, **NÃO DEPLOYED** em Supabase Corridas. Sem prova de um provedor funcional, o endereço automático **não está declarado corrigido**. Nem a indisponibilidade externa nem a chave do Google devem ser mascaradas por um nome de rua fictício.

**Limites e segurança:** não disparar automaticamente chamadas pagas ao Google Maps fora das quotas; não copiar chave pública de Maps para segredo server-side; não habilitar provedor comercial sem configuração segura e revisão de cobrança. Não usar Nominatim público como substituto automático de alto volume para corridas, que depende de regras de uso de serviços OSM. Não modificar produção, banco, corridas ou os `sources/` protegidos nesta ocorrência.

**Pendência para confirmação física:** após uma atualização cumulativa assinada, verificar se o campo mostra endereço real quando o provedor responde e se o botão repete consulta exibindo erro claro quando a função falha. Sem reinstalar/limpar dados do APK atual apenas por este sintoma.

## Próximas ocorrências
Registrar sequencialmente conforme o proprietário enviar novos prints; uma correção por vez e build cumulativo somente depois das validações.

**Verificação final do código do servidor preparado:** [GitHub Actions 41872327039](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41872327039): **3/3 jobs SUCCESS** após a preparação da tentativa limitada de recuperação do Photon. O resultado é de compilação WEB e teste isolado; **nenhum deploy no Edge, nova consulta real, mudança no aplicativo já instalado ou garantia de serviço externo funcionando**. A correção da interface passou antes em [41871938082](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41871938082), também 3/3 SUCCESS. A liberação física real do endereço continua pendente do provedor externo.

## 002 — Cliente Corridas — edição de dados pessoais exibe somente nome e cidade

**Relato físico:** screenshot Android do perfil de passageiro, no menu `Dados Pessoais`. Ao abrir a folha `Editar dados pessoais`, somente os campos `Nome completo` e `Cidade` aparecem. A tela de perfil original disponibiliza `Telefone` e `E-mail` como itens próprios, mas o usuário não consegue visualizá-los a partir desse resumo.

**Diagnóstico em código:** `scripts/harden-corridas-profile-edit.mjs` gera `PassengerProfileEditor.tsx` com três modos separados (`name`, `phone`, `email`); o primeiro modo intencionalmente mostrava apenas nome e cidade. O cadastro inicial de passageiro da fonte travada coleta nome, e-mail, telefone e senha, não há contrato confirmado de CPF/data de nascimento no perfil autenticado. Não inventar nem persistir atributos adicionais.

**Correção preparada na branch:** a janela de `Dados Pessoais` também passa a exibir o telefone e o e-mail registrados, com ações explícitas `Alterar` que abrem os editores existentes. Mantém alteração de e-mail via Supabase Auth e persistência própria dos campos de perfil via RLS, sem tocar senha, identidades, schema, usuários alheios ou produção. Correção adicional demonstrada: expressões regulares do gerador de edição estavam sem barras de escape, fazendo tratamento incorreto de espaços, números de telefone e sintaxe de e-mail; foram restauradas `\\s`, `\\D`, `\\d` e `\\.` onde exigidas. Gate `scripts/verify-corridas-profile-edit.mjs` agora verifica presença dos contatos, navegação interna e validadores.

**Status:** implementado no script da branch, ainda **não testado no Android**; o APK `1.0.11-qa.1001` já instalado não muda. Critério de aceite: compilar workspace final, teste de abertura e troca nome/telefone/e-mail, salvar nome/cidade e telefone em conta de homologação, verificar mensagem de confirmação e-mail quando permitido, reiniciar aplicativo e confirmar persistência. Sem deploy, SQL, APK ou atualização em produção durante esta ocorrência.
## 003 — Cliente Corridas — não há opção de excluir conta

**Relato físico:** no app Cliente Android, Perfil não oferece o controle "Excluir minha conta".

**Causa no código:** a rota de Perfil do passageiro em \`src/routes/_authenticated.perfil.tsx\` não possuía a ação. O gerador de UI \`scripts/harden-corridas-profile-edit.mjs\` apenas oferece nome/cidade, telefone e e-mail. O projeto Entregas possui fluxo distinto; não pode ser reutilizado no banco Corridas.

**Backend real verificado, somente leitura:** projeto \`tbbzkrfupmqdywnzgnms\` = "APOIS CORRIDAS - PRODUÇÃO". Existe RPC \`public.request_own_account_deletion()\`, que chama \`apois_rpc_private.request_own_account_deletion()\`; exige \`auth.uid()\`, identifica \`public.users.auth_user_id\`, rejeita corrida ativa, coloca motorista vinculado offline, marca \`public.users.deleted_at\` e registra \`audit_logs\` com ação \`profile.account_deletion_requested\`. Retorna JSON \`{"ok":true}\`. O RPC não garante limpeza física integral nem exclusão imediata da identidade Supabase Auth; guarda de sessão adicional foi necessária para bloquear nova utilização do perfil excluído. **Não executar a RPC durante testes**: altera estado real da conta. Uma Edge Function histórica \`delete-my-account\` existe na fonte fixada mas não está implantada no projeto Corridas atual e não deve ser invocada pelo novo botão.

**Implementação preparada somente em branch:** \`scripts/templates/PassengerAccountDeletion.tsx\` contém ação visível "Excluir minha conta", diálogo de confirmação com digitação exata \`EXCLUIR\`, resumo da retenção legal, tratamento de corrida ativa, loading, erros e encerramento da sessão somente depois de \`{"ok":true}\`. \`scripts/harden-corridas-profile-account-deletion.mjs\` injeta o componente no Perfil gerado e protege \`use-auth.tsx\` com \`.is("deleted_at", null)\`. Pipeline \`scripts/build-isolated-module.mjs\` e gate \`scripts/verify-corridas-profile-edit.mjs\` integram a alteração sem tocar \`sources/\` e sem migrations. O Supabase de produção, usuários, dados e APK instalado permanecem **intactos**.

**Status:** implementado no GitHub; **não há teste físico autenticado nem exclusão real executada**. Exigir build/QA verde e teste de UI sem acionar a confirmação de exclusão de uma conta real. Para teste de integração destrutiva, usar somente conta descartável e ambiente controlado/autorizado. Não declarar a eliminação física de dados concluída por esta única RPC.

## 004 — Motorista — ferramentas operacionais no menu lateral

**Evidência do teste físico:** os botões "Teste de Status · 6 verificações" e "Solicitações disponíveis" apareciam como ações provisórias sobre o painel do mapa, acima de "Ficar offline".

**Correção versionada:** scripts/fix-partner-motorista-sidebar-tools-profile-v1.mjs remove somente os dois botões de IdleBottomPanel. Seus acionamentos originais passam ao DriverSideMenu, com o mesmo estado dos modais ApoisStatusCheck e ApoisAvailableCalls e navegação de retorno a partir de telas internas. O botão de ficar online/offline, o GPS, as estatísticas, as RPCs de consulta/aceite e os eventos push permanecem inalterados.

## 005 — Motorista — cartão do perfil com foto, cadastro e estrelas

**Evidência do teste físico:** cabeçalho do menu mostrava um cartão preto, avatar com inicial e e-mail quebrado.

**Correção versionada:** cartão claro com nome, foto assinada do fluxo existente, status real do cadastro e estrelas provenientes de drivers.rating e drivers.total_ratings. Fallback de selfie somente quando foto_url está vazio, e ícone neutro quando nenhuma foto puder ser carregada. Sem avaliações, estrelas vazias e texto "Sem avaliações". O clique continua abrindo o perfil. O tipo DriverProfileRow foi ampliado para ler campos existentes sem alterar a base ou a RPC.

**Validação:** preflight web/typecheck e teste de regressão específicos exigidos pelo build Partner. Sem atualização em produção ou novo APK, ainda não validado em aparelho físico.

## 006 — Motorista — menu não cobre o mapa

**Relato físico:** menu sanduíche ocupa 90% da largura, deixando o mapa e botão operacional visíveis atrás do menu; destaque laranja no item Início destoa da marca.

**Causa confirmada:** DriverSideMenu define `w-[90vw] max-w-sm`; botão de mapa original continua corretamente na camada inferior. A identidade visual migrada mantém ícone ativo com gradiente.

**Correção versionada:** `scripts/fix-partner-motorista-menu-overlay-v4.mjs`: Drawer Radix ocupa a largura completa em celular, com fundo branco opaco e ícones neutros/vermelhos. Mantém focus trap, rolagem, rotas, close e callback da corrida. Não remove botão de online/offline do mapa: ele não deve aparecer através do Drawer.

## 007 — Motorista — contraste e sobreposição da barra de status

**Relato físico:** telas Configurações, Notificações, Aplicativo, Privacidade e Suporte possuem nomes quase brancos sobre cartões brancos; cabeçalho fica atrás da barra Android; hero de Configurações mantém fundo escuro e título escuro.

**Causa confirmada:** `harden-partner-red-visual.mjs` transforma fundos escuros em branco, mas algumas classes `text-zinc-100` de SettingsRow sobrevivem, assim como hero `bg-gradient-to-br` escuro. O cabeçalho usa apenas `env(safe-area-inset-top)` que pode ser zero no WebView.

**Correção versionada:** `scripts/fix-partner-motorista-settings-contrast-v4.mjs`: contraste de labels, títulos, seletores, hero branco e cabeçalho com margem segura mínima. Mantém persistência local de preferências, botões de GPS/push, links e salvamento. Escopo exclusivo do Motorista e variantes driver dos componentes compartilhados.

## 008 — Motorista — ação Excluir conta redireciona ao login

**Relato físico:** ao tocar Excluir conta, usuário relata navegação direta à tela de login em vez de confirmação visível.

**Causa no código:** rota de Configurações depende de `window.confirm` + `window.prompt` do WebView e invoca a Edge Function histórica `delete-my-account`; esta função **não consta entre as publicadas** no Supabase Corridas `tbbzkrfupmqdywnzgnms`. Existe `public.request_own_account_deletion()` autorizada para `authenticated`, que requer autenticação e rejeita corrida ativa.

**Correção versionada:** `scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs`: botão apenas abre modal React, com texto de retenção, cancelar e input controlado; só após digitar `EXCLUIR` invoca RPC autenticada. Navegação para login somente depois de `data.ok === true`, sem logout por falha. Nenhuma exclusão real executada na auditoria. Não houve teste destrutivo de integração.

## 009 — Outras opções que parecem não responder

**Estado:** os links existentes em Configurações preservam as rotas, e os controles de push, GPS, logout e salvar continuam conectados aos handlers originais. Algumas preferências locais (alertas de corrida, som, vibração e app de navegação) estão persistidas no `driverPrefs`, mas o uso operacional dessas preferências fora da tela de Configurações **não foi confirmado**. Não declarar esses recursos E2E aprovados; verificar em aparelho e nos consumidores de eventos antes de modificar notificações.

**Gate de regressão:** `scripts/verify-partner-motorista-settings-ui-v4.mjs` verifica contraste, fullscreen, links, handlers, ordem de confirmação/exclusão, ausência de `window.confirm`/`prompt` e da Edge Function legada. Preflight WEB-only GitHub #41912156364 = 3/3 SUCCESS. Não gerou APK desta revisão; tela física ainda não validada.
