# APOIS Entregador — auditoria visual e técnica do vídeo 1001992572.mp4

**Data:** 06/11/2026. **Duração:** 64,25 segundos, resolução 1080×2400. **Escopo:** APOIS Entregador, quatro abas, sem alteração em produção.

**Fonte canônica:** submódulo `apoistecnologia-gif/apois-entregas`, commit pinado `2f4606e0fb52dffb49f2e6aebbe921ce687ab625` integrado pelo repositório `apoistecnologia-gif/apois-superapp` na branch isolada `fix/apois-corridas-e2e-homologacao-20261106`.

## Sequência observada

- 00–12 s: login APOIS Entregador via Google e seleção de conta, depois tela de carregamento.
- 14–22 s: tela inicial e mapa; status OFFLINE, botão para ficar disponível e atalho Solicitações disponíveis.
- 24–30 s: modo ONLINE, GPS ativo, varredura de ofertas, métricas Ganhos hoje / Entregas hoje / Tempo online. O vídeo não comprova chegada de uma oferta real.
- 32–34 s: aba Entregas, histórico de três entregas concluídas, estimativa listada de R$ 0,00 e pedidos com estimativa de R$ 0,00.
- 36–40 s: aba Ganhos com recebimento direto em homologação, quadro PIX/saques de contraste insuficiente e histórico de um crédito positivo de R$ 5,00.
- 42–50 s: aba Perfil com documentos aprovados, mensalidade Entregador R$ 49,90 para novos contratos, diagnóstico, carteira, alternância Motorista/Entregador e logout.
- 52–58 s: diagnóstico de seis verificações acusa internet sem conexão apesar de autenticação, localização, disponibilidade e API de chamadas constarem como OK.

## Verificação do Supabase ENTREGAS (somente SELECT)

Projeto de produção: `ptgkwyyolrdgnqketkjj` (sem escrita).

- `delivery_jobs`: exatamente três registros com status `delivered`; todos com `estimated_earnings = 0`.
- `orders` vinculados aos registros: soma de `courier_earnings = 0`, sem registros positivos.
- Não há lançamento em `wallet_transactions` referenciado ao pedido dessas três entregas com o mesmo entregador na consulta agregada realizada.
- O crédito da carteira exibido no vídeo **não deve ser somado às estimativas** nem automaticamente atribuído aos pedidos; origens diferentes.
- `get_courier_metrics.completed_deliveries` soma **todas** as entregas `delivered`, sem filtro diário. Logo a legenda antiga “Entregas hoje” era objetivamente incorreta.
- `earnings_today` e `online_seconds_today` são campos limitados ao período diário; estes foram preservados.

## Correções implementadas no código-fonte de integração

| ID | Evidência | Correção | Estado |
|---|---|---|---|
| EN-01 | Internet “sem conexão” com servidor autenticado e consultado | Diagnóstico considera evidência real das consultas autenticadas além de `navigator.onLine` | Implementado, não validado em APK |
| EN-02 | “Entregas hoje: 3” enquanto contagem corresponde ao total histórico | Renomeado para “Concluídas (total)” preservando campo e backend | Implementado, não validado em APK |
| EN-03 | Três entregas com R$0,00 vs crédito de carteira R$5,00 | Histórico passa a distinguir “Estimativas nas entregas” de “Saldo atual na carteira”, alimentado pelo estado existente em modo **somente leitura**, com nota sobre fontes diferentes | Implementado, não validado em APK |
| EN-04 | Aviso Pix/saques escuro com texto quase invisível | Fundo claro, texto escuro, borda visível e CSS com escopo restrito ao aviso | Implementado, não validado em APK |
| EN-05 | Texto do banner afirmava que ganhos estavam registrados por entrega concluída apesar das estimativas zero | Esclarecido que histórico de entregas e lançamentos financeiros são registros diferentes | Implementado, não validado em APK |

### Arquivos afetados

- `scripts/fix-apois-courier-video-audit-20261106-v1.mjs` (somente `.work/partner-entregador`).
- `scripts/verify-apois-courier-video-audit-20261106-v1.mjs` (gates estáticos).
- `scripts/build-partner-release.sh` (inclusão do ajuste e teste após hardeners anteriores; **não foi executado**).

Os arquivos gerados pelas transformações seriam: `src/components/ApoisStatusCheck.tsx`, `src/components/CourierPremiumViews.tsx`, `src/components/CourierPanels.tsx`, `src/routes/courier.tsx` e `src/system-theme.css`. O submódulo canônico não foi alterado e a produção permanece intacta.

## Preservação e limites

- Login Google, cadastro/documentos, online/offline, GPS, busca de ofertas, coleta, PIN de entrega, conclusão de pedidos e notificações mantidos.
- Recebimento direto ainda em homologação; nenhum saque/Pix foi ativado, nenhum ledger/valor recalculado, nenhuma taxa ou assinatura modificada.
- Mensalidade Entregador R$ 49,90/mês para novas contratações, conforme tela, preservada.
- Navegação inferior com quatro abas (Início, Entregas, Ganhos, Perfil) preservada. Não houve demonstração de todas as páginas internas possíveis nem teste completo de botões do Perfil.
- Google OAuth exibe o domínio técnico do Supabase na seleção de conta; personalização da tela OAuth não foi alterada, pois requer configuração de serviço externo.
- Houve **simulação controlada das transformações com base no source pinado e nos templates dos hardeners**, que passou, mas não compilação real. O teste completo do workspace, TypeScript, push e Android **não foi realizado**.

## Pendências para homologação

- Com contas QA, verificar entrada de nova oferta online, aceitação/rejeição, atribuição de loja, etapas da entrega, PIN, GPS com aplicativo em segundo plano e push fechado.
- Auditar geração de valores em novas entregas: não presumir que `estimated_earnings=0` significa pagamento de R$ 0,00 ao entregador; verificar cálculo e persistência antes do go-live.
- Verificar no dispositivo que o diagnóstico de internet e o contraste visual funcionam após as correções.
- Confirmar no servidor os marcos da assinatura mensal, bloqueios e regras de recebimento direto antes de lançar cobranças.
- O botão de troca entre Motorista e Entregador e os campos de edição do Perfil não foram exercitados até o fim no vídeo.

**Estado:** correções de fonte implementadas na branch; homologação funcional pendente. Nenhum APK, AAB, deploy ou migration executados.
