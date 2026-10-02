import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] APOIS Brand V2: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] APOIS Brand V2: ${message}`);

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
  black: '#08090B',
  blackSecondary: '#111318',
  blackElevated: '#181A20',
  red: '#F5222D',
  redStrong: '#FF1F2D',
  redDark: '#9E1018',
  white: '#FFFFFF',
  whiteSecondary: '#F3F3F3',
  textMuted: '#A6A8AE',
  gold: '#D9A520',
  goldLight: '#F4C44E',
  goldDark: '#A97808',
};
for (const [key, value] of Object.entries(requiredPalette)) {
  if (tokens?.palette?.[key] !== value) fail(`token ${key} deveria ser ${value}`);
}
if (!failed) ok('paleta oficial preto/vermelho/branco/dourado está centralizada');

for (const semantic of [
  'background','surface','surfaceElevated','primaryBrand','primary','primaryHover',
  'primaryForeground','secondary','accent','accentForeground','textPrimary',
  'textSecondary','textMuted','border','input','destructive','success','warning','info'
]) {
  if (!tokens?.semantic?.[semantic]) fail(`token semântico ausente: ${semantic}`);
}
if (!failed) ok('tokens semânticos cobrem superfícies, ações, texto, estrutura e feedback');

const actionContrast = contrast(tokens.semantic.primary, tokens.semantic.primaryForeground);
if (actionContrast < 4.5) fail(`CTA primário não atende contraste AA normal (${actionContrast.toFixed(2)}:1)`);
else ok(`CTA primário com texto branco atende contraste AA (${actionContrast.toFixed(2)}:1)`);

const css = read('design-system/apois-brand-v2.css');
for (const marker of [
  '--background: #08090B',
  '--surface: #111318',
  '--surface-elevated: #181A20',
  '--primary-brand: #F5222D',
  '--primary: #D91E27',
  '--accent: #D9A520',
  '--text-primary: #FFFFFF',
  '--text-secondary: #F3F3F3',
  '--muted-foreground: #A6A8AE',
  '--success: #2FB171',
  '--warning: #F4C44E',
]) {
  if (!css.includes(marker)) fail(`CSS central sem marcador: ${marker}`);
}
if (!failed) ok('CSS central expõe os tokens solicitados');

const applicator = read('scripts/apply-apois-brand-v2.mjs');
if (!applicator.includes("const MARKER_BEGIN = '/* APOIS_BRAND_V2_BEGIN */';") ||
    !applicator.includes("const MARKER_END = '/* APOIS_BRAND_V2_END */';")) {
  fail('aplicador Brand V2 não usa marcadores CSS válidos');
}
if (applicator.includes("const begin = \`\${MARKER} BEGIN\`;") ||
    applicator.includes("const end = \`\${MARKER} END\`;")) {
  fail('aplicador Brand V2 ainda pode emitir BEGIN/END como tokens CSS crus');
}
for (const marker of [
  "case 'corridas':",
  "case 'entregas':",
  "case 'entregador':",
  "case 'motorista':",
  "case 'admin':",
  "case 'shell-client':",
  "case 'shell-partner':",
  'APOIS_BRAND_V2',
  'apois-primary',
]) {
  if (!applicator.includes(marker)) fail(`aplicador central sem alvo/marcador: ${marker}`);
}
if (!failed) ok('aplicador central atende Passageiro, Entregas, Parceiro, Admin e shells');

for (const marker of [
  'superapp/branding/apois-launcher.png',
  "['public/apois-logo.svg', 'public/apois-logo-customer.svg']",
  'data:image/png;base64',
]) {
  if (!applicator.includes(marker)) fail('aplicador central não propaga a nova logomarca: ' + marker);
}
if (!failed) ok('nova logomarca APOIS é propagada para Shells e Entregas');

const modules = read('.apois/modules.json');
for (const marker of [
  'apply-apois-brand-v2.mjs corridas',
  'apply-apois-brand-v2.mjs entregas',
]) {
  if (!modules.includes(marker)) fail(`cadeia de módulos não aplica Brand V2: ${marker}`);
}

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
if (!failed) ok('todas as cadeias de build relevantes aplicam a identidade centralizada');

const packageJson = JSON.parse(read('package.json') || '{}');
if (!String(packageJson.scripts?.['audit:ui'] ?? '').includes('audit-apois-brand-v2.mjs')) {
  fail('audit:ui não inclui o gate APOIS Brand V2');
} else ok('gate visual Brand V2 está encadeado no audit:ui');

process.exit(failed ? 1 : 0);
