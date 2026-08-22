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
  "legacyGreenHex = ['#39B54A', '#39b54a']",
  "legacyPurpleHex = ['#6A1B9A', '#6a1b9a']",
  "legacyTealHex = ['#35A9C9', '#35a9c9', '#1F7894', '#1f7894']",
  ".replaceAll('rgba(57,181,74,', 'rgba(246,190,28,')",
  ".replaceAll('rgba(106,27,154,', 'rgba(200,138,8,')",
  "/apois.*logo.*\\.svg$/i",
  'Estados semânticos continuam livres para green/red/amber',
]) {
  if (!sweep.includes(marker)) fail(`sweep incompleto: ${marker}`);
}
if (!failed) ok('varredura cobre verde/roxo/ciano antigos, sombras e logos sem proibir estados semânticos');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.includes("import './harden-entregas-brand-sweep.mjs';")) fail('Cliente Entregas não executa brand sweep no pipeline');
else ok('Cliente Entregas executa brand sweep antes da compilação');

const courierMap = read('scripts/harden-partner-entregador-map.mjs');
for (const marker of [
  "import './harden-partner-entregador-theme.mjs';",
  "import './harden-entregas-brand-sweep.mjs';",
  'const APOIS_GOLD = "#F6BE1C";',
  "source.includes('const BRAND_PURPLE') || source.includes('const BRAND_GREEN')",
]) {
  if (!courierMap.includes(marker)) fail(`Entregador sem proteção final: ${marker}`);
}
if (!failed) ok('Entregador aplica tema, varredura e rota dourada sem constantes antigas');

const brandTheme = read('scripts/harden-entregas-superapp-brand-theme.mjs');
for (const marker of ['APOIS_CUSTOMER_GOLD_V1', '#F6BE1C', '#C88A08', '#050505']) {
  if (!brandTheme.includes(marker)) fail(`tema Cliente sem marcador ${marker}`);
}
if (!failed) ok('tema Cliente preserva base preto/dourado oficial');

process.exit(failed ? 1 : 0);
