import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Unified brand theme v23: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Unified brand theme v23: ${message}`);
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

const customerTheme = read('scripts/harden-entregas-superapp-brand-theme.mjs');
for (const marker of [
  'APOIS_CUSTOMER_RED_V2',
  '--primary: oklch(0.59 0.24 27)',
  '#E51B23',
  '#C9141B',
  "replaceAll('#1F7894', '#C9141B')",
  "replaceAll('#35A9C9', '#E51B23')",
  'APOIS_CUSTOMER_LOGIN_LIGHT_V3',
  'data-apois-customer-login-red-v3',
  'apois-client-red-logo.png',
]) {
  if (!customerTheme.includes(marker)) fail(`Cliente Entregas sem regra de marca vermelha: ${marker}`);
}
if (!failed) ok('Cliente Entregas usa identidade APOIS vermelho/branco/preto');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.startsWith("import './harden-entregas-superapp-brand-theme.mjs';")) {
  fail('hardening de marca de Entregas não roda antes da UX interna');
} else ok('tema de Entregas é aplicado antes das correções UX');

const courierTheme = read('scripts/harden-partner-entregador-theme.mjs');
for (const marker of ['APOIS_PARTNER_COURIER_GOLD_V1', '--primary: oklch(0.82 0.16 84)', '#f6be1c']) {
  if (!courierTheme.includes(marker)) fail(`Entregador sem regra preto/dourado preservada: ${marker}`);
}
if (!failed) ok('Entregador permanece independente no tema do Parceiro');

const shellTheme = read('scripts/harden-superapp-shell-mobile-ui.mjs');
for (const marker of ["'--red:#E51B23'","'--red-dark:#C9141B'","'O seu caminho,'","'do seu jeito.'"]) {
  if (!shellTheme.includes(marker)) fail(`seletor Cliente sem marcador vermelho: ${marker}`);
}
if (!failed) ok('seletor Superapp Cliente está alinhado à nova identidade vermelha');

const packageJson = JSON.parse(read('package.json'));
const uiAudit = String(packageJson.scripts?.['audit:ui'] ?? '');
if (!uiAudit.includes('audit-unified-brand-theme-v23.mjs')) fail('audit:ui não inclui v23');
else ok('v23 está encadeada no gate visual');

process.exit(failed ? 1 : 0);
