# APOIS — Testes ponta a ponta sem PIX nem dinheiro real

Preparação de 29/10/2026, sem deploy e sem APK.
Branch: fix/entregas-pagamento-direto-homolog-20261029.

## Corridas
Cliente Corridas já oferece Dinheiro e Cartão de crédito como pagamentos DIRETOS ao motorista. Não exige webhook Pix. Testar em ambiente isolado com motorista e passageiro fictícios, sem dinheiro, validando oferta, chegada, PIN e finalização.

## Entregas
Cliente Entregas consolidado já envia paymentMethod='cash' e pedido segue com payment_status='pending'. MerchantOrderControlCenter e MerchantOrderSoundWatcher reconhecem cash/pending. Porém Supabase produção exige pix na função enforce_supported_order_payment_method e Edge create-order. NÃO alterar essas restrições em produção.

## Arquivos prontos
- supabase/homologacao/entregas/create-order/index.ts: Edge staging-only, bloqueia project refs de produção, exige APOIS_ENABLE_CASH_HOMOLOGATION=enabled-in-staging, recebe cash e exige snapshot pending.
- supabase/homologacao/entregas/20261029_cash_direct_staging_only.sql: somente base de homologação vazia; permite cash/pending exclusivamente para lojas adicionadas ao allowlist privado; políticas RLS mínimas e entitlement de teste restrito.
- scripts/harden-entregas-cash-staging-labels.mjs: mostra claramente TESTE — NÃO PAGAR nos módulos staging, bloqueia refs de produção; não está no build habitual.
- scripts/verify-entregas-cash-homologation-static.mjs: 14 verificações estáticas de segurança e compatibilidade. Não são E2E.

## Sequência para teste físico futuro
1. Criar branch/projeto Supabase de Entregas para homologação: custo precisa de confirmação específica; ferramenta não autorizou criar sem isso. Nunca reutilizar projeto produção.
2. Confirmar projeto novo e vazio (auth.users/orders/merchants sem registros). Aplicar migration específica de staging e verificar as funções, grants, RLS e triggers.
3. Implantar o Edge create-order somente no projeto staging, verify_jwt=true, com a variável secreta APOIS_ENABLE_CASH_HOMOLOGATION=enabled-in-staging.
4. Criar usuários TEST-* fictícios: cliente, gerente de loja e entregador. Criar loja TEST-* aprovada, ativa, com coordenadas e produtos fictícios. Autorizar a loja, somente no projeto staging, em private.apois_cash_homologation_merchants.
5. Definir courier_payout_mode=merchant_manual somente no staging, sem obrigação de repasse real. Garantir que cliente/loja/entregador estejam na mesma área, dentro do raio de despacho e com GPS recente/preciso.
6. Apontar Cliente Entregas, Painel Estabelecimento e Parceiro Entregador ao MESMO Supabase staging, com anon key staging, usando deploy de preview e nomes/pacotes de APK de teste distintos da produção. Nunca sobrescrever envs de produção.
7. Para o Cliente staging, executar script de texto de teste somente depois do hardener normal de checkout e antes do build, com APOIS_HOMOLOGATION_CASH=enabled-in-staging e VITE_SUPABASE_URL do staging. Build só quando autorizado.
8. Percurso: Cliente monta sacola, confirma pagamento em dinheiro de teste → pedido cash/pending visível no painel → alerta sonoro → estabelecimento aceita, prepara, marca pronto → solicita entregador → oferta/push/polling → entregador aceita, busca e conclui entrega. Conferir orders, delivery_jobs, delivery_offers e notificações SOMENTE no staging.
9. Negativos: pedido duplicado, pagamento falsamente paid, loja fora do allowlist, assinatura inválida, entregador offline/distante/GPS velho, usuário sem autorização, ofertas repetidas, app em background.
10. Corridas: preparar Supabase staging próprio; solicitar pagamento direto fictício → motorista próximo aceita → chegada/PIN → trajeto → conclusão, sem valores ou ledgers reais.

## Segurança
- Bloqueados os project refs de produção: ptgkwyyolrdgnqketkjj, sbvhdgyuuperszlsllji, tbbzkrfupmqdywnzgnms, vqtucstyduxrqjgyigfk.
- Nunca simular payment_status='paid' em produção, nem criar chave Pix pagável, nem reduzir raio de despacho ou remover RLS para testes.
- Nenhum entregador, estabelecimento ou cliente deve cobrar/receber dinheiro no teste.
- Não executar migration, modificar credenciais produtivas, gerar APK ou rodar deploy sem o ambiente isolado e autorização adequada.

## Resultado desta rodada
Integração cash/pending de homologação preparada no GitHub. 14 verificações estáticas aprovadas. Supabase produção intacto; nenhum teste físico, APK ou implantação realizado.
