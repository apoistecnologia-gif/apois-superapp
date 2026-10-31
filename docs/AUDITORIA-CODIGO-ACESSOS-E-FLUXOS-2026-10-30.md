# APOIS — análise de código dos acessos e jornada interna — 30/10/2026

## Base e escopo
Repositório `apoistecnologia-gif/apois-superapp`, branch `fix/entregas-homologacao-ajustes-20261030`.
Base desta etapa: `37d583b667210543aab337b2d0c02a9ca4c8dc78`.
Código corrigido: `0225ee20302c01d75041f726612c8d390d34d754`.
O proprietário confirmou que as contas já existem **no sistema atual** e pediu a análise no código. Não exigir um ambiente separado para continuar inspeção estática e testes isolados. Nenhuma conta foi acessada ou alterada nesta etapa.

Foram lidos os pins do source-lock, seus AGENTS.md, guardas de rotas, resolução de identidade, scripts que transformam o workspace e logs reais. O snapshot de origem sozinho não é o produto final: por exemplo, a busca antiga de perfil Corridas por users.id já é corrigida pelo pipeline. Não reaplicar correções concluídas.

## Mapa de acesso encontrado
| Superfície | Identificação e liberação observadas no código | Fonte principal / limite |
| --- | --- | --- |
| Cliente Corridas | AuthProvider resolve public.users por auth_user_id; consumidores de corridas/histórico usam profile.id, o ID de domínio. Só libera estado autenticado após resolver o perfil | scripts/harden-corridas-auth-profile-resolution.mjs; aplicação confirmada no log Cliente 124401463348 |
| Cliente Entregas | Sessão própria do módulo, rotas permitidas por produto; endpoints de pedidos validam JWT e combinam ID do pedido com customer_user_id | src/lib/product-routing.ts do pin Entregas; scripts/verify-backend-authorization-boundaries.mjs verifica contratos do workspace. Não é consulta à política atualmente implantada |
| Motorista | Login exige sessão e loadDriverProfile(); driver_get_profile é a consulta canônica; aprovação leva ao app e demais estados levam ao acompanhamento cadastral | src/routes/motorista.login.tsx e src/lib/driverProfile.ts do pin Motorista/Admin, adaptados pelo pipeline já existente |
| Entregador | getUser(), couriers.user_id = authUser.id, documentos por courier_id; operação normal condicionada a cadastro aprovado e ativo | src/routes/courier.tsx do pin e scripts/fix-partner-courier-*.mjs |
| Estabelecimento | Sessão + getUser(); merchant_members pelo user_id, status active; entidade por member.merchant_id. Dados privados via get_authorized_merchant_private_data; operação depende de aprovação/atividade | src/routes/merchant.tsx, especialmente loadAll e guardas de aprovação |
| Admin Entregas | Sessão e registro user_roles correspondente ao mesmo auth user com role admin; ausência de papel redireciona sem liberar workspace | src/routes/admin.tsx, beforeLoad |
| Admin Corridas | getUser(), RPC admin_is_authorized, profiles.user_id, active=true, role_permissions. Não confundir com a tabela user_roles de outro contexto | src/lib/adminAccess.ts do pin Motorista/Admin |

Essas evidências confirmam a arquitetura de acesso. Não identificam senhas nem comprovam quais usuários estão cadastrados no banco vivo. A autorização de servidor/RLS só pode ser declarada testada em execução real se isso realmente ocorrer; nesta etapa houve leitura de contratos e gates, sem acesso ao banco.

## Fluxos internos revisados
- Corridas: resolução AUTH→DOMAIN→DRIVER, ciclo de vida monotônico, recuperação de sessão, consulta protegida do PIN após aceite e histórico do próprio passageiro. Logs Cliente confirmam aplicação dos hardeners de identidade, histórico, carteira e verificadores existentes.
- Entregas Cliente: refresh de pedido e feedback de delivered em fix-entregas-customer-delivery-tracking-v1.mjs; mapa/PIN preservados por seus gates. Não houve pedido real.
- Entregador: aceite, deslocamento, retirada e finalização por PIN. A simplificação visível mantém os estágios backend: accepted→arriving_pickup→at_pickup→picked_up→on_the_way→arrived_destination→complete_delivery_with_pin. Não foi adicionado botão/etapa.
- Perfil Entregador: edição restrita a contato/avatar e campos de identidade/aprovação não editáveis pela UI. A política de avatar continua versionada e não aplicada; sucesso real de Storage não foi testado.
- Painéis: identificação por membro/papel e separação de permissões revisadas no código. Telas privadas dos painéis não foram renderizadas com login nesta etapa.

