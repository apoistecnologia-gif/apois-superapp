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

// O hardener gera os dois deep links a partir do campo `module`, portanto os
// literais finais não aparecem juntos no script-fonte. Validamos a lista de
// serviços/funções e a montagem do URI que será gravado em cada Java Service.
requireAll('scripts/harden-partner-location-notification-routing.mjs', [
  "{ file: 'DriverLocationService.java', module: 'motorista' }",
  "{ file: 'CourierLocationService.java', module: 'entregador' }",
  'const marker = `br.com.apois.parceiro://module/${module}`;',
  'openApp.setData(Uri.parse("${marker}"));',
  "source.includes('openApp.setData(Uri.parse(')",
], 'Notificações persistentes de GPS recebem deep links por função');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './harden-partner-location-notification-routing.mjs';",
  'br.com.apois.parceiro://module/motorista',
  'br.com.apois.parceiro://module/entregador',
], 'Launcher bloqueia Android se notificações de GPS não retornarem ao módulo correto');

// O shell atual centraliza a navegação operacional em routeRole/operationalUrls,
// que também respeita o lock de função. Não exigir window.location.assign direto,
// pois isso ignoraria justamente a proteção contra troca indevida de função.
requireAll('superapp/partner-shell/index.html', [
  "rawUrl.startsWith('br.com.apois.parceiro://')",
  "incoming.host==='module'&&path==='motorista'",
  "routeRole('motorista',operationalUrls.motorista)",
  "incoming.host==='module'&&path==='entregador'",
  "routeRole('entregador',operationalUrls.entregador)",
  "const operationalUrls={motorista:'./modules/motorista/index.html#/motorista/app',entregador:'./modules/entregador/index.html#/courier'};",
  "incoming.host==='auth' && (path==='callback'||path==='reset')",
], 'Shell trata deep links operacionais sem confundi-los com OAuth/reset');

if (!failed) console.log('[OK] Partner notification routing v9: tocar na notificação de GPS volta à função ativa, não ao seletor que permitiria troca indevida de módulo.');
process.exit(failed ? 1 : 0);
