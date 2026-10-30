# APOIS — Auditoria transversal de homologação (30/10/2026)

## Escopo e método
- Quatro módulos: Cliente Corridas, Cliente Entregas, Parceiro Motorista e Parceiro Entregador, reunidos em **dois APKs** (Superapp Cliente e Parceiro).
- Painéis: estabelecimento Entregas, administração Entregas e administração Corridas.
- Evidências: capturas do usuário em aparelhos Android; leitura dos repositórios protegidos/pins e scripts na branch `fix/entregas-homologacao-ajustes-20261030`; consulta **somente leitura** ao Supabase Entregas; simulação isolada da aplicação de correções.
- **Não é homologação E2E concluída**: não foram executados novos APKs, login real automatizado nos painéis, testes de dispositivo, carga nem deploy.
- Alterações autorizadas apenas em `apoistecnologia-gif/apois-superapp`, isoladas da produção. Não fazer merge ou deploy sem homologação.

## Arquitetura real
| Superfície | Módulo | Origem protegida | Validação |
|---|---|---|---|
| APOIS Cliente | Corridas | `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf` | Build Android/Google Maps/GPS/solicitação |
| APOIS Cliente | Entregas | `apoistecnologia-gif/apois-entregas` | Checkout, pagamento direto, pedidos, status |
| APOIS Parceiro | Motorista | `apoistecnologia-gif/movvi-go-connect` | Login, mapa, GPS, corridas, PIN |
| APOIS Parceiro | Entregador | `apoistecnologia-gif/apois-entregas` | Cadastro, ofertas, retirada, PIN e pós-entrega |
| Web | Estabelecimento | `apoistecnologia-gif/apois-entregas` | Pedidos, despacho, produtos, horários |
| Web | Admin Entregas | `apoistecnologia-gif/apois-entregas` | Entregadores, estabelecimentos, mapa, suporte |
| Web | Admin Corridas | `apoistecnologia-gif/movvi-go-connect` | Motoristas, corridas, financeiro, mapa |

Pins oficiais: `.apois/source-lock.json`. Banco Entregas usado na auditoria: `ptgkwyyolrdgnqketkjj`. Não misturar com Corridas.

## Achados priorizados

### P0 — impeditivos de homologação
1. **Corridas + Entregas: Google Maps com cobrança/suspensão pendente.** Relatado pelo usuário, não confirmado no console nesta auditoria. Impacta mapas, autocomplete/rotas/ETA. A navegação externa do entregador foi preparada como contingência; exige teste no Android. Não habilitar chamadas pagas ou eliminar proteções de quota sem resolver a conta.
2. **Build integrado ainda não executado** para a branch atual. O pipeline tem verificações antigas de transição do entregador; antes da auditoria faltavam marcadores `transitionJobId` e `setCompletedJob(... status: "delivered")`. Corrigidos no script `fix-partner-courier-simple-journey-v1.mjs`; **a compilação/typecheck final segue pendente**.
3. **Entregador: novo fluxo precisa de regressão real** (aceitar → mapa → pedido retirado → mapa do cliente → confirmar PIN; recuperação com perda de conexão; reentrada). A lógica anterior de timeout havia sido sobrescrita e foi restaurada durante esta auditoria. Não aprovar release só por inspeção de strings.
4. **Foto do perfil do entregador:** a UI e o código de upload estão preparados, mas a política de acesso à pasta pessoal no bucket `avatars` foi apenas versionada, não aplicada. Envio real não homologado.

### P1 — funcional / UX relevante
5. **Cliente Entregas: atualização de entrega no passageiro.** As capturas mostraram etapa presa em "saiu para entrega". Consulta SQL em 30/10 confirmou pedidos **#5 e #6 como `delivered` tanto em `orders` como em `delivery_jobs`**, com timestamps de conclusão. Correção de polling/feedback foi preparada em `fix-entregas-customer-delivery-tracking-v1.mjs`; requer teste com app cliente aberto, em segundo plano e retomado.
6. **Parceiro Entregador: jornada com botões demais.** Estágio visual simplificado para aceite, retirada e PIN; backend mantém estágios intermediários obrigatórios. Verificar atomicidade, timeout, refetch e a posição correta da rota nas duas etapas.
7. **Parceiro Entregador: abria online após login.** Correção de entrada offline preservando entrega ativa registrada; comprovar com logout/login, fechamento forçado e atualização da posição.
8. **Cliente Corridas: mapa fixo em Petrolina enquanto GPS não identifica posição.** Corrigido fallback para visão neutra do Brasil, validade do cache e tentativa de permissão; testar GPS real no município atual, precisão/rejeição e permissões.
9. **Motorista Corridas: mapa com pouca definição no print rural.** Estilo atualizável para a paleta APOIS (água azul-marinho, vias legíveis), sem prometer ruas inexistentes no Google. Testar zoom, carregamento de tiles, localização e follow da câmera; zoom e disponibilidade de tiles variam por local.
10. **Parceiro: seletor de papel com quadrado preto sobre cartão Entregador.** Elemento decorativo `vehicle-mark` ocultado na branch; ainda sem captura da versão recompilada.

