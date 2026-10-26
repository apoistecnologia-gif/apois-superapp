import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Entregas brand sweep v24: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Entregas brand sweep v24: ${message}`);
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

const sweep = read('scripts/harden-entregas-brand-sweep.mjs');
for (const marker of [
  "const isCustomerWorkspace = workspace === '.work/entregas';",
  "const brandPrimary = '#E51B23';",
  "const brandSecondary = '#C9141B';",
  "const brandPrimaryRgb = '229,27,35';",
  "const brandSecondaryRgb = '201,20,27';",
  'Estados semânticos continuam livres para green/red/amber',
]) {
  if (!sweep.includes(marker)) fail(`sweep incompleto: ${marker}`);
}
if (!failed) ok('varredura usa a identidade vermelho/branco tanto no Cliente quanto no Parceiro');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.includes("import './harden-entregas-brand-sweep.mjs';")) fail('Cliente Entregas não executa brand sweep no pipeline');
else ok('Cliente Entregas executa brand sweep antes da compilação');

const courierMap = read('scripts/harden-partner-entregador-map.mjs');
for (const marker of [
  "import './harden-partner-entregador-theme.mjs';",
  "import './harden-entregas-brand-sweep.mjs';",
  'const APOIS_RED = "#E51B23";',
]) {
  if (!courierMap.includes(marker)) fail(`Entregador sem proteção visual final: ${marker}`);
}
const partnerRed = read('scripts/harden-partner-red-visual.mjs');
for (const marker of ['APOIS_PARTNER_COURIER_RED_VISUAL_V1', '#E51B23', '#C9141B']) {
  if (!partnerRed.includes(marker)) fail(`Entregador sem migração visual final: ${marker}`);
}
if (!failed) ok('Entregador aplica identidade vermelho/branco e rota vermelha APOIS após o hardening operacional');

const brandTheme = read('scripts/harden-entregas-superapp-brand-theme.mjs');
for (const marker of ['APOIS_CUSTOMER_RED_V2', '#E51B23', '#C9141B']) {
  if (!brandTheme.includes(marker)) fail(`tema Cliente sem marcador ${marker}`);
}
if (!failed) ok('tema Cliente Entregas está na nova identidade vermelha');

process.exit(failed ? 1 : 0);
