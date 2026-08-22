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
], 'Fonte Motorista usa auto-refresh WebView e precisa coordenação bidirecional com o refresh nativo');
requireAll('sources/apois-entregas/src/integrations/supabase/client.ts', [
  'autoRefreshToken: true',
], 'Fonte Entregador usa auto-refresh WebView e precisa coordenação bidirecional com o refresh nativo');

requireAll('scripts/harden-partner-location-session-sync.mjs', [
  'apois_partner_location_session',
  'driver_access_token',
  'driver_refresh_token',
  'courier_access_token',
  'courier_refresh_token',
  'public void session(PluginCall call)',
  'public void updateSession(PluginCall call)',
  'private void persistSessionTokens()',
  'private void loadPersistedSessionTokens()',
  'loadPersistedSessionTokens();',
  'remove(SESSION_ACCESS_KEY)',
  'remove(SESSION_REFRESH_KEY)',
], 'Android permite atualizar credenciais do FGS sem reiniciá-lo, recarrega tokens antes das RPCs e limpa no stop');

requireAll('scripts/harden-partner-motorista-native-session-sync.mjs', [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseUserId()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== expectedUserId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
], 'Motorista adota sessão nativa mais nova da mesma conta antes de getSession');

requireAll('scripts/harden-partner-motorista-native-token-forward.mjs', [
  'updateSession(options: { accessToken: string; refreshToken: string })',
  'APOIS_PARTNER_DRIVER_NATIVE_TOKEN_FORWARD',
  'event !== "TOKEN_REFRESHED"',
  'apois-parceiro:operational-role',
  'DriverLocation.updateSession({',
  'globalThis.setTimeout(() => forwardDriverSessionToNative(session), 0)',
  'TOKEN_REFRESHED ainda tenta reiniciar Foreground Service',
], 'Motorista repassa refresh da WebView ao DriverLocationService sem reiniciar Foreground Service');

requireAll('scripts/harden-partner-entregador-native-session-sync.mjs', [
  'session(): Promise<NativeSessionResult>',
  'function localSupabaseSessionSnapshot()',
  'async function adoptNewerNativeSession()',
  'nativeClaims.sub !== local.userId',
  'nativeClaims.exp <= localExp',
  'supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })',
  'await adoptNewerNativeSession();',
], 'Entregador adota sessão nativa mais nova da mesma conta antes de getSession');

requireAll('scripts/harden-partner-entregador-native-token-forward.mjs', [
  'updateSession(options: { accessToken: string; refreshToken: string })',
  'APOIS_PARTNER_COURIER_NATIVE_TOKEN_FORWARD',
  'event !== "TOKEN_REFRESHED"',
  'apois-parceiro:operational-role',
  'CourierLocation.updateSession({',
  'globalThis.setTimeout(() => forwardCourierSessionToNative(session), 0)',
  'TOKEN_REFRESHED ainda tenta reiniciar Foreground Service',
], 'Entregador repassa refresh da WebView ao CourierLocationService sem reiniciar Foreground Service');

const driverPipeline = read('scripts/harden-partner-motorista-payment-policy.mjs');
const driverSyncIndex = driverPipeline.indexOf("import './harden-partner-motorista-native-session-sync.mjs';");
const driverForwardIndex = driverPipeline.indexOf("import './harden-partner-motorista-native-token-forward.mjs';");
if (!(driverSyncIndex >= 0 && driverForwardIndex > driverSyncIndex)) {
  console.error('[FAIL] Motorista: token-forward precisa rodar depois da criação do helper native-session-sync.');
  failed = true;
} else console.log('[OK] Ordem Motorista da coordenação bidirecional de sessão está protegida.');

const courierPipeline = read('scripts/harden-partner-entregador-map.mjs');
const bgIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-location.mjs';");
const syncIndex = courierPipeline.indexOf("import './harden-partner-entregador-native-session-sync.mjs';");
const forwardIndex = courierPipeline.indexOf("import './harden-partner-entregador-native-token-forward.mjs';");
const reconciliationIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-reconciliation.mjs';");
if (!(bgIndex >= 0 && syncIndex > bgIndex && forwardIndex > syncIndex && reconciliationIndex > forwardIndex)) {
  console.error('[FAIL] Entregador: background-location → session-sync → token-forward → reconciliation está fora de ordem.');
  failed = true;
} else console.log('[OK] Ordem Entregador da coordenação bidirecional de sessão está protegida.');

const launcher = read('scripts/install-partner-launcher.mjs');
const ackIndex = launcher.indexOf("import './harden-partner-location-startup-ack.mjs';");
const nativeSyncIndex = launcher.indexOf("import './harden-partner-location-session-sync.mjs';");
const routingIndex = launcher.indexOf("import './harden-partner-location-notification-routing.mjs';");
if (!(ackIndex >= 0 && nativeSyncIndex > ackIndex && routingIndex > nativeSyncIndex)) {
  console.error('[FAIL] Android: session-sync precisa rodar após startup ACK/retry e antes do roteamento/validação final.');
  failed = true;
} else console.log('[OK] Ordem Android da coordenação de sessão está protegida.');

requireAll('scripts/verify-partner-native-plugins.mjs', [
  'public void updateSession(PluginCall call)',
  'private void loadPersistedSessionTokens()',
  'remove(SESSION_ACCESS_KEY)',
  'remove(SESSION_REFRESH_KEY)',
], 'Validação final exige atualização de sessão sem restart, leitura de tokens atuais e limpeza no OFFLINE');

if (!failed) console.log('[OK] Partner native session v15: sessão WebView/FGS fica coordenada nos dois sentidos sem reiniciar serviço e credenciais são limpas no stop.');
process.exit(failed ? 1 : 0);
