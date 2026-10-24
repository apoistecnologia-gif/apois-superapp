# APOIS Corridas — pendências críticas e critérios de aceite

Registro solicitado pelo responsável do projeto em 23/10/2026. Não apagar da lista até haver correção no ambiente real e teste físico de passageiro + motorista.

## P0 — PIN de segurança disponível imediatamente após aceite

- **Supabase produção:** `APOIS CORRIDAS - PRODUÇÃO`, ref `tbbzkrfupmqdywnzgnms`. **Nunca** executar isto em `APOIS ENTREGAS - PRODUÇÃO`.
- **Comportamento exigido:** solicitação do passageiro → oferta a motoristas aptos → motorista aceita → o código de segurança de 4 dígitos aparece **imediatamente no APOIS Cliente** → passageiro informa ao motorista **no embarque** → motorista insere código válido para iniciar viagem.
- **Segurança:** PIN protegido em `public.ride_security_secrets`, consultável apenas pelo passageiro autenticado dono da corrida; **não** enviar PIN ao motorista, não inseri-lo em `public.rides`, não gravá-lo em logs ou armazenamento local. Impedir início da viagem se PIN inválido.
- **Estado encontrado:** o gatilho já gera o segredo no aceite; a RPC de leitura `apois_rpc_private.get_passenger_ride_security_code` só permite o estado `motorista_chegou`. Portanto a alteração do APK, isoladamente, **não** resolve a regra.
- **Migração SQL aplicada em produção em 24/10/2026:** `supabase/corridas-forward-migrations/20261023211500_passenger_pin_available_after_accept.sql`. Inclui também o estado `motorista_a_caminho`; manter a checagem `r.passenger_id = public.mobility_user_id()` e `auth.uid()`.
- **Verificações SQL em 24/10/2026:** alteração aplicada somente ao projeto Corridas; definição lida antes e depois; os estados `motorista_a_caminho` e `motorista_chegou` são aceitos; verificações `auth.uid()` e `r.passenger_id = v_passenger_id` mantidas; ACLs da função privada preservadas. Função pública continua acessível a `anon`, mas a função privada nega ausência de autenticação. Registro original da função obtido para possível rollback; a versão anterior exigia apenas `r.status='motorista_chegou'`.\n- **Gates restantes:** testar aceite e leitura com duas contas autenticadas reais; confirmar que passageiro de outra corrida não acessa o PIN; confirmar validação correta no app Motorista; considerar endurecer o grant `anon` da função pública em alteração específica e testada.
- **Status:** MIGRAÇÃO DE PRODUÇÃO APLICADA / HOMOLOGAÇÃO E2E NO CELULAR PENDENTE — ainda não declarar exibição real no aplicativo comprovada.


## P0 — Busca de motoristas, expiração e notificação (24/10/2026)

