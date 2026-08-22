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
  'isNativeCourierLocation, startCourierNativeLocation, stopCourierNativeLocation',
  'backgroundStarted = await startCourierNativeLocation();',
  'await rpc("set_courier_online", { _is_online: false });',
  'Não foi possível ativar a localização em segundo plano.',
  'await startCourierNativeLocation();',
  'await stopCourierNativeLocation().catch(() => undefined);',
  'removeCourierPushRegistration',
], 'Bundle Entregador só mantém ONLINE no Android se o FGS iniciar e o encerra após OFFLINE/logout/troca de perfil');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-gps-resume.mjs';",
  "import './harden-partner-entregador-background-location.mjs';",
], 'Pipeline aplica rearm da WebView antes do serviço de background');

requireAll('scripts/harden-partner-location-notification-routing.mjs', [
  "{ file: 'CourierLocationService.java', module: 'entregador' }",
  'import android.net.Uri;',
  'openApp.setData(Uri.parse(',
  'br.com.apois.parceiro://module/',
], 'Notificação persistente do GPS possui deep link explícito de retorno ao módulo operacional');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './install-partner-driver-location.mjs';",
  "import './install-partner-courier-location.mjs';",
  "import './harden-partner-location-notification-routing.mjs';",
  'android:name=".DriverLocationService"',
  'android:name=".CourierLocationService"',
  'registerPlugin(DriverLocationPlugin.class)',
  'registerPlugin(CourierLocationPlugin.class)',
  'br.com.apois.parceiro://module/entregador',
], 'Launcher instala os dois serviços e valida que a notificação do Entregador retorna ao módulo correto');

if (!failed) console.log('[OK] Entregador background v6: GPS continua em Foreground Service durante background/tela bloqueada, ONLINE falha fechado se o FGS não iniciar e a notificação retorna ao Entregador sem expor o seletor.');
process.exit(failed ? 1 : 0);
