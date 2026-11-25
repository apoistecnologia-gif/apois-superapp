# Dimensionamento e orçamento — planejamento, não contratação
Meta registrada no README do laboratório: R$ 5 por motorista ativo/mês. O teto mensal é N × R$ 5, não previsão de preço ou de faturamento. O modelo separa volume de rotas, pico, limite configurado, carga local observada e custo. Nenhum preço de provedor embutido.
Hipóteses ilustrativas, não telemetria: 26 dias/mês, 8 corridas/dia por motorista, duas fases (embarque e viagem), 0,5 recálculo médio por fase, 15% do volume diário na hora de pico, multiplicador de rajada 3 e reserva de 25%. A política experimental de recálculo limita pedidos por fase; média real deve vir de homologação. O gateway e SQLite default continuam em 60/min global, quatro simultâneas. Não alterar automaticamente.
| Motoristas ativos | Rotas/mês | Pico/min com reserva | Teto mensal |
|---:|---:|---:|---:|
| 20 | 12.480 | 5 | R$ 100 |
| 100 | 62.400 | 24 | R$ 500 |
| 500 | 312.000 | 120 | R$ 2.500 |
| 1.000 | 624.000 | 240 | R$ 5.000 |
A partir de 500 neste cenário, o limite global default é insuficiente; não equivale a limite do hardware. O benchmark autenticado 45617361926 ainda não concluído no momento da redação. O modelo aceita apenas relatório local completo (sem falhas), extrai bytes médios de corpo e carga oferecida observada; não certifica produção nem presume capacidade máxima.
Custos devem incluir servidor, armazenamento/backup, redundância, distribuição de PMTiles, egress, DNS/TLS, monitoramento, operação, autenticação real, geocodificação independente e impostos. Informe custos fixos agregados e variável por mil rotas explicitamente; se faltar custo, egress ou mapas, o resultado fica desconhecido. Bytes de payload não incluem overhead de rede, atualizações e downloads repetidos; considerar no orçamento. Não há preços verificados, contratação ou escolha de provedor. Não use R$ 5 como promessa comercial antes da medição física, teste prolongado, orçamento completo e aprovação.
Teste: node --test labs/apois-navigation/capacity/model.test.mjs.
