# APOIS Parceiro — implementação de Teste de Status, Central de Chamadas e mapa de demanda

Data: 31/10/2026. Branch isolada: `fix/entregas-homologacao-ajustes-20261030`.
Autorização do usuário neste chat: implementar pendências. Restrição mantida: **não gerar APK nem AAB até ordem expressa para gerar**. Não houve deploy, merge, publicação ou criação de corridas/entregas/pagamentos reais para testes.

## Funcionalidades implementadas (código QA)
- Motorista: `scripts/harden-partner-motorista-demand-map-v1.mjs` mostra até 8 centros fixos aproximados de áreas de maior procura, em pontos vermelhos pulsantes, enquanto ONLINE, sem oferta, viagem ou avaliação ativa. Consulta remota a cada 30 segundos. Retorno vazio ou falha = nenhum ponto fictício.
- Motorista e Entregador: `scripts/harden-partner-operational-status-v1.mjs` fornece Teste de Status com seis verificações: conectividade, GPS, sessão, cadastro/documentos, disponibilidade e consulta à API de chamadas. Resultados individuais explicam falhas; teste não muda estado nem autorização. Não afirmar sucesso de Push apenas porque a API está respondendo.
- Motorista e Entregador: `scripts/harden-partner-available-calls-v1.mjs` exibe Solicitações Disponíveis, com consulta, distância aproximada, prazo restante e valor quando disponível, sem expor endereço/nome do cliente antes do aceite. Botão de aceite solicita confirmação server-side, mostra erro quando item expira/é assumido e reconcilia fluxo existente. A tela só consulta quando aberta e ONLINE; atualiza a cada 15 segundos.
- `scripts/build-partner-release.sh` integra os patches **somente nos workspaces temporários** dos módulos, depois dos transformadores existentes, sem modificar submódulos fontes. `scripts/verify-partner-driver-demand-zones-v1.mjs` e `scripts/verify-partner-available-calls-v1.mjs` protegem os gates.

## Migrações autorizadas e efetivamente aplicadas
- **CORRIDAS produção** (`tbbzkrfupmqdywnzgnms`):
  - `20261031153847_apois_driver_demand_zones_aggregated_20261031.sql`: agregação de áreas. Valida motorista aprovado, ONLINE, localização atualizada, identidade via `users.auth_user_id`, mínimo 3 solicitações por célula de aproximadamente 2,7 km, até 8 focos, 30 minutos e raio de 15 km. Retorna somente centro de célula e nível, sem ID, nome, endereço ou local exato.
  - `20261031155223_apois_available_ride_calls_safe_claim_20261031.sql`: listagem de corridas ainda buscando motorista e não atribuídas, não expiradas/não canceladas, categoria e raio 5 km, sem oferta válida ativa. O aceite reserva a linha sob `FOR UPDATE` e delega à RPC oficial `driver_accept_ride`, preservando checagens de assinatura, pagamento e corrida ativa.
- **ENTREGAS produção** (`ptgkwyyolrdgnqketkjj`):
  - `20261031155228_apois_available_delivery_calls_safe_claim_20261031.sql`: lista jobs searching/offered, pedidos prontos, sem entregador e sem oferta concorrente válida, respeita busca dentro do timeout oficial, GPS recente/precisão, raio da cidade e ausência de entrega ativa. O aceite trava a linha, cria oferta própria e delega à RPC oficial `accept_delivery_offer`; uma única atribuição válida.
- Os SQLs acima foram recuperados diretamente de `supabase_migrations.schema_migrations` e versionados em `supabase/migrations/` com os mesmos nomes e identificadores. As propostas anteriores sob `corridas-forward-migrations` e `entregas-forward-migrations` são **rascunhos de homologação**, não aplicar de novo.
- Após aplicação: 5 novas RPCs com `anon_exec=false` e `authenticated_exec=true`; sem autenticação as listas retornam `[]`. Concessão a authenticated é acompanhada por verificação de conta/estado/GPS/permissão dentro de cada função, não significa acesso irrestrito.
- **Nota do Security Advisor**: as cinco RPCs novas usam `SECURITY DEFINER`, necessário para ler somente estados internos e delegar às regras oficiais sem abrir SELECT de pedidos a todos. Isso gera avisos genéricos `authenticated_security_definer_function_executable` (lint 0029) nos dois bancos; foram revisados, têm checagem `auth.uid()` e elegibilidade, `search_path` restrito, sem parâmetros de identidade, sem EXECUTE a anon. Recomenda-se revisão adicional da arquitetura antes da publicação final.

## Evidências de verificação
- GitHub Actions preflight sem APK: execução `41216834315`, jobs `audit-web-only`, `WEB-only cliente`, `WEB-only estabelecimento` com **SUCCESS**.
- Logs `audit-web-only`: TypeScript/bundles Motorista e Entregador compilaram; Teste de Status inserido em ambos; central de chamadas inserida e testada com guards; mapa do Motorista integrado; verificações antigas de GPS, home Entregador, sessão, navegação e perfis passaram.
- SQL das centrais compilado em transações revertidas antes da aplicação, sem criar pedidos. Migrações e grants verificados após aplicação.
- **Não testado**: corrida e entrega reais com dois motoristas disputando aceite, retorno de GPS em movimento, cancelamento simultâneo, expiração, Push/realtime e ciclo completo de PIN no aparelho. Não simular esses eventos em produção sem combinar cenário QA autorizado.
- Atualmente não existem solicitações abertas nos bancos que comprovem a aparência de pontos ou itens na lista. A Central deve mostrar vazia em tal situação; não inventar demandas.

## Gates obrigatórios antes de homologar APK
1. Abrir Teste de Status nos dois modos, testar rede sem internet, permissão GPS e sessão expirada.
2. Validar elegibilidade: motorista/entregador offline, conta reprovada ou assinatura vencida jamais vê/aceita chamados.
3. Corrida/entrega ainda válida aparece só no raio permitido; antes do aceite, sem endereço ou identidade exata do cliente.
4. Dois profissionais clicam ao mesmo tempo: exatamente um aceita; o outro recebe mensagem de indisponível; contadores e pedidos atualizam.
5. Corrida cancelada/expirada nunca reaparece. Pedido cancelado/não pronto nunca pode ser assumido.
6. Mapa mostra só células agregadas com >=3 solicitações recentes; não revela localização individual; vazio quando não há demanda.
7. Preservar acesso Google, GPS nativo/background, recenter, navegação externa, PIN, perfil e foto, ganhos e as regras de pagamento.
8. Só gerar APK depois de autorização literal do usuário e só chamar de homologado após testes físicos.

**Estado**: código e servidor preparados, preflight WEB verde; homologação Android e testes concorrentes ainda pendentes. Sem APK e sem deploy.
