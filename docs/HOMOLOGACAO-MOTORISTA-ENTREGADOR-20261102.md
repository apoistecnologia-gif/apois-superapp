# APOIS | Homologação Motorista e Entregador | 02/11/2026

## Escopo e proteção
Integração: `apoistecnologia-gif/apois-superapp`, branch `fix/entregas-homologacao-ajustes-20261030`.
Todas as alterações de interface e registro são aplicadas apenas nas cópias descartáveis do Motorista e Entregador criadas por `scripts/build-partner-release.sh`; fontes/submódulos protegidos inalterados. **Nenhuma migração aplicada em produção. Nenhum novo APK autorizado nesta etapa.**

## Cadastro do Motorista: fatos verificados
- Supabase Corridas: `tbbzkrfupmqdywnzgnms`.
- `public.drivers`: três cadastros, nenhum criado nos últimos sete dias.
- `auth.users`: nenhuma conta nova associável ao teste de 02/11; último registro de autenticação observado em 28/10 (sem perfil interno, metadata de role ausente; sem evidência de que pertença ao teste).
- `driver_complete_registration_v3` exige `public.users`, falhando `profile_missing` se inexistente.
- `public.handle_new_user()` existe, porém não foi encontrado gatilho em `auth.users`.
- **Não afirmar que a ausência do gatilho foi necessariamente a causa do teste anterior:** o APK V4 podia reportar "conta criada" sem sessão, sem criar novo usuário, especialmente quando o endereço já existe.
- A aprovação de um motorista existente não deve ser reiniciada por novo cadastro.

## Ajustes registrados no código
- Autenticação V5 e pré-validação V6: tentar conta já existente, não afirmar cadastro sem sessão; checar `mobility_user_id` e `driver_get_profile` antes de upload; impedir duplicidade ou sobrescrita de motorista aprovado; conferir recibo de RPC.
- Fotos no Android: Camera/galeria nativas, visual branco/vermelho, 13 fotografias e correções; já houve teste físico positivo de anexo de foto em versão anterior, mas cadastro final falhou.
- Menu lateral: recuperar `DriverSideMenu` na página do mapa, Financeiro, Carteira e páginas com `MovviHeader`; barra inferior desativada, `DriverActiveRideRecovery` preservado.
- Teste de Status: limitar consultas que possam travar e preservar resultados quando servidor falhar.
- Histórico/Financeiro/Notificações/Perfil: contraste elevado e prévia de perfil próprio com campos públicos apenas.
- Entregador: indicador verde de varredura no estado online sem entrega; verificação remota real em `courier_availability`.

## Atualização de produção — 02/11/2026 (autorizada)
- Autorização explícita recebida para **somente** corrigir a criação do perfil interno em novos cadastros de Motorista.
- Migração aplicada com sucesso no Supabase Corridas `tbbzkrfupmqdywnzgnms`: `apois_corridas_driver_auth_signup_profile_trigger_20261102`.
- Trigger `auth.users / AFTER INSERT / apois_driver_auth_signup_profile` ativo, condição de execução `raw_user_meta_data->>'role' = 'driver'`, função existente `public.handle_new_user()`.
- Auditoria pós-migração: três registros em `public.drivers`, 11 em `auth.users`, 10 perfis internos ativos; **zero** contas de Auth com metadata `role=driver` sem perfil correspondente.
- Não foram criados novos usuários, alteradas aprovações, migrado Entregas ou gerado APK. Não há teste funcional com novo cadastro após esta ativação. O gatilho atua apenas em novas inserções, não realiza backfill.

## Histórico do SQL de revisão (agora aplicado com aprovação)
Arquivo de revisão: `database/review/20261102_corridas_driver_signup_profile_trigger_REVIEW_ONLY.sql`.
Esse SQL prepara somente o gatilho de criação do perfil **para novas contas com role driver**, reutilizando `public.handle_new_user`. A aplicação autorizada do gatilho foi concluída em 02/11/2026, conforme registro acima. Não executar etapa 2 ou backfill genérico. O gatilho não resolve contas antigas sem perfil.

## Gates de verificação sem APK
- Inspeção read-only de funções, permissões e contagens no Supabase concluída.
- Validação de sintaxe dos scripts V5/V6, menu, contraste, varredura e status concluída.
- Simulação in-memory da proteção V6 e dos patches de menu e Histórico concluída no código fonte fixado.
- **Não foram executados build completo, testes E2E autenticados ou verificação física dessa nova consolidação.**

## Plano de homologação após autorização
1. Confirmar correção de perfil no Supabase sem alterar outros produtos, preservar evidência anterior.
2. Gerar uma única APK de teste do Parceiro pelo workflow existente somente após autorização.
3. Testar login com conta existente sem redefinir sua aprovação; para novo cadastro de teste, utilizar e-mail de teste dedicado apenas após o fluxo corrigido.
4. Conferir resultado em `auth.users`, `public.users`, `public.drivers`, registros de vistoria e Admin Corridas.
5. Validar 13 fotos por câmera/galeria, máscara DD/MM/AAAA, maiúsculas (exceto e-mail/senha), saída da etapa 3.
6. Testar mapa, navegação lateral, status, financeiro, Histórico, Notificações, perfil público.
7. No Entregador, validar busca efetiva de pedidos e varredura verde somente quando online/ocioso; estado online concordando com `courier_availability`.
8. E-mail: usar exclusivamente motorista de teste com autorização e fluxo administrativo servidor autenticado; não confundir e-mail de confirmação da conta com e-mail de pendência Resend.

## Restrições
Não disparar APK, aplicar migrações, conceder acesso de administrador, mudar aprovação de motoristas, liberar saque ou alterar provedores de pagamento durante esta etapa.
