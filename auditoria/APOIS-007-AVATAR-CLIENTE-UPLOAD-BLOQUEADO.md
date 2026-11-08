# APOIS-007 — Cliente Entregas: foto de perfil (upsert)

Confirmado por comparação entre o código pinado e o Storage em produção (somente leitura).

- \`src/routes/perfil/dados-pessoais.tsx\` linhas 226-252: valida JPG/PNG/WEBP, envia \`<auth.uid()>/avatar\` para bucket \`avatars\` com \`upsert: true\`.
- Bucket \`avatars\` existe, público, 5MB; \`storage.objects\` tem RLS ligado.
- A única policy atual de avatar é \`INSERT\` de entregador na pasta \`courier-profile\`. Não há policies \`SELECT\` ou \`UPDATE\` para o upload com substituição do cliente.
- Supabase Storage exige \`INSERT\`, \`SELECT\` e \`UPDATE\` para \`upsert\`; portanto a funcionalidade de atualizar foto de perfil não está autorizada.

**Preparado, não aplicado:** \`supabase/entregas-forward-migrations/20261108_customer_avatar_upsert_scoped_STAGE_ONLY.sql\`, com políticas estritas pelo caminho exato \`auth.uid()/avatar\`, e sem alterar a policy existente de avatar de entregador.

**Homologar antes de produção:** usuário A cria e substitui sua própria foto; B não lê o objeto autenticado nem sobrescreve o de A; perfil bloqueado não grava; rota de avatar do entregador permanece inalterada; tamanho/MIME validados. O bucket é público, logo o URL público da imagem continua acessível sem autenticação após o upload.
