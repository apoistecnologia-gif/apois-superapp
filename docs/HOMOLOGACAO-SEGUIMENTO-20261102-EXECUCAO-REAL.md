# APOIS — continuidade real da homologação (02/11/2026, fuso America/Fortaleza)

**Único repositório alterado:** `apoistecnologia-gif/apois-superapp` na branch `fix/entregas-homologacao-ajustes-20261030`.
**Último HEAD de código validado:** `404aa1bf39ccf0d93101f1ba83f09961f238402a`.
**Execução de preflight:** https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41564251300 — **3/3 sucesso**, WEB-only, sem APK.
**Condição de homologação Android:** NÃO LIBERADA. Não houve merge, publicação, deploy manual, SQL DDL, estorno ou alteração de aprovação, estado de cliente ou saldo.

## Escopo e preservação

- Supabase Corridas: `tbbzkrfupmqdywnzgnms`; Supabase Entregas: `ptgkwyyolrdgnqketkjj`.
- Sem alteração dos repositórios-fonte protegidos, source-lock e submódulos. O diff final contém código de teste e um webhook de homologação, sem alterar o binário/fonte oficial.
- Migrações já aplicadas em Corridas `20261103013336` e `20261103013400` confirmadas no histórico; não reaplicadas.
- Gateway eletrônico escolhido: Safe2Pay; não reativar Asaas/OpenPix/Mercado Pago.

## Correção do webhook — somente versão preparada, não implantada

Arquivo `supabase/functions/safe2pay-webhook/index.ts` adicionado à branch a partir do conteúdo ativo. Corrige reenvio quando uma escrita intermediária falha, não confia em `processed_at` isolado, usa `event_key` idempotente, confere linhas realmente atingidas, mantém atualizações concorrentes condicionais, verifica se o domínio corresponde a método/estado e evita regravar um pedido/corrida já pago ou estornado.

**Prova:** `scripts/test-safe2pay-webhook-retry-v1.mjs` passou com **10 cenários simulados** no gate original `npm run audit:payment-boundary`, incluindo segredo inválido, falhas parciais, reenvio, atualizações de zero linhas, estado fora de ordem, estorno, discrepância de referência e falha ao concluir evento. O gate original de `package.json` foi mantido. A versão ativa nas duas Edge Functions foi reinspecionada e permanece com SHA `2f1e58d94c1dfe3990aba6a21b5157d0b147e190cc72425ea55290f40a16bf71`; nenhuma Edge foi redeployada.

**Bloqueio:** a solução preparada ainda usa várias escritas independentes e NÃO constitui atomicidade PostgreSQL entre transação, pedido/corrida e evento. Exige RPC/transaction revisada, conciliação com provedor, testes reais isolados e decisão explícita de deploy. **Não implantar a Edge Function como está.**

## Corridas: cadastro e vistoria

- Função ativa `apois_rpc_private.driver_complete_registration_v3` rebaixa o motorista aprovado em um UPSERT; comprovado em `pg_get_functiondef`.
- Proposta de proteção `database/review/20261102_driver_complete_registration_v3_approved_guard_REVIEW_ONLY.sql` segue **NÃO APLICADA**.
- Adicionado `scripts/test-driver-registration-guard-review-v1.mjs` e integrado ao preflight existente `scripts/audit-partner-preflight-v1.mjs`: verificações estáticas de lock `FOR UPDATE`, bloqueio `aprovado/suspenso/bloqueado` antes de alterar `users/user_roles/drivers`, sete fixtures de status e preservação de regras antigas. Gate aprovado em 41564251300. **Não é teste E2E PostgreSQL.**
- Consulta real sem alterações: **2** contas com papel `driver` sem linha em `drivers`; **3** motoristas `carros` aprovados sem linha de foto de inspeção (legados). Buckets `apois-inspections` privado, zero objetos; zero fotos, zero solicitações de correção e zero eventos de revisão na nova estrutura.
- Os três triggers de Stage2 (vistoria, snapshot frontal, correções) não constam ativos na tabela `drivers`; migração `20261031_vehicle_13_photos_STAGE2_ONLY_AFTER_APP_RELEASE.sql` permanece **não aplicada** para preservar cadastros legados. Fluxo de compressão/upload/revisão é verificável em código e bundle WEB, não em telefone real.

