# Corridas — identidade e ownership do banco

## Regra canônica

A integração do APOIS Corridas deve tratar os identificadores como dois domínios diferentes:

- **AUTH ID**: `auth.uid()` = `auth.users.id` = `public.users.auth_user_id`.
- **DOMAIN USER ID**: `public.users.id`.

Tabelas que possuem FK para `public.users.id` continuam armazenando o **DOMAIN USER ID**. Não é permitido alterar PKs/FKs em massa nem converter `public.users.id` para `auth.uid()` apenas para simplificar queries.

## Resolução obrigatória

Código que começa com um usuário autenticado deve resolver o usuário de domínio por `public.users.auth_user_id = auth.users.id` antes de consultar recursos que referenciem `public.users.id`.

Isso vale, entre outros, para `user_roles.user_id`, `passenger_wallets.passenger_id`, `drivers.user_id` e `rides.passenger_id`.

## RLS

A correção forward-only está versionada em:

`supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql`

Ela não reescreve migrations históricas. As policies próprias resolvem ownership por `users.auth_user_id`, e privilégios de coluna impedem um usuário autenticado comum de alterar `users.id`, `users.auth_user_id`, ownership de motorista ou campos administrativos.

## Source protegido

`sources/apois-corridas-passageiro` permanece pinado e read-only na integração. O hardener do Superapp aplica a correção ao snapshot `.work/corridas`. Depois da homologação, a mesma correção deve ser promovida ao source canônico em mudança separada e revisada, sem alterar o pin silenciosamente.
