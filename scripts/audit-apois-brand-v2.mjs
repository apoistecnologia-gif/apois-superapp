import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] APOIS Visual Identity: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] APOIS Visual Identity: ${message}`);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

function luminance(hex) {
  const rgb = [1,3,5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const tokens = JSON.parse(read('design-system/apois-brand-v2.json') || '{}');
const requiredPalette = {
  primary:'#E51B23',
  primaryHover:'#C9141B',
  primaryPressed:'#A90F15',
  primarySoft:'#FFF1F2',
  black:'#111111',
  blackSecondary:'#242424',
  white:'#FFFFFF',
  background:'#F7F7F8',
  surfaceSecondary:'#F1F2F4',
  border:'#E2E4E8',
  textSecondary:'#666B73',
  textDisabled:'#9CA1A9',
};
for (const [key, value] of Object.entries(requiredPalette)) {
  if (tokens?.palette?.[key] !== value) fail(`token ${key} deveria ser ${value}`);
}
if (!failed) ok('paleta clara oficial vermelho/preto/branco/cinzas está centralizada');

for (const semantic of [
  'background','surface','surfaceElevated','primaryBrand','primary','primaryHover',
  'primaryForeground','secondary','accent','accentForeground','textPrimary',
  'textSecondary','textMuted','border','input','destructive','success','warning','info'
]) {
  if (!tokens?.semantic?.[semantic]) fail(`token semântico ausente: ${semantic}`);
}
if (!failed) ok('tokens semânticos cobrem ação, superfície, estrutura e feedback sem substituir status');

const actionContrast = contrast(tokens.semantic.primary, tokens.semantic.primaryForeground);
if (actionContrast < 4.5) fail(`CTA primário não atende contraste AA normal (${actionContrast.toFixed(2)}:1)`);
else ok(`CTA primário com texto branco atende contraste AA (${actionContrast.toFixed(2)}:1)`);

const css = read('design-system/apois-brand-v2.css');
for (const marker of [
  '--apois-primary: #E51B23',
  '--apois-primary-hover: #C9141B',
  '--apois-primary-soft: #FFF1F2',
  '--background: #F7F7F8',
  '--surface: #FFFFFF',
  '--surface-2: #F1F2F4',
  '--border: #E2E4E8',
  '--text-primary: #111111',
  '--text-secondary: #666B73',
  '--muted-foreground: #9CA1A9',
  '--success: #16A34A',
  '--warning: #F59E0B',
  '--info: #2563EB',
  'color-scheme: light',
]) {
  if (!css.includes(marker)) fail(`CSS central sem marcador: ${marker}`);
}
if (!failed) ok('CSS central expõe identidade clara e preserva tokens semânticos');

const wordmark = read('superapp/branding/apois-wordmark-v3.svg');
const mark = read('superapp/branding/apois-mark-v3.svg');
for (const [label, source] of [['wordmark',wordmark],['mark',mark]]) {
  for (const marker of ['#E51B23','#C9141B','#111111']) {
    if (!source.includes(marker)) fail(`${label} sem cor oficial ${marker}`);
  }
  for (const forbidden of ['#F5222D','#FF1F2D','#9E1018','#D9A520','#F4C44E','#A97808']) {
    if (source.includes(forbidden)) fail(`${label} ainda contém cor da identidade anterior: ${forbidden}`);
  }
}
if (!failed) ok('assets oficiais preservam geometria e usam vermelho/preto da nova identidade');

const applicator = read('scripts/apply-apois-brand-v2.mjs');
for (const marker of [
  "const MARKER_BEGIN = '/* APOIS_BRAND_V2_BEGIN */';",
  "case 'corridas':",
  "case 'entregas':",
  "case 'entregador':",
  "case 'motorista':",
  "case 'admin':",
  "case 'shell-client':",
  "case 'shell-partner':",
  '--apois-primary:',
  'APOIS_PRIMARY_CONTROL_STATES',
  'APOIS_DRIVER_BRAND_DETAILS',
  '--apois-primary-pressed:',
  '${primaryControlStates()}',
  "${primaryControlStates('.apois-system-theme')}",
  "${primaryControlStates('.apois-customer-theme')}",
  '${primaryControlStates(\'html[data-app-role="motorista"]\')}',
  "${primaryControlStates('.apois-admin-theme')}",
  'background-color: var(--apois-surface-secondary) !important;',
  'color: var(--apois-text-disabled) !important;',
  'color-scheme: light',
  "superapp/branding/apois-wordmark-v3.svg",
  "superapp/branding/apois-mark-v3.svg",
]) {
  if (!applicator.includes(marker)) fail(`aplicador central sem marcador: ${marker}`);
}
if (!failed) ok('aplicador central cobre Passageiro, Entregas, Parceiro, Admin e shells');

const modules = read('.apois/modules.json');
for (const marker of ['apply-apois-brand-v2.mjs corridas','apply-apois-brand-v2.mjs entregas']) {
  if (!modules.includes(marker)) fail(`cadeia de módulos não aplica identidade: ${marker}`);
}
const corridasUi = modules.indexOf('harden-corridas-reference-ui-v4.mjs');
const corridasBrand = modules.indexOf('apply-apois-brand-v2.mjs corridas');
if (!(corridasUi >= 0 && corridasBrand > corridasUi)) fail('Corridas não aplica identidade central como última camada visual');
else ok('Corridas aplica a identidade central depois dos hardeners visuais');

for (const [path, markers] of [
  ['scripts/build-partner-release.sh', ['apply-apois-brand-v2.mjs" motorista','apply-apois-brand-v2.mjs" entregador']],
  ['scripts/build-partner-modules.sh', ['apply-apois-brand-v2.mjs" motorista','apply-apois-brand-v2.mjs" entregador']],
  ['scripts/build-motorista-module.mjs', ["apply-apois-brand-v2.mjs'), 'motorista'"]],
  ['scripts/build-admin-corridas.mjs', ["apply-apois-brand-v2.mjs'), 'admin'"]],
  ['scripts/build-merchant-panel.mjs', ["apply-apois-brand-v2.mjs'), 'entregas'"]],
  ['superapp/shell/build.mjs', ["'shell-client'"]],
  ['superapp/partner-shell/build.mjs', ["'shell-partner'"]],
]) {
  const source = read(path);
  for (const marker of markers) if (!source.includes(marker)) fail(`${path} sem ${marker}`);
}
if (!failed) ok('cadeias de build relevantes continuam aplicando somente a camada visual central');

const superLauncher = read('scripts/install-superapp-launcher.mjs');
for (const marker of ['#FFFFFF','#E51B23','#111111','apois_launcher_mark']) {
  if (!superLauncher.includes(marker)) fail(`launcher Superapp sem ${marker}`);
}
const partnerLauncher = read('scripts/install-partner-launcher.mjs');
for (const marker of ['#FFFFFF','#E51B23','#111111','apois_launcher_mark']) {
  if (!partnerLauncher.includes(marker)) fail(`launcher Parceiro sem ${marker}`);
}
if (!failed) ok('launcher/splash usam símbolo oficial vermelho/preto sobre fundo branco');

const packageJson = JSON.parse(read('package.json') || '{}');
if (!String(packageJson.scripts?.['audit:ui'] ?? '').includes('audit-apois-brand-v2.mjs')) {
  fail('audit:ui não inclui o gate da identidade APOIS');
} else ok('gate visual central está encadeado no audit:ui');

process.exit(failed ? 1 : 0);
