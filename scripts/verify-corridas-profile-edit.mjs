// APOIS Cliente — regressão de edição do cadastro no Perfil.
// Valida a tela preparada em .work/corridas SEM alterar Supabase, sem compilar APK.
// Na homologação final, testar perfil RLS em conta de teste e confirmação de e-mail.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const work=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=(rel)=>readFileSync(resolve(work,rel),'utf8');
const ui=read('src/routes/_authenticated.perfil.tsx');
const editor=read('src/components/profile/PassengerProfileEditor.tsx');
const deletion=read('src/components/profile/PassengerAccountDeletion.tsx');
const auth=read('src/hooks/use-auth.tsx');
const migrations=readFileSync('supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql','utf8');

for(const marker of [
  'APOIS_CLIENT_PROFILE_EDIT_V1',
  'setEditingField("name")',
  'setEditingField("phone")',
  'setEditingField("email")',
  'onSaved={refreshSession}',
  'onSwitchField={setEditingField}',
  '<PassengerProfileEditor',
  'signOut',
])assert.ok(ui.includes(marker),'Perfil perdeu ação: '+marker);

for(const marker of [
  'supabase.auth.updateUser({ email: cleanEmail })',
  'supabase',
  '.from("users")',
  '.update(fields)',
  '.eq("id", profile.id)',
  '.eq("auth_user_id", authUserId)',
  '.select("id")',
  '.maybeSingle()',
  'Não foi possível salvar a alteração.',
  'Seus dados foram atualizados com sucesso.',
  'setSuccess("Solicitação recebida.',
  'if (!authUserId || !profile?.id)',
  'disabled={busy || Boolean(success)}',
  'aria-modal="true"',
  'max(28px,env(safe-area-inset-bottom))',
  'onSwitchField: (nextField: PassengerProfileField) => void;',
  'onSwitchField("phone")',
  'onSwitchField("email")',
  'aria-label="Dados de contato"',
  'profile?.phone?.trim() || "Não informado"',
  'currentEmail || "Não informado"',
  'name.trim().replace(/\\s+/g, " ")',
  'city.trim().replace(/\\s+/g, " ")',
  'phone.replace(/\\D/g, "")',
  '!/^\\d{10,13}$/.test(cleanPhone)',
  '!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)',
])assert.ok(editor.includes(marker),'Editor sem segurança/funcionalidade: '+marker);

for(const forbidden of [
  '.update({ email:', '.update({ auth_user_id:', '.update({ role:', '.upsert(', '.insert(', '.delete(',
  'service_role', 'admin.auth', '.from("user_roles")', '.from("drivers")'
])assert.ok(!editor.includes(forbidden),'Editor tenta escrita não autorizada: '+forbidden);

assert.ok(editor.includes('fields = field === "name"')&&editor.includes('{ name: cleanName, city: cleanCity || null }')&&editor.includes('{ phone: cleanPhone }'),
  'Atualizações no perfil devem ser limitadas a nome, cidade e telefone');
for (const token of [
  'APOIS_CLIENT_ACCOUNT_DELETION_V1',
  '<PassengerAccountDeletion onConfirmed={async () => {',
  'await signOut();',
  'await navigate({ to: "/login", replace: true });',
]) assert.ok(ui.includes(token), "Perfil perdeu ação de exclusão: " + token);
for (const token of [
  'deletionClient.rpc("request_own_account_deletion")',
  'confirmation.trim() !== "EXCLUIR"',
  'data?.ok !== true',
  'rpcError.code === "55000"',
  'await onConfirmed();',
  'Excluir minha conta',
  'aria-modal="true"',
  'env(safe-area-inset-bottom)',
]) assert.ok(deletion.includes(token), "Exclusão de Corridas incompleta: " + token);
for (const forbidden of [
  'delete-my-account', 'auth.admin.deleteUser', 'service_role',
  'supabase.auth.admin', 'request_own_account_deletion()',
]) assert.ok(!deletion.includes(forbidden), "Exclusão não deve executar API privilegiada ou RPC sem confirmação: " + forbidden);

assert.ok(migrations.includes('grant update (name, phone, avatar_url, city) on public.users to authenticated;'),
  'Migração não permite campos propostos');
assert.ok(migrations.includes('using (auth_user_id = auth.uid())')&&migrations.includes('with check (auth_user_id = auth.uid())'),
  'Migração não restringe atualizações ao próprio usuário');
assert.ok(auth.includes('refreshSession: () => Promise<void>'),'Contexto de autenticação não atualiza perfil');
assert.ok(auth.includes('const fetchProfile = useCallback'), 'AuthProvider não consulta a atualização');
console.log('[OK] APOIS Perfil: contatos e edição preservados; exclusão confirmada por RPC própria sem chamada destrutiva no build.');