- **Incidente confirmado:** corrida de 03:39:45 UTC permaneceu procurando motorista após o prazo; havia 1 candidato, 1 oferta e nenhum aceite.
- **Correção de produção executada:** migração `supabase/corridas-forward-migrations/20261024040000_expire_unaccepted_ride_searches.sql` instalada no projeto de Corridas `tbbzkrfupmqdywnzgnms`. Função privada `private.expire_unaccepted_ride_searches()` executa pelo job `apois-expire-unaccepted-rides` a cada minuto. Não aceita invocação por `anon` ou `authenticated`.
- **Validação SQL:** uma corrida realmente expirada mudou para `expired`, `cancelled_by='system'`, sem taxa, conforme trigger de state machine. Job ativo e execução em `succeeded`. Nova contagem apontou 0 buscas vencidas ainda abertas e 0 registros `expired` com `cancelled_by` diferente de `system`.
- **Notificação:** `send-ride-push` implantada em produção (versão 1, `verify_jwt=true`), com identidade do destinatário derivada do perfil interno e da entidade de motorista; source versionado em `supabase/functions/send-ride-push/index.ts`.
- **Solicitação:** `request-ride` produção versão 14 foi atualizada de forma focal para chamar push ao ofertar motorista, recusar redespacho quando corrida avançou ou expirou, respeitar tempo da oferta, evitar ofertar repetidamente ao mesmo motorista e só notificar após gravação condicional da oferta. Source versionado em `supabase/functions/request-ride/index.ts`. Foi preservada a forma existente de calcular estimativa, autenticação e criação da corrida.
- **Parceiro:** `driver_accept_ride`, `driver_reject_ride` e demais RPCs de viagem estão presentes no banco. RPCs do Parceiro são a fonte de verdade do aceite, sem necessidade de implantar Edge Function `driver-ride-action` legada. Aplicativo Parceiro usa `public.users.id` em `candidate_driver_ids` e `public.drivers.id` em `driver_id`; o código do request-ride envia os candidatos como `users.id`, compatível com a tela de ofertas.
- **Cliente:** `scripts/harden-corridas-cancellation-policy.mjs` acrescenta o estado `expired` e aciona redespacho enquanto a tela de busca estiver aberta, usando o backend como autoridade. `scripts/harden-corridas-trip-flow-ux.mjs` posiciona o botão CANCELAR CORRIDA fora da área rolável, respeitando safe area do Android. Scripts foram ajustados para não duplicar a movimentação do botão no build; a rotina posterior `harden-corridas-trip-flow-ux.mjs` mantém o rodapé com safe area.
- **Não declarar homologado sem:** executar build/testes integrais do Cliente na branch; instalar APK apenas após autorização; teste físico com motorista online e passageiro real; confirmar autorização/credenciais Firebase e recebimento FCM; verificar aceite concorrente, redespacho, taxa zero em busca expirada e botão de cancelamento; confirmar entrega dos eventos no Android em primeiro plano e segundo plano.
- **Estado:** backend de expiração implantado e validado; funções de solicitação/push ativas; correções no código Cliente versionadas. Homologação física, verificação das credenciais FCM e novo APK pendentes.

## P0 — Regressão das categorias de corrida no APK Cliente

- **Sintoma documentado:** app mostrou "Não há categorias disponíveis para esta rota no momento" na tela inicial mesmo sem destino, removendo visualmente Carro/Moto/Fretes e Mudanças/Guincho/Envios.
- **Diagnóstico de produção 23/10/2026:** `public.ride_categories` contém 5 categorias, **todas ativas**: `carros`, `motos`, `fretes`, `guincho`, `envios`. RLS permite SELECT às contas autenticadas nas categorias ativas. Não foram apagadas no Supabase.
- **Causa de UX confirmada no código:** provider inicializa lista vazia e não diferencia erro de rede da ausência legítima de categorias; visual retorna falsamente "não há categorias" sem botão de recuperar. A causa exata da consulta fracassada no aparelho requer log e teste autenticado.
- **Correção de código:** `scripts/harden-corridas-category-recovery.mjs`; recuperação após login/rede/retorno ao foreground, botão de atualizar, preservar catálogo previamente carregado, não inventar categoria ou preço.
- **Gates:** verificar no celular as cinco categorias no início, antes e depois de digitar destino; selecionar cada categoria; valores somente da API de preços; persistência após abrir outras abas e retornar; conexão temporariamente indisponível seguida de recuperação; garantir que `request-ride` recebe código de categoria do banco e que o motorista recebe a oferta.
- **Status:** CÓDIGO EM CORREÇÃO / HOMOLOGAÇÃO NO CELULAR PENDENTE.


## P1 — Contraste do endereço de partida na busca de destino

- **Evidência:** captura enviada pelo usuário em 23/10/2026 mostra campo PONTO DE PARTIDA com endereço em cinza muito claro sobre fundo branco no Cliente Corridas, na tela de busca de destino.
- **Meta:** tornar texto do endereço de partida legível em tema claro, sem alterar endereço, GPS, busca ou digitação do destino.
- **Status:** PENDENTE de implementação específica e validação física. Não confundir com a migração visual do Cliente Entregas.

## Integridade do projeto

Branch `feat/apois-cliente-red-visual-20261003`, PR #8. Não fazer merge sem autorização. Não executar workflow ou gerar APK até pedido do responsável. Não alterar regras financeiras, Supabase Entregas, credenciais ou autenticação na correção visual.
