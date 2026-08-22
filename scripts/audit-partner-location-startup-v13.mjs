import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner location startup v13: arquivo ausente ${path}`);
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

requireAll('scripts/install-partner-driver-location.mjs', [
  'STARTUP_KEY = "driver_running"',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.edit().putBoolean(STARTUP_KEY, false).commit()',
  'boolean started = startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do motorista não confirmou a inicialização.',
  'private void setStartupConfirmed(boolean running)',
  'setStartupConfirmed(true);',
  'setStartupConfirmed(false);',
], 'DriverLocation instala ACK real antes do hardening de retry');

requireAll('scripts/harden-partner-location-startup-ack.mjs', [
  'STARTUP_KEY = "courier_running"',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.edit().putBoolean(STARTUP_KEY, false).commit()',
  'startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do entregador não confirmou a inicialização.',
  'private void setStartupConfirmed(boolean running)',
  "await import('./harden-partner-location-startup-retry.mjs');",
  'com retry antes do fail-safe',
], 'CourierLocation recebe ACK real e depois aplica retry resiliente nos dois plugins');

requireAll('scripts/harden-partner-location-startup-retry.mjs', [
  "{ file: 'DriverLocationPlugin.java', label: 'Motorista'",
  "{ file: 'CourierLocationPlugin.java', label: 'Entregador'",
  'STARTUP_ACK_MAX_ATTEMPTS = 4',
  'resolveStartup(call, startup, 1);',
  'private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)',
  'attempt >= STARTUP_ACK_MAX_ATTEMPTS',
  '() -> resolveStartup(call, startup, attempt + 1)',
], 'Motorista e Entregador toleram startup lento antes de declarar falha do serviço');

const launcher = read('scripts/install-partner-launcher.mjs');
for (const marker of [
  "import './install-partner-driver-location.mjs';",
  "import './install-partner-courier-location.mjs';",
  "import './harden-partner-location-startup-ack.mjs';",
  "import './harden-partner-location-session-sync.mjs';",
  "import './harden-partner-location-notification-routing.mjs';",
  'driver_running',
  'courier_running',
  'STARTUP_ACK_DELAY_MS = 900L',
  'setStartupConfirmed(true);',
]) {
  if (!launcher.includes(marker)) {
    console.error(`[FAIL] Launcher não exige startup ACK real: ${marker}`);
    failed = true;
  }
}
const driverIndex = launcher.indexOf("import './install-partner-driver-location.mjs';");
const courierIndex = launcher.indexOf("import './install-partner-courier-location.mjs';");
const ackIndex = launcher.indexOf("import './harden-partner-location-startup-ack.mjs';");
const sessionIndex = launcher.indexOf("import './harden-partner-location-session-sync.mjs';");
const routingIndex = launcher.indexOf("import './harden-partner-location-notification-routing.mjs';");
if (!(driverIndex >= 0 && courierIndex > driverIndex && ackIndex > courierIndex && sessionIndex > ackIndex && routingIndex > sessionIndex)) {
  console.error('[FAIL] Ordem Android incorreta: ACK/retry precisa rodar depois dos serviços e antes de sessão/roteamento.');
  failed = true;
} else console.log('[OK] Ordem Android do startup ACK/retry está protegida.');

requireAll('scripts/verify-partner-native-plugins.mjs', [
  'STARTUP_ACK_MAX_ATTEMPTS = 4',
  'private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)',
  'attempt >= STARTUP_ACK_MAX_ATTEMPTS',
], 'Validação pós-cap sync rejeita APK sem retry de startup nativo');

requireAll('scripts/harden-partner-motorista-background-failsafe.mjs', [
  'background_location_unavailable',
  'background_location_unavailable_offline_unconfirmed',
], 'Motorista reage ao started=false sem manter disponibilidade falsa');
requireAll('scripts/harden-partner-entregador-background-location.mjs', [
  'backgroundStarted = await startCourierNativeLocation();',
  'if (!backgroundStarted)',
  'Não foi possível ativar a localização em segundo plano.',
], 'Entregador reage ao started=false sem manter disponibilidade falsa');

if (!failed) console.log('[OK] Partner location startup v13: GPS só confirma FGS após ACK real e tolera aparelhos lentos antes do fail-safe.');
process.exit(failed ? 1 : 0);
