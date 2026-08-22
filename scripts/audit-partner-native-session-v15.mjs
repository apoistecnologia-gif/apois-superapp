import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner native session v15: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('sources/apois-corridas-motorista-admin/src/integrations/supabase/client.ts', [
  'autoRefreshToken: true',
], 'Fonte Motorista usa auto-refresh WebView e portanto precisa coordenação com o refresh nativo');
requireAll('sources/apois-entregas/src/integrations/supabase/client.ts', [
  'autoRefreshToken: true',
], 'Fonte Entregador usa auto-refresh WebView e portanto precisa coordenação com o refresh nativo');

requireAll('scripts/harden-partner-location-session-sync.mjs', [
  'apois_partner_location_session',
  'driver_access_token',
  'driver_refresh_token',
  'courier_access_token',
  'courier_refresh_token',
  'public void session(PluginCall call)',
  'private void persistSessionTokens()',
  'persistSessionTokens();',
  'remove(SESSION_ACCESS_KEY)',
  'remove(SESSION_REFRESH_KEY)',
  'sessão do GPS é reconciliada durante operação e removida do storage nativo no stop explícito',
], 'Android persiste refresh token enquanto operacional e remove as credenciais nativas no stop explícito');

requireAll('scripts/harden-partner-motorista-native-session-sync.mjs', [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseUserId()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== expectedUserId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
], 'Motorista adota somente sessão nativa mais nova da mesma conta antes de getSession');

requireAll('scripts/harden-partner-entregador-native-session-sync.mjs', [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseSessionSnapshot()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== local.userId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
], 'Entregador adota somente sessão nativa mais nova da mesma conta antes de getSession');

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-native-session-sync.mjs';",
], 'Pipeline Motorista aplica reconciliação de sessão antes da compilação');

const courierPipeline = read('scripts/harden-partner-entregador-map.mjs');
for (const marker of [
  "import './harden-partner-entregador-background-location.mjs';",
  "import './harden-partner-entregador-native-session-sync.mjs';",
  "import './harden-partner-entregador-background-reconciliation.mjs';",
]) {
  if (!courierPipeline.includes(marker)) {
    console.error(`[FAIL] Pipeline Entregador sem sessão nativa coordenada: ${marker}`);
    failed = true;
  }
}
const bgIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-location.mjs';");
const syncIndex = courierPipeline.indexOf("import './harden-partner-entregador-native-session-sync.mjs';");
const reconciliationIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-reconciliation.mjs';");
if (!(bgIndex >= 0 && syncIndex > bgIndex && reconciliationIndex > syncIndex)) {
  console.error('[FAIL] Entregador: courierNativeLocation precisa existir antes do session-sync e ser reconciliado antes dos guardas posteriores.');
  failed = true;
} else console.log('[OK] Ordem Entregador do session-sync está protegida.');

const launcher = read('scripts/install-partner-launcher.mjs');
const ackIndex = launcher.indexOf("import './harden-partner-location-startup-ack.mjs';");
const nativeSyncIndex = launcher.indexOf("import './harden-partner-location-session-sync.mjs';");
const routingIndex = launcher.indexOf("import './harden-partner-location-notification-routing.mjs';");
if (!(ackIndex >= 0 && nativeSyncIndex > ackIndex && routingIndex > nativeSyncIndex)) {
  console.error('[FAIL] Android: session-sync precisa rodar após startup ACK/retry e antes da validação final/roteamento.');
  failed = true;
} else console.log('[OK] Ordem Android da coordenação de sessão está protegida.');

requireAll('scripts/verify-partner-native-plugins.mjs', [
  'remove(SESSION_ACCESS_KEY)',
  'remove(SESSION_REFRESH_KEY)',
  'mantém tokens nativos depois do stop explícito',
], 'Validação final rejeita runtime que deixa refresh token persistido após OFFLINE explícito');

if (!failed) console.log('[OK] Partner native session v15: refresh_token nativo é reconciliado durante a jornada e removido no stop explícito.');
process.exit(failed ? 1 : 0);
