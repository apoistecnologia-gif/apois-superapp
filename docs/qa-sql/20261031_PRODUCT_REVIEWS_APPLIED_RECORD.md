# Registro de migração aplicada — APOIS Entregas — 31/10/2026

## Autorização e escopo
Usuário autorizou expressamente a migração de avaliações individuais de produtos no banco de produção APOIS Entregas. Nenhum APK, AAB, deploy Vercel, merge ou atualização do banco Corridas foi autorizado/executado.

## Produção
- Supabase project ref: `ptgkwyyolrdgnqketkjj` (APOIS ENTREGAS - PRODUÇÃO).
- Ferramenta: Supabase apply_migration — sucesso.
- Identificador de histórico: `20261031150244`.
- Nome no histórico: `apois_product_order_reviews_authenticated_v1_20261031`.
- Foi utilizada a proposta `20261031_product_order_reviews_NOT_APPLIED.sql` como base, com revisão adicional (não executar o arquivo preliminar como nova migração): sem BEGIN/COMMIT explícito, com validação de conta ativa, e exigência de avaliação do pedido existente antes de avaliações dos produtos, tanto na RLS INSERT como na RPC específica.
- Tabela criada: `public.product_order_reviews`.
- Funções novas: `public.submit_order_product_reviews(uuid,jsonb)` e `public.submit_order_review_with_products(uuid,smallint,smallint,text,jsonb)`.
- RPC existente `public.submit_order_review` preservada, sem alteração.
- Nota individual 1–5, comentário opcional até 500 caracteres, unicidade por `order_item_id`, referências FK; submissão conjunta transacional na função nova.
- RLS ligada, duas políticas: leitura do próprio cliente e inserção por cliente ativo, autor de pedido entregue com avaliação base existente, e item pertencente ao mesmo pedido. Concessões SELECT/INSERT para authenticated; anon sem SELECT/INSERT.
- Funções novas em SECURITY INVOKER; EXECUTE revogado a PUBLIC/anon e concedido a authenticated. Nenhum serviço financeiro modificado.

## Verificação pós-aplicação
- Tabela existente; `relrowsecurity = true`; 2 policies; 3 FKs; 1 unique constraint.
- Novas RPCs existentes, `prosecdef = false`; `anon_can_execute = false`; `authenticated_can_execute = true`.
- `anon_can_read = false` e `anon_can_insert = false`. `authenticated` com SELECT/INSERT sujeitos a RLS.
- Contagem inicial da tabela: 0 avaliações (não se fabricaram registros).
- Security advisors pós-aplicação: sem achados sobre `product_order_reviews`. Há avisos preexistentes em outras funções/tabelas fora deste escopo, não modificados.
- Registro confirmado em `supabase_migrations.schema_migrations`.

## Pendências legítimas
- Nenhuma UI nova foi disponibilizada aos usuários. A interface de avaliação dos produtos continua apenas no código da branch QA e entrará em APK apenas mediante autorização específica do usuário.
- E2E autenticado de gravação real com pedido entregue ainda não executado; não criar pedido, nota, usuários ou pagamento real para testar.
- O arquivo SQL preliminar no repositório mantém o sufixo NOT_APPLIED por representar a versão preliminar sem as condições extras aplicadas. Este registro aponta a migração EFETIVAMENTE aplicada no banco, que foi versionada no histórico de migrações do Supabase.