## Privilégios pendentes — NÃO ALTERADOS

**Corridas:** `public.get_asaas_subaccount_secret(uuid)` e `public.store_asaas_subaccount_secret(uuid,text)` possuem `EXECUTE` concedido a `anon` e `authenticated`. Sem chamadores de outras funções PostgreSQL identificados em busca somente de leitura. Revisão em `database/review/20261102_corridas_asaas_vault_rpc_privileges_REVIEW_ONLY.sql`.

**Entregas:** `public.dispatch_delivery_job_offers(uuid)`, `public.ensure_cancelled_paid_order_refund(uuid)`, `public.reserve_paid_order_merchant_net(uuid)` e `public.reverse_paid_order_merchant_reserve(uuid)` permanecem com `EXECUTE` amplo. Chamadores internos de dispatch/reserva envolvem funções `SECURITY DEFINER` (entre elas `merchant_request_courier`, `set_courier_online`, `reject_delivery_offer`, `dispatch_new_delivery_job`, triggers). **Não revogar indiscriminadamente sem E2E e rollback.** Revisão em `database/review/20261102_entregas_privileged_rpc_least_privilege_REVIEW_ONLY.sql`. As tentativas anteriores foram bloqueadas pelas ferramentas; não contornar.

## Histórico financeiro a conciliar, sem executar estornos

Na base Entregas, **2** pedidos cancelados e marcados como pagos possuem **2** pagamentos OpenPix registrados, total nominal **R$ 149,60**, de **16/08/2026**, com duas referências distintas, dois eventos `OPENPIX:CHARGE_COMPLETED` processados, e **0** registros de estorno. Não há prova suficiente para concluir recebimento efetivo, origem produção/teste ou reembolso externo. Precisa extrato da adquirente / conciliação documental; nenhum saldo, pedido ou pagamento modificado.

## Admin e homologação real

O build de Admin Corridas tem correções em workspace isolada e autorização privada de documentos preparada. A inspeção conectada do projeto Vercel QA identificado historicamente (`apois-corridas-admin-homologacao`, equipe antes documentada) retornou **404 project_not_found** nesta sessão; não é possível comprovar seu deploy atual ou realizar E2E autenticada. Não ajustar produção para resolver erro de preview sem confirmar conta/equipe/projeto.

O preflight 41564251300 comprova três jobs WEB (Cliente, Estabelecimento/Admin Entregas, Parceiro/Admin Corridas) e screenshots anônimos em navegador, não GPS real, push em background, Safe2Pay real, upload físico das 13 imagens, revisão Admin autenticada, PIN/corrida física ou tela de recuperação móvel.

## Próximos gates antes de APK

1. Resolver as seis RPC privilegiadas com revisão de funções chamadoras, permissões mínimas, rollback, intervenção autorizada e testes isolados.
2. Implementar e homologar conciliação Safe2Pay atomicamente no PostgreSQL; bloquear liberação do webhook staging enquanto ela estiver incompleta.
3. Aplicar a guarda do cadastro apenas após homologação PostgreSQL com diferentes estados, garantindo não rebaixar aprovados.
4. Testar o fluxo de 13 fotos no Android com conta de teste, Storage/Admin, reprovações/reenvios, notificações e compatibilidade legada antes de Stage2.
5. Validar Vercel QA com projeto/equipe realmente acessíveis, segredos apenas server-side e E2E de Admin; verificar telas e fluxo operacional em Android físico.
6. Validar OpenPix por prova externa antes de qualquer estorno, mantendo ledger/saldos intactos.

**Proibido afirmar liberação de APK enquanto os gates acima estiverem pendentes.**
