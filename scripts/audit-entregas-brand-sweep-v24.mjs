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
  "legacyPurpleHex = ['#6A1B9A', '#6a1b9a']",
  "legacyTealHex = ['#35A9C9', '#35a9c9', '#1F7894', '#1f7894']",
  "legacyGoldHex = ['#FFD700', '#F6B900', '#FACC15', '#F6BE1C', '#C88A08']",
  "replaceAll(value, '#E51B23')",
  "replace('const BRAND_GREEN = \"#39B54A\";', 'const BRAND_GREEN = \"#E51B23\";')",
  '/apois.*logo.*\\.svg$/i',
  "replaceAll('#39B54A', '#E51B23')",
  'Verde semântico continua preservado',
]) {
  if (!sweep.includes(marker)) fail(`sweep incompleto: ${marker}`);
}
if (!failed) ok('varredura remove somente identidade antiga e não converte verde semântico de forma genérica');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.includes("import './harden-entregas-brand-sweep.mjs';")) fail('Cliente Entregas não executa brand sweep no pipeline');
else ok('Cliente Entregas executa brand sweep antes da compilação');

const courierMap = read('scripts/harden-partner-entregador-map.mjs');
for (const marker of [
  "import './harden-partner-entregador-theme.mjs';",
  "import './harden-entregas-brand-sweep.mjs';",
  'const APOIS_PRIMARY = "#E51B23";',
  'strokeColor: APOIS_PRIMARY',
  "source.includes('const BRAND_PURPLE') || source.includes('const BRAND_GREEN')",
]) {
  if (!courierMap.includes(marker)) fail(`Entregador sem proteção final: ${marker}`);
}
if (!failed) ok('Entregador aplica tema, varredura e rota própria em vermelho APOIS');

const brandTheme = read('scripts/harden-entregas-superapp-brand-theme.mjs');
for (const marker of ['APOIS_CUSTOMER_UNIFIED_LIGHT_V1','#E51B23','#F7F7F8','#FFFFFF','#E2E4E8']) {
  if (!brandTheme.includes(marker)) fail(`tema Cliente sem marcador ${marker}`);
}
if (!failed) ok('tema Cliente usa a base clara unificada');

process.exit(failed ? 1 : 0);
