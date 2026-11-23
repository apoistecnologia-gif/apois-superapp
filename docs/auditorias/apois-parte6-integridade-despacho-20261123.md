# APOIS — Parte 6: integridade do despacho, GPS e recuperação de busca

Base: branch fix/apois-dispatch-integridade-20261123, derivada do PR #17. Nenhum dado, serviço, webhook, cron, migração ou pagamento de produção foi modificado.

## DISP-001 (P1): autooferta ao próprio passageiro
CONFIRMADO NO CÓDIGO. O despacho antigo em supabase/functions/request-ride/index.ts exclui drivers.user_id igual a rides.passenger_id; o novo motor em supabase/functions/_shared/dispatch-engine.ts não aplicava essa exclusão. Ambos são public.users.id segundo as FKs da produção. Um usuário com as duas funções poderia receber a própria oferta.
CORREÇÃO: acrescentar passenger_id ao contrato DispatchRide, obtê-lo de rawRide.passenger_id do banco e excluí-lo da elegibilidade de candidatos. Identidade ausente bloqueia novas ofertas.
TESTE: scripts/qa/test-apois-dispatch-integrity-v1.test.mjs cobre autooferta, candidato alternativo e recusa de identidade ausente.

## DISP-002 (P1): GPS nulo interpretado como zero
CONFIRMADO NO CÓDIGO. Number(null) e Number(' ') geravam zero em finite(). Coordenadas ausentes podiam entrar na seleção como número válido.
CORREÇÃO: rejeitar null/undefined, texto vazio e whitespace; validar limites WGS84 e o par (0,0) para o ponto de origem, a posição do motorista e o destino de uma corrida ativa. Não altera raio de oferta, assinatura, modalidade nem regras de cancelamento.
TESTE: importar o motor TypeScript real com Node 22 --experimental-strip-types e verificar GPS inválido, expiração, exclusões, categoria e motorista em viagem.
CORREÇÃO COMPLEMENTAR: o fluxo de primeira oferta em supabase/functions/request-ride/index.ts também aceitava GPS sem data (last_location_at nulo) e coordenadas nulas convertidas a zero. O filtro dessa função agora requer posição WGS84 válida, timestamp presente, com máximo de 120 segundos de idade e tolerância de até 30 segundos no futuro. Os testes extraem e executam o filtro real da função versionada, não uma cópia manual.

## DISP-003 (P1): busca inserida sem oferta inicial
CONFIRMADO POR CRUZAMENTO DE CÓDIGO. request-ride grava uma corrida com search_expires_at, inicialmente sem request_expires_at, e tolera falha de dispatch() com .catch(() => []). O recuperador anterior buscava somente request_expires_at vencido, deixando de fora NULL.
CORREÇÃO: o scan de driver-redispatch-recovery inclui prazo de oferta NULL ou vencido, com carência de 10 segundos da criação tanto na query quanto na leitura final. Mantém CAS existente, limite de tentativas, exclusão de ofertas ativas, busca expirada e corridas reservadas.
TESTE: corrida com NULL deve ser redistribuída após carência; corrida criada há 3 segundos não deve ser processada.

## Bloqueios de liberação reforçados
O verificador scripts/audit-apois-production-readiness-v1.mjs exige inventário recém-verificado do deploy: dispatchSelfOfferAndGpsGuardsDeployed e requestRidePriceConfirmationDeployed; além de partnerAndroidE2EPassed e passengerAndroidE2EPassed comprovados em aparelho real.
Essas confirmações não podem ser deduzidas do CI WEB. Persistem os bloqueadores anteriores: quatro Edge Functions ausentes do Motorista, função finalizadora da fila, consumidor agendado, no-show com migração protegida, Safe2Pay atômico e testes Android físicos.

## Ordem de implantação segura — não executada
1. Validar as transições, permissões e CAS com Postgres de homologação isolado, sem pagamentos ou contas reais.
2. Homologar dispatch-ride atualizado e verificar que o passageiro não recebe a própria oferta; incluir GPS ausente e duas tentativas concorrentes.
3. Homologar recusa, cancelamento, finalização de fila e recuperação de busca, inclusive NULL de request_expires_at e perda de resposta HTTP.
4. Ativar consumidor autenticado server-to-server somente depois de testar o agendamento e os limites; nunca publicar service role em frontend.
5. Executar E2E Android para Push, background GPS, Maps/Waze, espera de no-show, código PIN, reconexão e aceite simultâneo.
6. Planejar rollback de cada Edge Function, confrontar versão publicada com o inventário atualizado e executar o release gate. Safe2Pay requer sequência financeira separada.

Status: patches em revisão e CI WEB; não é prova de backend/Android em produção.