## EM-FUNC-040 — travamento do Entregador após atualização realtime
**Severidade:** P1, CORRIGIR. **Estado:** corrigido e validado em teste isolado e build WEB; não reproduzido em conta/dispositivo reais.

### Antes
Em scripts/fix-partner-courier-simple-journey-v1.mjs, o efeito automático põe busy=delivery e chama courier_transition_delivery para arriving_pickup.
O realtime pode atualizar o status antes de a promessa terminar; a dependência activeJob.status encerra o efeito e define disposed=true.
O finally antigo liberava busy apenas quando !disposed. Resultado: os botões podiam permanecer desabilitados mesmo após resposta ou erro da operação.

### Correção
- Cada tentativa automática agora recebe um contador em startingNavigationAttemptRef.
- O finally libera o busy da sua própria tentativa mesmo se houve cleanup por mudança de status.
- Se outra entrega iniciou tentativa mais recente, a resposta antiga não a libera.
- Reload e toast continuam respeitando a descarte do efeito. Nome/argumentos de RPC, estágios, PIN e regras financeiras permaneceram iguais.
- Nenhum novo estado é gravado no backend; o contador existe somente na memória do componente.

### Reprodução e regressão
scripts/test-courier-navigation-busy-v1.mjs extrai o efeito real gerado pelo script. Executa com lifecycle controlado, promessas adiadas e RPC substituída localmente, sem importar cliente Supabase nem fazer rede.
Remove apenas a anotação TypeScript do catch para a execução Node; não reescreve a lógica testada.
| Cenário | Script anterior | Corrigido |
| --- | --- | --- |
| Resposta normal libera controles e recarrega | PASS | PASS |
| Cleanup por realtime antes da resposta | FAIL: busy=delivery | PASS |
| Resposta antiga não libera tentativa de entrega nova | PASS | PASS |
| Rejeição após cleanup libera controles | FAIL: busy=delivery | PASS |

Antes: 2 PASS / 2 FAIL, exit 1. Depois: 4 PASS / 0 FAIL, exit 0. Nenhum teste foi ignorado.
O teste foi acrescentado ao preflight WEB existente, antes do build.
A comparação desta correção modifica somente o script de jornada, o novo teste e uma linha do workflow permitido. Nenhum sources/, banco, migration, API financeira ou configuração de produção mudou.
Reversão disponível por commit de revert de 0225ee2030 na branch de homologação; não foi executada.

## Evidência oficial
[GitHub Actions 41155555285](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41155555285): completed / success, três jobs conferidos.
- audit-web-only: novo teste 4/4, gates Parceiro, typechecks, bundles Motorista/Entregador e navegador público aprovados.
- WEB-only cliente: Corridas/Entregas, gates de identidade/segurança/lifecycle e navegador público aprovados.
- WEB-only estabelecimento: testes/typecheck/builds Estabelecimento e Admin Entregas aprovados.
- O gate de navegador mantém 12 casos / 32 ações públicas. Não equivale a teste autenticado.
- Lint e instalação frozen do Entregas continuam com as ressalvas herdadas dos relatórios anteriores. CI verde não implica lint aprovado.
- Nenhum APK/AAB, deploy, merge, migração remota, pagamento ou operação nas contas existentes.

## Continuidade e prontidão
A análise de código pode continuar com as contas no sistema atual; a informação do usuário substitui a suposição de que seria necessário criar outra estrutura.
Permanecem sem execução autenticada real: fluxo completo de corrida/entrega, perfis, avatar/RLS, isolamento de papéis no banco vivo, painéis privados e efeitos externos.
Não afirmar auditoria integral, homologação de produção ou ausência de todos os bugs.
Não gerar APK até autorização. GPS/push/background/OAuth nativo e safe-area física serão testados na fase nativa, não são provas produzidas por build WEB.
