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
  'APOIS_PARTNER_DRIVER_OPERATIONAL_LOCK_SIGNOUT',
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
  "import './harden-partner-entregador-background-reconciliation.mjs';",
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
const reconciliationIndex = courierPipeline.indexOf("import './harden-partner-entregador-background-reconciliation.mjs';");
const lockIndex = courierPipeline.indexOf("import './harden-partner-entregador-operational-lock.mjs';");
const backIndex = courierPipeline.indexOf("import './harden-partner-entregador-back-navigation.mjs';");
if (!(stateIndex >= 0 && backgroundIndex > stateIndex && reconciliationIndex > backgroundIndex && lockIndex > reconciliationIndex && backIndex > lockIndex)) {
  console.error('[FAIL] Pipeline Entregador: reconciliação/background/trava/back guard estão fora da ordem segura.');
  failed = true;
} else {
  console.log('[OK] Pipeline Entregador aplica reconciliação e trava na ordem segura.');
}

requireAll('superapp/partner-shell/index.html', [
  "const PARTNER_OPERATIONAL_ROLE_KEY='apois-parceiro:operational-role';",
  'function operationalRole()',
  'function operationalHome(role)',
  'function routeRole(requestedRole,target)',
  'if(locked&&locked!==requestedRole)',
  'window.location.replace(operationalHome(locked))',
  "if(isDelivery)return routeRole('entregador'",
  "if(isRide)return routeRole('motorista'",
], 'Shell possui roteamento base protegido por função operacional');

requireAll('scripts/harden-partner-shell-startup.mjs', [
  'async function bootPartnerShell()',
  'const launch=await appPlugin.getLaunchUrl();',
  'if(launch?.url&&relayDeepLink(launch.url))return;',
  'const lockedOnLaunch=operationalRole();',
  'consumePendingPartnerPush();',
  'trava operacional ainda executa antes do deep link de lançamento',
], 'Bootstrap processa callback que lançou o app antes do redirect operacional');
requireAll('superapp/partner-shell/build.mjs', [
  "import '../../scripts/harden-partner-shell-startup.mjs';",
  'const launch=await appPlugin.getLaunchUrl();',
  'redirect operacional ainda pode descartar deep link',
], 'Build aplica e valida bootstrap seguro do shell');

if (!failed) console.log('[OK] Partner operational role v10: uma única função operacional é preservada sem descartar callbacks nativos de lançamento.');
process.exit(failed ? 1 : 0);
