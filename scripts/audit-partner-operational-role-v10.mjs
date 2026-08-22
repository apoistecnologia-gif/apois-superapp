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

const driverLock = read('scripts/harden-partner-motorista-operational-lock.mjs');
for (const marker of [
  'apois-parceiro:operational-role',
  'if (value) localStorage.setItem("apois-parceiro:operational-role", "motorista")',
  'if (publishOnline) window.localStorage.setItem("apois-parceiro:operational-role", "motorista")',
  'window.localStorage.removeItem("apois-parceiro:operational-role")',
  'return false;',
  'return true;',
  'apois:driver:online',
  'SIGNED_OUT',
]) {
  if (!driverLock.includes(marker)) {
    console.error(`[FAIL] Motorista trava operacional: proteção ausente ${marker}`);
    failed = true;
  }
}
if (driverLock.includes('else if (localStorage.getItem("apois-parceiro:operational-role") === "motorista") localStorage.removeItem("apois-parceiro:operational-role");\n      window.dispatchEvent')) {
  console.error('[FAIL] Motorista trava operacional: intenção OFFLINE ainda libera shell antes da RPC');
  failed = true;
} else {
  console.log('[OK] Motorista só libera trava após confirmação de driver_set_presence OFFLINE.');
}

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-operational-lock.mjs';",
], 'Pipeline oficial do Motorista aplica trava operacional');

requireAll('scripts/harden-partner-entregador-operational-lock.mjs', [
  'apois-parceiro:operational-role',
  'APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_RECONCILED',
  'APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_ONLINE',
  'APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_OFFLINE',
  'APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_LOGOUT',
  'APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_SWITCH',
  'if (!availabilityRes.error) setAvailability(availabilityRes.data ?? null);',
  'if (!jobsRes.error) setActiveJob(jobsRes.data ?? null);',
  'const availabilityConfirmedActive = !availabilityRes.error',
  'const jobConfirmedActive = !jobsRes.error',
  'const bothConfirmedInactive = !availabilityRes.error && !jobsRes.error',
  'localStorage.setItem("apois-parceiro:operational-role", "entregador")',
  'localStorage.removeItem("apois-parceiro:operational-role")',
  'stopCourierNativeLocation',
  'removeCourierPushRegistration',
], 'Entregador reconcilia trava com a forma pós-operation-states sem limpar estado válido em falha de refresh');

const courierPipeline = read('scripts/harden-partner-entregador-map.mjs');
for (const marker of [
  "import './harden-partner-entregador-operation-states.mjs';",
  "import './harden-partner-entregador-background-location.mjs';",
  "import './harden-partner-entregador-operational-lock.mjs';",
  "import './harden-partner-entregador-back-navigation.mjs';",
]) {
  if (!courierPipeline.includes(marker)) {
    console.error(`[FAIL] Pipeline Entregador sem etapa obrigatória: ${marker}`);
    failed = true;
  }
}
const stateIndex = courierPipeline.indexOf("import './harden-partner-entregador-operation-states.mjs';");
const backgroundIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-location.mjs';");
const lockIndex = courierPipeline.indexOf("import './harden-partner-entregador-operational-lock.mjs';");
const backIndex = courierPipeline.indexOf("import './harden-partner-entregador-back-navigation.mjs';");
if (!(stateIndex >= 0 && backgroundIndex > stateIndex && lockIndex > backgroundIndex && backIndex > lockIndex)) {
  console.error('[FAIL] Pipeline Entregador: operational-lock precisa rodar após operation-states/background-location e antes do back guard.');
  failed = true;
} else {
  console.log('[OK] Pipeline Entregador aplica trava na ordem compatível com estados e Foreground Service.');
}

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

if (!failed) console.log('[OK] Partner operational role v10: shell e módulos preservam uma única função operacional e só destravam após backend confirmado.');
process.exit(failed ? 1 : 0);
