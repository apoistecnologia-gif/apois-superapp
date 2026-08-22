import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner notification routing v9: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-location-notification-routing.mjs', [
  'DriverLocationService.java',
  'CourierLocationService.java',
  'br.com.apois.parceiro://module/motorista',
  'br.com.apois.parceiro://module/entregador',
  'openApp.setData(Uri.parse(',
], 'Notificações persistentes de GPS recebem deep links por função');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './harden-partner-location-notification-routing.mjs';",
  'br.com.apois.parceiro://module/motorista',
  'br.com.apois.parceiro://module/entregador',
], 'Launcher bloqueia Android se notificações de GPS não retornarem ao módulo correto');

requireAll('superapp/partner-shell/index.html', [
  "rawUrl.startsWith('br.com.apois.parceiro://')",
  "incoming.host==='module'&&path==='motorista'",
  "incoming.host==='module'&&path==='entregador'",
  "window.location.assign('./modules/motorista/index.html#/motorista/app')",
  "window.location.assign('./modules/entregador/index.html')",
  "incoming.host==='auth' && (path==='callback'||path==='reset')",
], 'Shell trata deep links operacionais sem confundi-los com OAuth/reset');

if (!failed) console.log('[OK] Partner notification routing v9: tocar na notificação de GPS volta à função ativa, não ao seletor que permitiria troca indevida de módulo.');
process.exit(failed ? 1 : 0);
