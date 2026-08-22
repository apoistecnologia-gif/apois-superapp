import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner operational role v10: arquivo ausente ${path}`);
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

requireAll('scripts/harden-partner-motorista-operational-lock.mjs', [
  'apois-parceiro:operational-role',
  'localStorage.setItem("apois-parceiro:operational-role", "motorista")',
  'localStorage.removeItem("apois-parceiro:operational-role")',
  'apois:driver:online',
  'SIGNED_OUT',
], 'Motorista grava trava operacional quando ONLINE e limpa somente na reconciliação de saída');

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-operational-lock.mjs';",
], 'Pipeline oficial do Motorista aplica trava operacional');

requireAll('scripts/harden-partner-entregador-operational-lock.mjs', [
  'apois-parceiro:operational-role',
  'localStorage.setItem("apois-parceiro:operational-role", "entregador")',
  'availabilityRes.data?.is_online || jobsRes.data',
  'localStorage.removeItem("apois-parceiro:operational-role")',
  'stopCourierNativeLocation',
  'removeCourierPushRegistration',
], 'Entregador reafirma trava por estado backend/entrega ativa e limpa após OFFLINE/logout/troca');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-background-location.mjs';",
  "import './harden-partner-entregador-operational-lock.mjs';",
  "import './harden-partner-entregador-back-navigation.mjs';",
], 'Pipeline Entregador aplica trava depois do ciclo de background e antes do guard de navegação');

requireAll('superapp/partner-shell/index.html', [
  "const PARTNER_OPERATIONAL_ROLE_KEY='apois-parceiro:operational-role';",
  'function operationalRole()',
  'function operationalHome(role)',
  'function routeRole(requestedRole,target)',
  'if(locked&&locked!==requestedRole)',
  'window.location.replace(operationalHome(locked))',
  'const lockedOnLaunch=operationalRole();',
  'if(lockedOnLaunch)',
  "if(isDelivery)return routeRole('entregador'",
  "if(isRide)return routeRole('motorista'",
], 'Shell redireciona relançamento, seletor, push e deep links para a função que continua operacional');

if (!failed) console.log('[OK] Partner operational role v10: nenhuma entrada normal do shell permite iniciar a outra função enquanto Motorista/Entregador permanece operacional.');
process.exit(failed ? 1 : 0);
