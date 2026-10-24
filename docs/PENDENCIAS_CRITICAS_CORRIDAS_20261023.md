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


## P0 — Busca de motorista sem encerramento após prazo

- **Evidência de 24/10/2026:** corrida de 03:39:45 UTC permanecia em `procurar_motorista` após `search_expires_at=03:42:45 UTC`; foi registrado 1 candidato, 1 motorista ofertado e nenhum aceite. Não publicar identificadores do passageiro.
- **Causa operacional encontrada:** `process-ride-dispatch` está no snapshot Corridas e implementa expiração/redistribuição, porém NÃO consta entre as Edge Functions ACTIVE do Supabase Corridas produção `tbbzkrfupmqdywnzgnms`. As extensões `pg_cron` e `pg_net` não estão instaladas, portanto não existe agendamento por essas extensões. Ainda verificar outros agendadores externos antes de concluir ausência total de worker.
- **Problema adicional da função versionada:** o código legado atribui `cancelada_passageiro` quando a busca expira sem aceite, embora `cancelled_by=null`; não lançar multa nem tratar expiração como desistência do passageiro. Comparar com a state machine e as regras de faturamento reais antes de implantá-la.
- **Correção visual versionada:** `scripts/harden-corridas-cancellation-policy.mjs`, marcador `APOIS_CANCEL_BUTTON_STICKY_V1`, deixa o botão de cancelar fora do painel rolável em `procurar_motorista` e `motorista_a_caminho`, preservando diálogo e API `cancel-ride`.
- **Status:** BOTÃO CORRIGIDO NO CÓDIGO. STATUS `expired` IMPLEMENTADO NO WORKSPACE VIA HARDENER (sem deploy): trigger de produção exige `cancelled_by='system'` e permite `procurar_motorista → expired`; atualização visual/normalização de status também versionada. Sem novo APK. BACKEND DE EXPIRAÇÃO/REDESPACHO NÃO CORRIGIDO EM PRODUÇÃO. Antes de deploy, verificar worker canônico, execução autenticada, elegibilidade, concorrência, estado terminal correto, ausência de cobrança indevida e notificação ao passageiro. Testes E2E pendentes.

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
