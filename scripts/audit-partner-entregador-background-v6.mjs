import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Entregador background v6: arquivo ausente ${path}`);
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
function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/install-partner-courier-location.mjs', [
  '@CapacitorPlugin(name = "CourierLocation")',
  'CourierLocationService.class',
  'FOREGROUND_SERVICE_TYPE_LOCATION',
  'START_REDELIVER_INTENT',
  'update_courier_location',
  '"_accuracy_meters"',
  '"_heading"',
  '"_speed_mps"',
  'refresh_token',
  'HEARTBEAT_MS = 45_000L',
  'MIN_SEND_DISTANCE_METERS = 30f',
  'android:name=".CourierLocationService"',
  'registerPlugin(CourierLocationPlugin.class)',
], 'Host Android instala Foreground Service real do Entregador com heartbeat e refresh de sessão');
forbidAll('scripts/install-partner-courier-location.mjs', [
  "ensurePermission('android.permission.ACCESS_BACKGROUND_LOCATION')",
], 'Serviço do Entregador não solicita permissão ACCESS_BACKGROUND_LOCATION');

requireAll('scripts/harden-partner-entregador-background-location.mjs', [
  'src/lib/courierNativeLocation.ts',
  'registerPlugin<CourierLocationPlugin>("CourierLocation")',
  'startCourierNativeLocation()',
  'stopCourierNativeLocation()',
  'await startCourierNativeLocation();',
  'await stopCourierNativeLocation().catch(() => undefined);',
  'removeCourierPushRegistration',
  'set_courier_online',
], 'Bundle Entregador inicia FGS quando online e o encerra após OFFLINE/logout/troca de perfil');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-gps-resume.mjs';",
  "import './harden-partner-entregador-background-location.mjs';",
], 'Pipeline aplica rearm da WebView antes do serviço de background');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './install-partner-driver-location.mjs';",
  "import './install-partner-courier-location.mjs';",
  'android:name=".DriverLocationService"',
  'android:name=".CourierLocationService"',
  'registerPlugin(DriverLocationPlugin.class)',
  'registerPlugin(CourierLocationPlugin.class)',
], 'Launcher exige os dois serviços de localização do APOIS Parceiro');

if (!failed) console.log('[OK] Entregador background v6: GPS continua em Foreground Service durante background/tela bloqueada e encerra de forma reconciliada ao sair da operação.');
process.exit(failed ? 1 : 0);
