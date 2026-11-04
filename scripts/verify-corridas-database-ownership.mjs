import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql');
const sql = readFileSync(path, 'utf8');
let failed = false;
function require(marker) { if (!sql.includes(marker)) { failed = true; console.error(`[FAIL] migration de ownership sem: ${marker}`); } }
function forbid(marker) { if (sql.includes(marker)) { failed = true; console.error(`[FAIL] migration de ownership contém padrão proibido: ${marker}`); } }

for (const marker of [
  'auth_user_id = auth.uid()',
  'u.id = user_roles.user_id',
  'u.id = passenger_wallets.passenger_id',
  'u.id = drivers.user_id',
  'u.id = rides.passenger_id',
  'join public.users u on u.id = ur.user_id',
  'revoke update on public.users from authenticated;',
  'grant update (name, phone, avatar_url, city) on public.users to authenticated;',
  "has_column_privilege('authenticated', 'public.users', 'auth_user_id', 'UPDATE')",
  "has_table_privilege('authenticated', 'public.user_roles', 'INSERT')",
]) require(marker);
forbid('id = EXCLUDED.id');
forbid('USING (auth.uid() = id)');
forbid('USING (auth.uid() = user_id)');
forbid('USING (auth.uid() = passenger_id)');

if (failed) process.exit(1);
console.log('[OK] Ownership DB: AUTH ID e DOMAIN USER ID permanecem separados e as policies resolvem a relação explicitamente.');