### P2 — visual e ergonomia
11. **Entregador Perfil / Histórico:** captura apresentava cartão preto com texto quase invisível e itens cinza. Versão de perfil branca/vermelha, foto e edição de nome/telefone preparados; é necessário revisar contraste, máscara de entrada, teclado Android e RLS.
12. **Painel Estabelecimento:** `MerchantOrderControlCenter` tinha cartão flutuante preto/amarelo, `bottom-5 left-5`, potencial sobreposição em tela estreita. Versão compacta branco/vermelho com `safe-area` preparada em `fix-merchant-order-control-visual-v1.mjs`, incluída em `build-merchant-panel.mjs`.
13. **Admin Entregas e Estabelecimento:** `WorkspaceShell.tsx` original mantém superfícies `bg-black/bg-zinc-950`, enquanto identidade móvel aprovada é vermelho/branco/preto com fundos claros. Necessita migração visual **criteriosa por componente** e captura de telas renderizadas antes de alterar toda a shell.
14. **Admin Corridas:** títulos de dashboard/mapa ainda mencionam MOVVI e parte dos tokens antigos permanece no repositório; revisar sem alterar semântica de cores de status (ex.: online verde).
15. **Quatro módulos:** avaliar área segura do Android, contraste de botões desabilitados, modais/teclado, estados vazios, erros, scroll, mapa atrás dos painéis e diferenças de tamanho entre aparelhos. Não validado com screenshots completas após patches.

## Evidências positivas
- 30/10/2026: `orders` e `delivery_jobs` dos pedidos #5 e #6 = `delivered`. Não mexer desnecessariamente no backend de conclusão.
- Transições oficiais de Entregas consultadas por SQL: `accepted → arriving_pickup → at_pickup → picked_up → on_the_way → arrived_destination → delivered`, último estágio com PIN. `set_courier_online(false)` é bloqueado durante entrega ativa. Preservar essas restrições.
- Scripts de correção de perfil, mapa, manual-online e jornada passaram em simulação isolada de aplicação. **Isso não substitui TypeScript, build ou execução Android**.
- Política de pagamentos diretos em teste e taxa de ganho R$0,00 no pedido fictício **não devem ser tratados como erro visual de cálculo** sem verificar uma entrega paga real.

## Gates obrigatórios antes de APK / merge
- [ ] Verificar pins e fontes protegidas; garantir que só a branch de homologação mudou.
- [ ] Executar auditorias estáticas de UI, autenticação, RLS, isolamento financeiro e provider.
- [ ] Executar preflight **WEB SEM APK**, incluindo `npm run build:partner` e typechecks; workflow atual não inclui esta branch no push automático.
- [ ] Executar build cliente Web/Capacitor e typecheck (sem gerar APK até autorização).
- [ ] Validar ao menos uma captura de cada estado: login, home, mapa, pedido, histórico, perfil, erro, loading e admin.
- [ ] Com Maps regularizado, testar precisão GPS, rotas reais, diferenças urbano/rural, permissões e perda de conexão.
- [ ] Testar cliente pedido #7 fictício ponta a ponta em ambos dispositivos, incluindo notificação de conclusão, PIN inválido, saída/retorno do app, entrega e histórico.
- [ ] Testar login Google/email e recuperação de senha nos dois shells, sem interferência entre contas.
- [ ] Validar permissões de foto `avatars` e upload com usuário próprio/usuário estranho antes de implantar.
- [ ] Confirmar Vercel de estabelecimento e Admin Entregas; screenshots desktop e celular.
- [ ] Confirmar painel Admin Corridas: mapa, filtros, status de drivers, títulos, histórico e segurança.
- [ ] Homologar pagamentos diretos/Safe2Pay apenas conforme provider efetivamente habilitado; sem acionar cobrança real no teste.

## Status final deste documento
**Auditoria estática/parcial com correções pontuais versionadas, NÃO homologação final.** Não há garantia de APK compilado, telas renderizadas ou serviços externos disponíveis. Não executar produção, deploy, SQL de mutação, merge ou build de APK sem autorização expressa.
