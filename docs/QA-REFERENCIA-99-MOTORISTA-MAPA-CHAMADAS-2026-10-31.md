# APOIS Parceiro — estudo de referência visual (vídeo aplicativo 99)

## Origem e escopo
- Vídeo recebido pelo usuário: `205715.mp4`, duração aproximada 24,45 segundos, gravação vertical.
- Apenas referência de jornada e usabilidade. Não copiar logomarca, cores, layouts originais, códigos, fluxos internos ou marcas da 99.
- Permitido documentar e preparar ajustes na branch de homologação. **Não gerar APK/AAB, deploy, merge ou migrations SQL sem nova autorização.**

## Observações visíveis no vídeo (não extrapolar)
- 00–02s: mapa do motorista, indicador Buscando e valor resumido no topo.
- 02–05s: tela Solicitações, estado "Ainda buscando solicitações", botões "Mapa de Chamadas" e "Atualizar", escolha/ordenação "Km até o embarque".
- 06–07s: Configurar solicitações → Preferências de serviços, Definir meu destino, Teste de status, Eventos futuros e Desconectar.
- 08–13s: Teste de status em 6 verificações: internet, localização, perfil, documentos, status da solicitação, configurações da solicitação; resultado "Perfeito".
- 16–22s: menu lateral com porcentagem de aceitação e finalização, Ganhos, Recompensas, Meus seguros, Indique um amigo, Central de Ajuda, Notificações, Central de Educação, Loja 99, Veículo, Horas dirigindo, Preferências; retorno ao mapa Buscando.
- **O vídeo não abre uma lista de corridas não aceitas nem demonstra aceite manual de uma solicitação abandonada**. "Mapa de Chamadas" não comprova a existência dessa fila; implementação de uma central APOIS é requisito próprio sugerido pelo usuário.

## Auditoria APOIS existente, sem alterações
### Motorista/Corridas
- Build `scripts/build-partner-release.sh` mantém isolamento de Motorista e Entregador.
- `scripts/harden-partner-motorista-offer-fallback.mjs`: fallback de consulta de ofertas com intervalo de 4 segundos; push/Realtime e retomada já existem.
- `scripts/harden-partner-motorista-active-resume.mjs`: ressincroniza ao receber push.
- `scripts/verify-corridas-dispatch-ux-v1.mjs`: busca expira sem aceite e redespacho seguro.
- Banco Corridas tem `rides`, `driver_accept_ride`, estados `procurar_motorista` e `expired`; migração `20261024040000_expire_unaccepted_ride_searches.sql` termina buscas expiradas. **Nunca ressuscitar uma solicitação expirada ou cancelada para aceite manual.**

### Entregador/Entregas
- Oferta disponível ao próprio entregador via `get_courier_incoming_offers()`; polling em `CourierOfferOverlay` e `scripts/harden-partner-courier-offer-ux-v2.mjs`, além de notificações.
- Banco Entregas possui `delivery_jobs` e `delivery_offers` com `expires_at`; `accept_delivery_offer` trava oferta/job, verifica elegibilidade/ONLINE, oferta não expirada e ausência de entrega ativa, cancela as ofertas concorrentes no aceite.
- A consulta atual filtra `offer.courier_id` para o próprio entregador; portanto não há catálogo geral autenticado de entregas pendentes.

## Melhorias propostas por prioridade
### P0 — Teste de status operacional em cada módulo
- Internet; GPS/permissão, acurácia e atualização; conta/aprovação/documentos; status ONLINE/OFFLINE; habilitação do tipo de serviço/cobertura; conexão ao canal de ofertas (Push/Realtime/polling) e idade do último evento.
- Mostrar exatamente **qual verificação falhou**, ação objetiva para resolver, botão Testar novamente. Não dar falso "Perfeito" quando a API está indisponível. Não impedir sessão nem bloquear fluxo existente.
- Adaptar ao tipo de parceiro: CNH/veículo só para motorista quando necessário; documentos e tipo de veículo do entregador; cada qual em seu banco/serviço real.

### P1 — Solicitações disponíveis / chamadas não atendidas
- Distinção visual e funcional entre **Mapa de Chamadas** (densidade de demanda/localização, somente se houver dados autorizados) e **Solicitações disponíveis** (chamadas ativas, sem aceite, ainda elegíveis).
- Exigir autorização de consulta server-side por motorista/entregador aprovado, ONLINE, sem atividade incompatível, dentro do raio, categoria e cobertura.
- Mostrar somente solicitações válidas **e não expiradas**. Jamais incluir corrida cancelada pelo passageiro, expirada, corrida com motorista atribuído, pedido cancelado ou estabelecimento não autorizado. Para corrida expirada: passageiro deve solicitar nova busca de forma explícita; sem reativação silenciosa.
- Expor antes do aceite apenas dados mínimos: tipo, distância estimada ao embarque/coleta, destino aproximado, valor previsto quando aplicável e tempo restante. Não expor nome, telefone ou endereço exato de terceiros antes da atribuição autorizada.
- Aceite deve ser **atômico no banco** (transação/row-lock/CAS), primeiro profissional vence, erro amigável para demais, atualização imediata das outras telas, push e registro de auditoria. Reutilizar `driver_accept_ride` ou `accept_delivery_offer` somente após confirmar compatibilidade; **não invocar a RPC de uma oferta exclusiva como se fosse pública**.
- Se nenhuma solicitação elegível estiver ativa, mostrar "Nenhuma solicitação disponível" e Atualizar, jamais deixar fila de ofertas mortas.
- Tempo limite e regras comerciais devem ser explícitos, parametrizáveis e validados com stakeholders antes de publicar.

