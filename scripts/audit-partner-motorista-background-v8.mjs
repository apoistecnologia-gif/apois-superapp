import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista background v8: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-motorista-background-failsafe.mjs', [
  'src/hooks/useDriverBroadcast.ts',
  'await setPresence(false, null);',
  'reason: "background_location_unavailable"',
  '.catch(async (error: unknown) =>',
  'detail?.reason !== "background_location_unavailable"',
  'stopDriverWatch();',
  'setDesiredOnline(false);',
  'Modo online desativado porque a localização em segundo plano não iniciou.',
], 'Motorista volta backend/UI para OFFLINE se o serviço de background falhar');

requireAll('scripts/harden-partner-motorista-native-watch.mjs', [
  "await import('./harden-partner-motorista-background-failsafe.mjs');",
  'const stopDriverWatch = useCallback',
], 'Fail-safe executa somente depois de o watcher nativo e stopDriverWatch existirem');

requireAll('scripts/harden-partner-motorista-native-gps.mjs', [
  'const capacitorImportCount = (source.match',
  'capacitorImportCount !== 1',
  'back-navigation roda antes deste hardener',
], 'GPS nativo tolera a ordem do pipeline e bloqueia import Capacitor duplicado');

const paymentPolicy = read('scripts/harden-partner-motorista-payment-policy.mjs');
const backIndex = paymentPolicy.indexOf("import './harden-partner-motorista-back-navigation.mjs';");
if (backIndex < 0) {
  console.error('[FAIL] Motorista background v8: back-navigation não está no pipeline que antecede native-gps');
  failed = true;
}

requireAll('scripts/install-partner-driver-location.mjs', [
  '@CapacitorPlugin(name = "DriverLocation")',
  'FOREGROUND_SERVICE_TYPE_LOCATION',
  'driver_set_presence',
  'registerPlugin(DriverLocationPlugin.class)',
], 'Host Android contém serviço nativo real do Motorista');

if (!failed) console.log('[OK] Motorista background v8: presença/GPS de background e ordem de imports estão protegidos contra regressão de compilação.');
process.exit(failed ? 1 : 0);
