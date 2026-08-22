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
  'APOIS_CUSTOMER_GOLD_V1',
  '--primary: oklch(0.82 0.16 84)',
  '#f6be1c',
  '#050505',
  "replaceAll('#1F7894', '#C88A08')",
  "replaceAll('#35A9C9', '#F6BE1C')",
]) {
  if (!customerTheme.includes(marker)) fail(`Cliente Entregas sem regra de marca: ${marker}`);
}
if (!failed) ok('Cliente Entregas converte tema e logomarca interna para preto/dourado');

const customerUx = read('scripts/harden-entregas-superapp-customer-ux.mjs');
if (!customerUx.startsWith("import './harden-entregas-superapp-brand-theme.mjs';")) {
  fail('hardening de marca de Entregas não roda antes da UX interna');
} else ok('tema de Entregas é aplicado antes das correções UX');

const courierTheme = read('scripts/harden-partner-entregador-theme.mjs');
for (const marker of ['APOIS_PARTNER_COURIER_GOLD_V1', '--primary: oklch(0.82 0.16 84)', '#f6be1c']) {
  if (!courierTheme.includes(marker)) fail(`Entregador sem regra preto/dourado: ${marker}`);
}
if (!failed) ok('Entregador permanece no mesmo preto/dourado do Parceiro');

const shellTheme = read('scripts/harden-superapp-shell-mobile-ui.mjs');
if (!shellTheme.includes(".replace('--teal:#15d5ca;', '--teal:#f2b414;')")) fail('seletor Cliente não converte teal para dourado');
else ok('seletor Superapp permanece alinhado ao preto/dourado');

const packageJson = JSON.parse(read('package.json'));
const uiAudit = String(packageJson.scripts?.['audit:ui'] ?? '');
if (!uiAudit.includes('audit-unified-brand-theme-v23.mjs')) fail('audit:ui não inclui v23');
else ok('v23 está encadeada no gate visual');

process.exit(failed ? 1 : 0);