### P2 — Preferências de serviços e localização
- Serviços habilitados (categoria/veículo), raio de busca e opção de destino preferencial; somente aplicar filtros de dispatch após validação E2E para não cortar demanda atual por engano.
- Padrões atuais preservados; preferências são distintas entre Motorista e Entregador, com dados próprios e controle de acesso.
- Metas de aceite/finalização, horas dirigidas e ganhos podem entrar em painel posterior com cálculos baseados nos dados verdadeiros, sem inventar porcentagens ou penalizar falhas sistêmicas.

## Gates e testes de aceitação
1. Motorista e Entregador: entrar ONLINE com GPS válido, Teste de status diagnosticar internet/GPS/perfil/serviços/recebimento, simular perda de internet sem prometer sucesso.
2. Criar solicitações de QA autorizadas em ambiente apropriado; duas contas elegíveis disputam mesma solicitação: exatamente uma atribuição.
3. Cancelamento antes do aceite: item desaparece de oferta/lista/mapa; nenhum profissional consegue assumir.
4. Expiração: nunca aparece em "disponíveis"; corrida só volta após nova solicitação do passageiro.
5. Entregador com entrega ativa ou OFFLINE: não recebe outra solicitação incompatível; proteção valida no servidor.
6. RLS: nenhum profissional enxerga dados pessoais de pedidos alheios por consulta direta.
7. Retomar app do background; Push, polling e status se reconciliam; nenhuma duplicidade.
8. Não regredir GPS, mapa externo, PIN, retorno, pagamento, assinatura Android, fotos e navegação já homologada.
9. Revisar e aprovar migrações/API/segurança separadamente, antes de ativar fila, e manter APKs para autorização expressa.

## Status atual
- Análise e proposta documentadas em 31/10/2026.
- **Sem implementação de central/Mapa de Chamadas/diagnósticos nesta etapa**: exige desenho de API, testes de concorrência, privacidade e autorização de modificações específicas de backend.
- **Nenhum APK gerado, nenhuma alteração em Supabase, deploy ou mudança financeira.**

## Evolução implementada no código QA — mapa de demanda pulsante
- Recuperado requisito anterior do usuário: somente pontos pulsantes de DEMANDA em áreas, sem dados de passageiro ou detalhes clicáveis, aparecem quando Motorista está ONLINE e sem corrida ativa; somem ao aceitar. Nova identidade APOIS usa três intensidades em tons vermelhos, não amarelo legado.
- Implementado no script `scripts/harden-partner-motorista-demand-map-v1.mjs`, acionado em `scripts/build-partner-release.sh` **somente** no workspace efêmero `.work/partner-motorista`. Não alterar fontes pinadas.
- OverlayView do mapa Google existente, pontos anônimos pequenos e `animate-ping`, sem clique, sem nome/telefone/ID/lat-lng individual. Intervalo 30s, cleanup de timer, desligado offline, com oferta/viagem/avaliação ou GPS ausente; falha da RPC = mapa sem pontos (sem dados inventados).
- Backend SQL PROPOSTO, NÃO APLICADO: `supabase/corridas-forward-migrations/20261031_driver_demand_zones_qa_NOT_APPLIED.sql`. RPC sem parâmetros para derivar posição do motorista no servidor, validando cadastro aprovado (`aprovado`), ONLINE, GPS recente, suspensões/bloqueios e identidade via `public.users.auth_user_id -> public.drivers.user_id`, pois `drivers.user_id` é ID operacional e **não** `auth.uid()`.
- Pedidos com origem válida, não cancelados, criados nos últimos 30 minutos e em estados legítimos de demanda são agrupados em grade fixa de 0,025 grau (~2,7km de latitude). Só publicar células com **pelo menos 3 solicitações**, até 8 focos, num raio aproximado de 15km. RPC retorna apenas centro aproximado e intensidade, sem contagem exata/ID/endereço; RPC bloqueia anon.
- Min3 significa que em regiões sem dados suficientes o mapa não terá nenhum ponto; não usar animações fictícias nem afirmar que há passageiro quando não há.
- Gate `scripts/verify-partner-driver-demand-zones-v1.mjs` incorporado ao `build:partner`; testa privacidade, autenticação, exibição condicional, não uso de consultas brutas a corridas, cleanup e limite da consulta agregada.
- Preflight SEM APK `41215442079`: audit-web-only SUCCESS, WEB-only estabelecimento SUCCESS, WEB-only cliente SUCCESS. O módulo Motorista compilou com o overlay. Tela autenticada e dados reais ainda não testados no Android.
- **Atenção:** o app atualmente instalado não exibe esta camada; ela só estará disponível após autorização da migração backend e de nova geração/instalação de APK. Nem SQL de Corridas nem APK foram executados nesta etapa.
- Central de Solicitações Disponíveis e Teste de Status permanecem planejados: não afirmar que foram implementados como parte desta alteração. Não converter pedidos expirados ou cancelados em ofertas válidas.
