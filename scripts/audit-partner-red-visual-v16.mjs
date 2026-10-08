import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { failed = true; console.error('[FAIL] Partner red visual v16: ' + message); };
const ok = (message) => console.log('[OK] Partner red visual v16: ' + message);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    fail('arquivo ausente: ' + path);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(label + ': ausente ' + missing.join(' | '));
  else ok(label);
}

function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) fail(label + ': legado encontrado ' + found.join(' | '));
  else ok(label);
}

requireAll('superapp/partner-shell/index.html', [
  '--red:#E51B23',
  '--red-dark:#C9141B',
  'APOIS <em>Parceiro</em>',
  'Escolha como você deseja trabalhar na APOIS.',
  'Sou <em>Motorista</em>',
  'Sou <em>Entregador</em>',
  'background:linear-gradient(135deg,#ff2733,#f71320 58%,#df0d18)',
  'background:#F7F7F8',
], 'seletor Parceiro replica a referência aprovada com superfícies claras e CTA vermelho');

requireAll('superapp/partner-shell/build.mjs', [
  'apois-client-red-logo.b64',
  'Motorista usa identidade vermelho/branco sem dourado antigo',
  'Entregador usa identidade vermelho/branco sem dourado antigo',
], 'empacotamento final usa logo vermelha e bloqueia bundle legado');

requireAll('scripts/harden-partner-motorista-brand-theme.mjs', [
  'return "light";',
  'applyThemeClass("light");',
  "r.classList.add('light');r.classList.remove('dark');r.style.colorScheme='light';",
  'identidade visual clara vermelho/branco',
], 'Motorista inicia e permanece em tema claro');

requireAll('scripts/harden-partner-red-visual.mjs', [
  'APOIS_PARTNER_RED_VISUAL_V1',
  'APOIS_PARTNER_COURIER_RED_VISUAL_V1',
  'apois-client-red-logo.b64',
  '--primary: 358 79% 50%',
  '--accent: 358 82% 43%',
  '#E51B23',
  '#C9141B',
  '#F7F7F8',
], 'hardener final cobre Motorista, Entregador, tokens e logo');

requireAll('scripts/harden-partner-entregador-theme.mjs', [
  'APOIS_PARTNER_COURIER_RED_V2',
  '--primary: oklch(0.59 0.24 27)',
  '#E51B23',
  '#C9141B',
  '#F7F7F8',
], 'Entregador usa tema vermelho/branco nativo');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  'const APOIS_RED = "#E51B23";',
  'strokeColor: APOIS_RED',
], 'rota visual do Entregador usa vermelho APOIS');

requireAll('superapp/partner-shell/capacitor.config.ts', [
  "backgroundColor: '#F7F7F8'",
  "style: 'DARK'",
], 'status bar e WebView do Parceiro acompanham fundo claro');

requireAll('scripts/install-partner-launcher.mjs', [
  'apois-client-red-logo.b64',
  '<solid android:color="#F7F7F8" />',
], 'launcher usa marca vermelha oficial sobre fundo claro');

requireAll('scripts/sanitize-partner-launcher-resources.mjs', [
  'apois-client-red-logo.b64',
  'apois-partner-red-logo-sanitized.png',
], 'sanitização final não restaura launcher antigo');

requireAll('scripts/install-partner-splash.mjs', [
  "const LIGHT_BG = '#F7F7F8';",
  '@mipmap/ic_launcher',
  'marca vermelha oficial centralizada',
], 'splash usa fundo claro e marca nova');

requireAll('codemagic.yaml', [
  'windowSplashScreenBackground">#F7F7F8<',
  "grep -R -Fq '#E51B23' superapp/partner-shell/dist/modules/motorista",
  "grep -R -Fq '#E51B23' superapp/partner-shell/dist/modules/entregador",
  'identidade dourada antiga permaneceu no bundle Parceiro',
], 'CodeMagic rejeita build sem identidade vermelha final');

forbidAll('scripts/harden-partner-entregador-theme.mjs', [
  'tema preto/dourado',
], 'tema Entregador não preserva identidade antiga');

// O hardener cita APOIS_PARTNER_COURIER_GOLD_V1 apenas dentro da própria
// lista de rejeição. Isso não representa tema legado aplicado ao runtime.
// A identidade efetiva é validada pelos marcadores RED_V2 acima.
forbidAll('superapp/partner-shell/index.html', [
  '--gold:#f6be1c',
  'background:#050505',
], 'seletor Parceiro não usa tema preto/dourado antigo');
forbidAll('scripts/sanitize-partner-launcher-resources.mjs', [
  "superapp/branding/apois-launcher.png",
], 'sanitização não volta para launcher antigo');

if (!failed) console.log('[OK] Partner red visual v16: auditoria completa aprova seletor, Motorista, Entregador, mapa, logo, launcher, splash e gates de release.');
process.exit(failed ? 1 : 0);
