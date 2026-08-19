import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

check('scripts/validate-rides-push-firebase.mjs', [
  "APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1'",
  'CORRIDAS_FIREBASE_PROJECT_ID',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64',
  'mobileProjectId !== expectedProjectId',
], 'Push Corridas possui gate de compatibilidade Firebase mobile/backend');

check('scripts/namespace-entregas-superapp-storage.mjs', [
  'apois-superapp-entregas:cart',
  'apois-superapp-entregas:checkout-owner-id',
  'apois-superapp-entregas:active-pix',
  'apois-superapp-entregas:bound-user-id',
  'dynamicBoundUserReplacement',
], 'Entregas possui namespace completo de storage do Superapp');

check('scripts/harden-corridas-superapp-storage.mjs', [
  'apois-superapp-corridas-auth-v1',
  'apois-superapp-corridas:push-device-id',
  'favorites',
  'recent-destinations',
], 'Corridas usa sessão isolada para storage operacional');

check('.apois/modules.json', [
  'harden-corridas-superapp-storage.mjs',
  'namespace-entregas-superapp-storage.mjs',
  '--frozen-lockfile',
], 'build dos módulos executa isolamento de storage e mantém locks protegidos');

check('supabase/migrations/20260819022000_harden_entregas_admin_rpc_privileges.sql', [
  'admin_create_merchant',
  'admin_delete_merchant',
  'admin_suspend_merchant',
  'from public, anon',
  "guard_merchant_delivery_location() set search_path = ''",
], 'hardening de privilégios do backend Entregas está rastreado por migration');

check('.env.example', [
  'CORRIDAS_FIREBASE_PROJECT_ID=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'CORRIDAS_PUBLIC_APP_URL=',
], 'pendências externas sensíveis estão explícitas no ambiente');

process.exit(failed ? 1 : 0);
