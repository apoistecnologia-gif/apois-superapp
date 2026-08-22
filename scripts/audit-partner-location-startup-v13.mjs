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
], 'DriverLocation não confunde pedido de startForegroundService com Service realmente ativo');

requireAll('scripts/harden-partner-location-startup-ack.mjs', [
  'STARTUP_KEY = "courier_running"',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.edit().putBoolean(STARTUP_KEY, false).commit()',
  'startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do entregador não confirmou a inicialização.',
  'private void setStartupConfirmed(boolean running)',
  'DriverLocation e CourierLocation só retornam started=true após confirmação real',
], 'CourierLocation recebe ACK real e o hardener valida também o DriverLocation final');

const launcher = read('scripts/install-partner-launcher.mjs');
for (const marker of [
  "import './install-partner-driver-location.mjs';",
  "import './install-partner-courier-location.mjs';",
  "import './harden-partner-location-startup-ack.mjs';",
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
const routingIndex = launcher.indexOf("import './harden-partner-location-notification-routing.mjs';");
if (!(driverIndex >= 0 && courierIndex > driverIndex && ackIndex > courierIndex && routingIndex > ackIndex)) {
  console.error('[FAIL] Ordem Android incorreta: ACK precisa rodar depois dos dois serviços e antes do roteamento/validação final.');
  failed = true;
} else console.log('[OK] Ordem Android do startup ACK está protegida.');

requireAll('scripts/harden-partner-motorista-background-failsafe.mjs', [
  'background_location_unavailable',
  'background_location_unavailable_offline_unconfirmed',
], 'Motorista reage ao started=false sem manter disponibilidade falsa');
requireAll('scripts/harden-partner-entregador-background-location.mjs', [
  'backgroundStarted = await startCourierNativeLocation();',
  'if (!backgroundStarted)',
  'Não foi possível ativar a localização em segundo plano.',
], 'Entregador reage ao started=false sem manter disponibilidade falsa');

if (!failed) console.log('[OK] Partner location startup v13: Motorista e Entregador só consideram o FGS iniciado após confirmação real do Service/LocationUpdates.');
process.exit(failed ? 1 : 0);
